-- 0011_fix_prompt_enhancement_credits.sql
--
-- Fixes ambiguous column reference in charge_prompt_enhancement_credits

CREATE OR REPLACE FUNCTION charge_prompt_enhancement_credits(
    p_user_id uuid,
    p_amount bigint,
    p_idempotency_key text
) RETURNS TABLE (
    out_transaction_id uuid,
    out_available_credits bigint,
    out_reserved_credits bigint
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
    v_idempotency_key text := btrim(COALESCE(p_idempotency_key, ''));
BEGIN
    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'p_user_id is required';
    END IF;
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'p_amount must be positive';
    END IF;
    IF v_idempotency_key = '' THEN
        RAISE EXCEPTION 'p_idempotency_key is required';
    END IF;

    -- Check if this transaction already occurred
    SELECT * INTO v_existing
    FROM credit_transactions
    WHERE user_id = p_user_id
      AND idempotency_key = v_idempotency_key
    FOR UPDATE;

    IF FOUND THEN
        RETURN QUERY
        SELECT 
            v_existing.id,
            v_existing.available_balance_after,
            v_existing.reserved_balance_after;
        RETURN;
    END IF;

    -- Lock the wallet row
    SELECT * INTO v_before
    FROM wallets
    WHERE user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Wallet not found for user %', p_user_id;
    END IF;

    -- Check sufficient balance
    IF v_before.available_credits < p_amount THEN
        RAISE EXCEPTION 'Insufficient credits for prompt enhancement';
    END IF;

    -- Update wallet
    UPDATE wallets
    SET 
        available_credits = wallets.available_credits - p_amount,
        lifetime_spent = wallets.lifetime_spent + p_amount
    WHERE user_id = p_user_id
    RETURNING * INTO v_after;

    -- Log transaction
    INSERT INTO credit_transactions (
        user_id,
        transaction_type,
        credit_delta,
        available_balance_after,
        reserved_balance_after,
        idempotency_key,
        description,
        metadata
    ) VALUES (
        p_user_id,
        'prompt_enhancement',
        -p_amount,
        v_after.available_credits,
        v_after.reserved_credits,
        v_idempotency_key,
        'Charged for Gemini AI prompt enhancement',
        jsonb_build_object(
            'amount', p_amount
        )
    ) RETURNING id INTO v_transaction_id;

    RETURN QUERY
    SELECT 
        v_transaction_id,
        v_after.available_credits,
        v_after.reserved_credits;
END;
$$;
