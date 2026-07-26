-- 0004_reliable_user_bootstrap.sql
--
-- Make account initialization idempotent and repair a missing wallet for an
-- existing profile. Keep all credit-changing SECURITY DEFINER functions
-- callable only by the trusted service-role API.

CREATE OR REPLACE FUNCTION bootstrap_new_user(
    p_user_id uuid,
    p_email text,
    p_display_name text,
    p_referral_code_used text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_referrer_id uuid;
    v_signup_bonus bigint := 70;
    v_new_referral_code text;
    v_wallet_created boolean := false;
BEGIN
    -- Serialize concurrent bootstrap attempts for the same authenticated user.
    PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

    SELECT COALESCE((value->>'signup_bonus_credits')::bigint, 70)
    INTO v_signup_bonus
    FROM system_settings
    WHERE key = 'system_config';

    IF v_signup_bonus IS NULL THEN
        v_signup_bonus := 70;
    END IF;

    IF p_referral_code_used IS NOT NULL THEN
        SELECT id
        INTO v_referrer_id
        FROM profiles
        WHERE upper(referral_code) = upper(p_referral_code_used)
        LIMIT 1;

        IF v_referrer_id = p_user_id THEN
            v_referrer_id := NULL;
        END IF;
    END IF;

    IF EXISTS (SELECT 1 FROM profiles WHERE id = p_user_id) THEN
        UPDATE profiles
        SET
            email = p_email,
            display_name = COALESCE(
                NULLIF(display_name, ''),
                NULLIF(p_display_name, ''),
                split_part(p_email, '@', 1)
            ),
            referred_by_user_id = COALESCE(referred_by_user_id, v_referrer_id),
            updated_at = now()
        WHERE id = p_user_id;
    ELSE
        LOOP
            v_new_referral_code :=
                upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 8));

            BEGIN
                INSERT INTO profiles (
                    id,
                    email,
                    display_name,
                    referral_code,
                    referred_by_user_id
                ) VALUES (
                    p_user_id,
                    p_email,
                    COALESCE(
                        NULLIF(p_display_name, ''),
                        split_part(p_email, '@', 1)
                    ),
                    v_new_referral_code,
                    v_referrer_id
                );
                EXIT;
            EXCEPTION
                WHEN unique_violation THEN
                    -- A referral-code collision should retry. A concurrent
                    -- insert for this same user can safely continue.
                    IF EXISTS (SELECT 1 FROM profiles WHERE id = p_user_id) THEN
                        EXIT;
                    END IF;
            END;
        END LOOP;
    END IF;

    INSERT INTO wallets (
        user_id,
        available_credits,
        lifetime_bonus
    ) VALUES (
        p_user_id,
        v_signup_bonus,
        v_signup_bonus
    )
    ON CONFLICT (user_id) DO NOTHING
    RETURNING true INTO v_wallet_created;

    IF COALESCE(v_wallet_created, false) THEN
        INSERT INTO credit_transactions (
            user_id,
            transaction_type,
            credit_delta,
            available_balance_after,
            reserved_balance_after,
            idempotency_key,
            description
        ) VALUES (
            p_user_id,
            'signup_bonus',
            v_signup_bonus,
            v_signup_bonus,
            0,
            'signup-bonus:' || p_user_id::text,
            'Welcome to Morphly! Here are your free credits.'
        )
        ON CONFLICT (idempotency_key) DO NOTHING;

        UPDATE profiles
        SET signup_bonus_granted_at = COALESCE(signup_bonus_granted_at, now())
        WHERE id = p_user_id;
    END IF;

    IF v_referrer_id IS NOT NULL THEN
        INSERT INTO referrals (
            referrer_user_id,
            referred_user_id,
            referral_code_used
        ) VALUES (
            v_referrer_id,
            p_user_id,
            p_referral_code_used
        )
        ON CONFLICT (referred_user_id) DO NOTHING;
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION bootstrap_new_user(uuid, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION bootstrap_new_user(uuid, text, text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION bootstrap_new_user(uuid, text, text, text) TO service_role;

REVOKE ALL ON FUNCTION reserve_generation_credits(uuid, uuid, bigint, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION reserve_generation_credits(uuid, uuid, bigint, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION reserve_generation_credits(uuid, uuid, bigint, text) TO service_role;

REVOKE ALL ON FUNCTION finalize_generation_charge(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION finalize_generation_charge(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION finalize_generation_charge(uuid) TO service_role;

REVOKE ALL ON FUNCTION refund_generation_reservation(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION refund_generation_reservation(uuid, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION refund_generation_reservation(uuid, text) TO service_role;

REVOKE ALL ON FUNCTION complete_verified_payment(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION complete_verified_payment(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION complete_verified_payment(uuid) TO service_role;
