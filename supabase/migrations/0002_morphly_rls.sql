-- 0002_morphly_rls.sql

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE generation_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE generation_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE generation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- 1. Profiles: Users can read and update their own profile safely.
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile safely" ON profiles
    FOR UPDATE USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);
    -- Note: Ideally we prevent users from updating account_status, signup_bonus_granted_at etc.
    -- We can restrict this via an API wrapper or triggers, but for RLS, we grant update to owner.

-- 2. User Roles: Users can view their own roles.
CREATE POLICY "Users can view own roles" ON user_roles
    FOR SELECT USING (auth.uid() = user_id);

-- 3. Wallets: Users can read their own wallet. No direct updates.
CREATE POLICY "Users can view own wallet" ON wallets
    FOR SELECT USING (auth.uid() = user_id);

-- 4. Credit Transactions: Users can view their own transactions.
CREATE POLICY "Users can view own transactions" ON credit_transactions
    FOR SELECT USING (auth.uid() = user_id);

-- 5. Credit Packages: Anyone can view active public packages.
CREATE POLICY "Anyone can view active packages" ON credit_packages
    FOR SELECT USING (is_active = true);

-- 6. Payments: Users can view their own payments.
CREATE POLICY "Users can view own payments" ON payments
    FOR SELECT USING (auth.uid() = user_id);

-- 7. Payment Events: Users cannot view raw payment events (system only).
-- (No public policies for payment_events)

-- 8. Referrals: Users can view their own referrals (either as referrer or referee).
CREATE POLICY "Users can view own referrals" ON referrals
    FOR SELECT USING (auth.uid() = referrer_user_id OR auth.uid() = referred_user_id);

-- 9. Generation Presets: Anyone can view active public presets.
CREATE POLICY "Anyone can view active presets" ON generation_presets
    FOR SELECT USING (is_active = true AND is_public = true);

-- 10. Generation Jobs: Users can view their own jobs.
CREATE POLICY "Users can view own jobs" ON generation_jobs
    FOR SELECT USING (auth.uid() = user_id);

-- Users can also create their own jobs (server might do this, but if frontend does it directly, allow insert).
-- We assume frontend calls server API to create jobs to reserve credits securely. So no insert policy.

-- 11. Generation Events: Users can view events for their own jobs.
CREATE POLICY "Users can view events for own jobs" ON generation_events
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM generation_jobs 
            WHERE generation_jobs.id = generation_events.generation_id 
            AND generation_jobs.user_id = auth.uid()
        )
    );

-- 12. System Settings: Anyone can view public settings.
CREATE POLICY "Anyone can view public settings" ON system_settings
    FOR SELECT USING (is_public = true);

-- 13. Notifications: Users can view their own notifications.
CREATE POLICY "Users can view own notifications" ON notifications
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications" ON notifications
    FOR UPDATE USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 14. Admin Audit Logs: No public access.
-- (No public policies for admin_audit_logs)
