-- 0001_morphly_core.sql

CREATE TABLE profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    email text not null,
    display_name text,
    avatar_url text,
    referral_code text not null unique,
    referred_by_user_id uuid null references profiles(id),
    account_status text not null default 'active',
    signup_bonus_granted_at timestamptz null,
    first_successful_payment_at timestamptz null,
    last_login_at timestamptz null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

CREATE TABLE user_roles (
    user_id uuid references auth.users(id) on delete cascade,
    role text not null,
    created_by uuid null references auth.users(id),
    created_at timestamptz not null default now(),
    primary key (user_id, role)
);

CREATE TABLE wallets (
    user_id uuid primary key references auth.users(id) on delete cascade,
    available_credits bigint not null default 0 check (available_credits >= 0),
    reserved_credits bigint not null default 0 check (reserved_credits >= 0),
    lifetime_purchased bigint not null default 0,
    lifetime_spent bigint not null default 0,
    lifetime_bonus bigint not null default 0,
    lifetime_refunded bigint not null default 0,
    version bigint not null default 0,
    updated_at timestamptz not null default now()
);

CREATE TABLE credit_transactions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete restrict,
    transaction_type text not null,
    credit_delta bigint not null,
    available_balance_after bigint not null,
    reserved_balance_after bigint not null,
    reference_type text null,
    reference_id uuid null,
    idempotency_key text not null unique,
    description text,
    metadata jsonb not null default '{}'::jsonb,
    created_by uuid null references auth.users(id),
    created_at timestamptz not null default now()
);

CREATE TABLE credit_packages (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    slug text not null unique,
    description text,
    price_minor bigint not null check (price_minor > 0),
    currency text not null default 'NGN',
    base_credits bigint not null check (base_credits > 0),
    bonus_credits bigint not null default 0 check (bonus_credits >= 0),
    badge text null,
    sort_order integer not null default 0,
    is_featured boolean not null default false,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

CREATE TABLE payments (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete restrict,
    package_id uuid not null references credit_packages(id),
    provider text not null default 'flutterwave',
    tx_ref text not null unique,
    provider_transaction_id text null unique,
    status text not null default 'pending',
    currency text not null,
    expected_amount_minor bigint not null,
    paid_amount_minor bigint null,
    credits_to_grant bigint not null,
    provider_fee_minor bigint null,
    payment_method text null,
    checkout_url text null,
    raw_verified_response jsonb null,
    credited_at timestamptz null,
    failed_at timestamptz null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

CREATE TABLE payment_events (
    id uuid primary key default gen_random_uuid(),
    provider text not null,
    provider_event_id text not null,
    event_type text,
    signature_valid boolean not null,
    payload_hash text not null,
    payload jsonb not null,
    processed_at timestamptz null,
    processing_error text null,
    received_at timestamptz not null default now(),
    unique(provider, provider_event_id)
);

CREATE TABLE referrals (
    id uuid primary key default gen_random_uuid(),
    referrer_user_id uuid not null references auth.users(id) on delete restrict,
    referred_user_id uuid not null unique references auth.users(id) on delete restrict,
    referral_code_used text not null,
    status text not null default 'registered',
    qualifying_payment_id uuid null references payments(id),
    referrer_bonus_credits bigint not null default 0,
    referee_bonus_credits bigint not null default 0,
    qualified_at timestamptz null,
    rewarded_at timestamptz null,
    rejection_reason text null,
    created_at timestamptz not null default now()
);

CREATE TABLE generation_presets (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    slug text not null unique,
    description text,
    action text not null,
    width integer not null,
    height integer not null,
    frames integer not null,
    fps integer not null,
    inference_steps integer not null,
    guidance_scale numeric not null,
    credit_cost bigint not null check (credit_cost > 0),
    estimated_seconds_min integer null,
    estimated_seconds_max integer null,
    feature_flag text null,
    is_public boolean not null default true,
    is_active boolean not null default true,
    sort_order integer not null default 0,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

CREATE TABLE generation_jobs (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete restrict,
    preset_id uuid not null references generation_presets(id),
    action text not null,
    prompt text not null,
    negative_prompt text null,
    source_asset_path text null,
    status text not null default 'created',
    progress_percent smallint not null default 0 check (progress_percent between 0 and 100),
    progress_message text null,
    credit_cost bigint not null,
    credits_reserved_at timestamptz null,
    credits_finalized_at timestamptz null,
    credits_refunded_at timestamptz null,
    runpod_job_id text null unique,
    runpod_status text null,
    runpod_worker_id text null,
    runpod_delay_ms bigint null,
    runpod_execution_ms bigint null,
    runpod_endpoint_id text null,
    gpu_type text null,
    gpu_hourly_rate_usd numeric null,
    estimated_gpu_cost_usd numeric null,
    actual_gpu_cost_usd numeric null,
    output_bucket text null,
    output_storage_path text null,
    output_file_size_bytes bigint null,
    output_width integer null,
    output_height integer null,
    output_frames integer null,
    output_fps integer null,
    output_seed bigint null,
    error_code text null,
    error_message text null,
    retry_count integer not null default 0,
    client_request_id text not null,
    request_snapshot jsonb not null default '{}'::jsonb,
    submitted_at timestamptz null,
    started_at timestamptz null,
    completed_at timestamptz null,
    failed_at timestamptz null,
    cancelled_at timestamptz null,
    last_runpod_check_at timestamptz null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique(user_id, client_request_id)
);

CREATE TABLE generation_events (
    id bigint generated always as identity primary key,
    generation_id uuid not null references generation_jobs(id) on delete cascade,
    event_type text not null,
    from_status text null,
    to_status text null,
    message text null,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

CREATE TABLE system_settings (
    key text primary key,
    value jsonb not null,
    description text,
    is_public boolean not null default false,
    updated_by uuid null references auth.users(id),
    updated_at timestamptz not null default now()
);

CREATE TABLE notifications (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    type text not null,
    title text not null,
    message text not null,
    action_url text null,
    read_at timestamptz null,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

CREATE TABLE admin_audit_logs (
    id uuid primary key default gen_random_uuid(),
    actor_user_id uuid not null references auth.users(id),
    action text not null,
    target_type text not null,
    target_id text null,
    before_data jsonb null,
    after_data jsonb null,
    reason text null,
    ip_hash text null,
    user_agent text null,
    created_at timestamptz not null default now()
);
