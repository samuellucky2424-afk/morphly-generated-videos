-- 0005_admin_credit_grants.sql
--
-- Allow a verified administrator to grant credits through one atomic,
-- idempotent operation. Every successful grant is written to both the user
-- credit ledger and the administrator audit log.

CREATE OR REPLACE FUNCTION admin_grant_credits(
    p_actor_user_id uuid,
    p_target_user_id uuid,
    p_amount bigint,
    p_reason text,
    p_idempotency_key text
) RETURNS TABLE (
    transaction_id uuid,
    user_id uuid,
    available_credits bigint,
    reserved_credits bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_before wallets%ROWTYPE;
    v_after wallets%ROWTYPE;
    v_existing credit_transactions%ROWTYPE;
    v_transaction_id uuid;
    v_reason text := btrim(COALESCE(p_reason, ''));
    v_idempotency_key text := btrim(COALESCE(p_idempotency_key, ''));
BEGIN
    IF p_actor_user_id IS NULL OR NOT EXISTS (
        SELECT 1
        FROM user_roles AS ur
        WHERE ur.user_id = p_actor_user_id
          AND ur.role IN ('admin', 'super_admin')
    ) THEN
        RAISE EXCEPTION USING
            ERRCODE = '42501',
            MESSAGE = 'Administrator role required.';
    END IF;

    IF p_target_user_id IS NULL THEN
        RAISE EXCEPTION USING
            ERRCODE = '22023',
            MESSAGE = 'A target user is required.';
    END IF;

    IF p_amount IS NULL OR p_amount <= 0 OR p_amount > 1000000 THEN
        RAISE EXCEPTION USING
            ERRCODE = '22023',
            MESSAGE = 'Credit amount must be between 1 and 1,000,000.';
    END IF;

    IF char_length(v_reason) < 3 OR char_length(v_reason) > 250 THEN
        RAISE EXCEPTION USING
            ERRCODE = '22023',
            MESSAGE = 'Reason must be between 3 and 250 characters.';
    END IF;

    IF v_idempotency_key = '' OR char_length(v_idempotency_key) > 200 THEN
        RAISE EXCEPTION USING
            ERRCODE = '22023',
            MESSAGE = 'A valid idempotency key is required.';
    END IF;

    -- Serialize retries that carry the same request identifier.
    PERFORM pg_advisory_xact_lock(
        hashtextextended('admin-credit:' || v_idempotency_key, 0)
    );

    SELECT ct.*
    INTO v_existing
    FROM credit_transactions AS ct
    WHERE ct.idempotency_key = v_idempotency_key;

    IF FOUND THEN
        IF v_existing.transaction_type <> 'admin_grant'
            OR v_existing.user_id <> p_target_user_id
            OR v_existing.created_by IS DISTINCT FROM p_actor_user_id THEN
            RAISE EXCEPTION USING
                ERRCODE = '23505',
                MESSAGE = 'Idempotency key has already been used.';
        END IF;

        RETURN QUERY
        SELECT
            v_existing.id,
            v_existing.user_id,
            v_existing.available_balance_after,
            v_existing.reserved_balance_after;
        RETURN;
    END IF;

    SELECT w.*
    INTO v_before
    FROM wallets AS w
    WHERE w.user_id = p_target_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING
            ERRCODE = 'P0002',
            MESSAGE = 'Target wallet not found.';
    END IF;

    UPDATE wallets AS w
    SET
        available_credits = w.available_credits + p_amount,
        lifetime_bonus = w.lifetime_bonus + p_amount,
        version = w.version + 1,
        updated_at = now()
    WHERE w.user_id = p_target_user_id
    RETURNING w.* INTO v_after;

    INSERT INTO credit_transactions (
        user_id,
        transaction_type,
        credit_delta,
        available_balance_after,
        reserved_balance_after,
        reference_type,
        idempotency_key,
        description,
        metadata,
        created_by
    ) VALUES (
        p_target_user_id,
        'admin_grant',
        p_amount,
        v_after.available_credits,
        v_after.reserved_credits,
        'admin_credit_grant',
        v_idempotency_key,
        'Admin credit grant: ' || v_reason,
        jsonb_build_object(
            'actor_user_id', p_actor_user_id,
            'reason', v_reason
        ),
        p_actor_user_id
    )
    RETURNING id INTO v_transaction_id;

    INSERT INTO admin_audit_logs (
        actor_user_id,
        action,
        target_type,
        target_id,
        before_data,
        after_data,
        reason
    ) VALUES (
        p_actor_user_id,
        'grant_user_credits',
        'wallet',
        p_target_user_id::text,
        jsonb_build_object(
            'available_credits', v_before.available_credits,
            'reserved_credits', v_before.reserved_credits,
            'lifetime_bonus', v_before.lifetime_bonus,
            'version', v_before.version
        ),
        jsonb_build_object(
            'available_credits', v_after.available_credits,
            'reserved_credits', v_after.reserved_credits,
            'lifetime_bonus', v_after.lifetime_bonus,
            'version', v_after.version,
            'credit_delta', p_amount,
            'transaction_id', v_transaction_id
        ),
        v_reason
    );

    RETURN QUERY
    SELECT
        v_transaction_id,
        p_target_user_id,
        v_after.available_credits,
        v_after.reserved_credits;
END;
$$;

REVOKE ALL ON FUNCTION admin_grant_credits(uuid, uuid, bigint, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION admin_grant_credits(uuid, uuid, bigint, text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_grant_credits(uuid, uuid, bigint, text, text) TO service_role;
