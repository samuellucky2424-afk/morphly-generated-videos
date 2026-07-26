-- 0003_morphly_functions.sql

-- 1. Bootstrap New User
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
    v_signup_bonus bigint;
    v_new_referral_code text;
    v_wallet_exists boolean;
BEGIN
    -- Check if already bootstrapped
    SELECT EXISTS (SELECT 1 FROM profiles WHERE id = p_user_id) INTO v_wallet_exists;
    IF v_wallet_exists THEN
        RETURN;
    END IF;

    -- Generate a unique 8-character referral code
    v_new_referral_code := upper(substring(md5(random()::text) from 1 for 8));

    -- Resolve referrer
    IF p_referral_code_used IS NOT NULL THEN
        SELECT id INTO v_referrer_id FROM profiles WHERE upper(referral_code) = upper(p_referral_code_used);
        -- Prevent self-referral (though technically impossible on signup, safety first)
        IF v_referrer_id = p_user_id THEN
            v_referrer_id := NULL;
        END IF;
    END IF;

    -- Create profile
    INSERT INTO profiles (id, email, display_name, referral_code, referred_by_user_id)
    VALUES (p_user_id, p_email, p_display_name, v_new_referral_code, v_referrer_id);

    -- Get signup bonus from settings
    SELECT (value->>'signup_bonus_credits')::bigint INTO v_signup_bonus 
    FROM system_settings WHERE key = 'system_config';
    
    IF v_signup_bonus IS NULL THEN
        v_signup_bonus := 70; -- Default fallback
    END IF;

    -- Create wallet
    INSERT INTO wallets (user_id, available_credits, lifetime_bonus)
    VALUES (p_user_id, v_signup_bonus, v_signup_bonus);

    -- Create ledger entry
    INSERT INTO credit_transactions (
        user_id, transaction_type, credit_delta, 
        available_balance_after, reserved_balance_after, 
        idempotency_key, description
    ) VALUES (
        p_user_id, 'signup_bonus', v_signup_bonus,
        v_signup_bonus, 0,
        'signup-bonus:' || p_user_id::text,
        'Welcome to Morphly! Here are your free credits.'
    );

    -- Mark bonus as granted
    UPDATE profiles SET signup_bonus_granted_at = now() WHERE id = p_user_id;

    -- Create referral relationship if applicable
    IF v_referrer_id IS NOT NULL THEN
        INSERT INTO referrals (referrer_user_id, referred_user_id, referral_code_used)
        VALUES (v_referrer_id, p_user_id, p_referral_code_used);
    END IF;
END;
$$;

-- 2. Reserve Generation Credits
CREATE OR REPLACE FUNCTION reserve_generation_credits(
    p_user_id uuid,
    p_generation_id uuid,
    p_required_credits bigint,
    p_idempotency_key text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_available bigint;
    v_reserved bigint;
    v_status text;
BEGIN
    -- Lock wallet
    SELECT available_credits, reserved_credits INTO v_available, v_reserved
    FROM wallets WHERE user_id = p_user_id FOR UPDATE;

    -- Check account status
    SELECT account_status INTO v_status FROM profiles WHERE id = p_user_id;
    IF v_status != 'active' THEN
        RAISE EXCEPTION 'Account is not active';
    END IF;

    -- Check balance
    IF v_available < p_required_credits THEN
        RAISE EXCEPTION 'Insufficient credits';
    END IF;

    -- Move credits
    UPDATE wallets 
    SET available_credits = available_credits - p_required_credits,
        reserved_credits = reserved_credits + p_required_credits,
        version = version + 1
    WHERE user_id = p_user_id
    RETURNING available_credits, reserved_credits INTO v_available, v_reserved;

    -- Insert ledger entry
    INSERT INTO credit_transactions (
        user_id, transaction_type, credit_delta, 
        available_balance_after, reserved_balance_after, 
        reference_type, reference_id, idempotency_key, description
    ) VALUES (
        p_user_id, 'generation_reserve', -p_required_credits,
        v_available, v_reserved,
        'generation', p_generation_id, p_idempotency_key,
        'Reserved credits for generation'
    );

    -- Update generation status
    UPDATE generation_jobs 
    SET status = 'reserving', credits_reserved_at = now()
    WHERE id = p_generation_id AND user_id = p_user_id;
END;
$$;

-- 3. Finalize Generation Charge
CREATE OR REPLACE FUNCTION finalize_generation_charge(
    p_generation_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid;
    v_cost bigint;
    v_status text;
    v_available bigint;
    v_reserved bigint;
BEGIN
    -- Lock job
    SELECT user_id, credit_cost, status INTO v_user_id, v_cost, v_status
    FROM generation_jobs WHERE id = p_generation_id FOR UPDATE;

    IF v_status = 'completed' THEN
        RETURN; -- Already finalized safely
    END IF;

    -- Lock wallet
    SELECT available_credits, reserved_credits INTO v_available, v_reserved
    FROM wallets WHERE user_id = v_user_id FOR UPDATE;

    -- Move reserved to spent
    UPDATE wallets 
    SET reserved_credits = reserved_credits - v_cost,
        lifetime_spent = lifetime_spent + v_cost,
        version = version + 1
    WHERE user_id = v_user_id
    RETURNING available_credits, reserved_credits INTO v_available, v_reserved;

    -- Insert ledger entry
    INSERT INTO credit_transactions (
        user_id, transaction_type, credit_delta, 
        available_balance_after, reserved_balance_after, 
        reference_type, reference_id, idempotency_key, description
    ) VALUES (
        v_user_id, 'generation_charge', -v_cost,
        v_available, v_reserved,
        'generation', p_generation_id, 'generation-charge:' || p_generation_id::text,
        'Charged credits for completed generation'
    );

    -- Update job
    UPDATE generation_jobs 
    SET status = 'completed', credits_finalized_at = now(), completed_at = now()
    WHERE id = p_generation_id;
END;
$$;

-- 4. Refund Generation Reservation
CREATE OR REPLACE FUNCTION refund_generation_reservation(
    p_generation_id uuid,
    p_terminal_status text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid;
    v_cost bigint;
    v_status text;
    v_available bigint;
    v_reserved bigint;
BEGIN
    -- Lock job
    SELECT user_id, credit_cost, status INTO v_user_id, v_cost, v_status
    FROM generation_jobs WHERE id = p_generation_id FOR UPDATE;

    IF v_status IN ('refunded', 'completed', 'failed', 'cancelled', 'timed_out') THEN
        RETURN; -- Already handled
    END IF;

    -- Lock wallet
    SELECT available_credits, reserved_credits INTO v_available, v_reserved
    FROM wallets WHERE user_id = v_user_id FOR UPDATE;

    -- Move reserved back to available
    UPDATE wallets 
    SET available_credits = available_credits + v_cost,
        reserved_credits = reserved_credits - v_cost,
        lifetime_refunded = lifetime_refunded + v_cost,
        version = version + 1
    WHERE user_id = v_user_id
    RETURNING available_credits, reserved_credits INTO v_available, v_reserved;

    -- Insert ledger entry
    INSERT INTO credit_transactions (
        user_id, transaction_type, credit_delta, 
        available_balance_after, reserved_balance_after, 
        reference_type, reference_id, idempotency_key, description
    ) VALUES (
        v_user_id, 'generation_refund', v_cost,
        v_available, v_reserved,
        'generation', p_generation_id, 'generation-refund:' || p_generation_id::text,
        'Refunded credits for failed/cancelled generation'
    );

    -- Update job
    UPDATE generation_jobs 
    SET status = p_terminal_status, credits_refunded_at = now(), 
        failed_at = CASE WHEN p_terminal_status = 'failed' THEN now() ELSE failed_at END,
        cancelled_at = CASE WHEN p_terminal_status = 'cancelled' THEN now() ELSE cancelled_at END
    WHERE id = p_generation_id;
END;
$$;

-- 5. Complete Verified Payment (Abbreviated to fit logic)
CREATE OR REPLACE FUNCTION complete_verified_payment(
    p_payment_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid;
    v_status text;
    v_credits bigint;
    v_amount bigint;
    v_available bigint;
    v_reserved bigint;
    v_referral_id uuid;
    v_ref_status text;
    v_referrer uuid;
    v_ref_bonus bigint;
BEGIN
    SELECT user_id, status, credits_to_grant, expected_amount_minor
    INTO v_user_id, v_status, v_credits, v_amount
    FROM payments WHERE id = p_payment_id FOR UPDATE;

    IF v_status = 'successful' THEN RETURN; END IF;

    -- Update wallet
    UPDATE wallets SET 
        available_credits = available_credits + v_credits,
        lifetime_purchased = lifetime_purchased + v_credits,
        version = version + 1
    WHERE user_id = v_user_id
    RETURNING available_credits, reserved_credits INTO v_available, v_reserved;

    -- Ledger
    INSERT INTO credit_transactions (
        user_id, transaction_type, credit_delta, available_balance_after, reserved_balance_after, 
        reference_type, reference_id, idempotency_key, description
    ) VALUES (
        v_user_id, 'purchase', v_credits, v_available, v_reserved,
        'payment', p_payment_id, 'payment-credit:' || p_payment_id::text,
        'Purchased credit package'
    );

    -- Update Payment
    UPDATE payments SET status = 'successful', credited_at = now() WHERE id = p_payment_id;

    -- Update Profile First Payment
    UPDATE profiles SET first_successful_payment_at = COALESCE(first_successful_payment_at, now())
    WHERE id = v_user_id;

    -- Handle Referral Qualification
    SELECT id, status, referrer_user_id INTO v_referral_id, v_ref_status, v_referrer 
    FROM referrals WHERE referred_user_id = v_user_id FOR UPDATE;

    IF v_referral_id IS NOT NULL AND v_ref_status = 'registered' THEN
        SELECT (value->>'referral_referrer_bonus_credits')::bigint INTO v_ref_bonus 
        FROM system_settings WHERE key = 'system_config';
        
        IF v_ref_bonus IS NULL THEN v_ref_bonus := 200; END IF;

        UPDATE referrals SET 
            status = 'rewarded', qualifying_payment_id = p_payment_id, 
            referrer_bonus_credits = v_ref_bonus, qualified_at = now(), rewarded_at = now()
        WHERE id = v_referral_id;

        -- Credit referrer
        UPDATE wallets SET 
            available_credits = available_credits + v_ref_bonus, 
            lifetime_bonus = lifetime_bonus + v_ref_bonus, version = version + 1
        WHERE user_id = v_referrer
        RETURNING available_credits, reserved_credits INTO v_available, v_reserved;

        INSERT INTO credit_transactions (
            user_id, transaction_type, credit_delta, available_balance_after, reserved_balance_after, 
            reference_type, reference_id, idempotency_key, description
        ) VALUES (
            v_referrer, 'referral_bonus', v_ref_bonus, v_available, v_reserved,
            'referral', v_referral_id, 'referral-reward:' || v_referral_id::text,
            'Bonus for successful referral'
        );
    END IF;
END;
$$;
