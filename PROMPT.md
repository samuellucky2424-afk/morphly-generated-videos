# Morphly LTX 2.3 — Supabase Backend Implementation Blueprint

## Role

You are a senior full-stack SaaS engineer. Upgrade this existing Morphly LTX 2.3
AI video generator from a polished frontend prototype into a secure,
production-ready application.

Work inside the existing codebase. Preserve the current dark cinematic design,
lemon-green/yellow brand system, GSAP storytelling, Framer Motion transitions,
responsive behavior, typography, component styling, and homepage sections.
Do not replace the UI with a generic template.

Implement the work in small, verifiable stages. After every stage:

1. Run type-checking, linting, tests, and a production build.
2. Fix errors before moving forward.
3. Test desktop and mobile layouts.
4. Never expose a secret or service-role key in browser code.

## Product Requirements

Morphly allows authenticated users to:

- Register, verify email, log in, log out, and reset their password.
- Receive 50 free test credits after their first verified registration.
- Enter an optional referral code during registration.
- Generate text-to-video, image-to-video, and video-to-video jobs.
- Upload source images and videos securely.
- Track job progress without keeping the browser request open.
- View, download, retry, duplicate, and delete their own generations.
- See an accurate credit balance and immutable credit transaction history.
- Purchase credit packages through Flutterwave.
- Manage their profile, password, notification preferences, and account.
- Refer users and earn 200 bonus credits only after a referred user completes
  their first successful paid purchase.

Administrators must be able to:

- View platform KPIs, revenue, user growth, generation volume, failure rate,
  GPU/worker status, queue depth, and provider cost.
- Search, filter, inspect, suspend, and reactivate users.
- Add or remove credits with a required reason.
- View every generation job and retry eligible failed jobs.
- Create, edit, activate, deactivate, and reorder credit packages.
- Inspect purchases, webhook events, refunds, referral rewards, audit logs, and
  system incidents.
- Change safe public product settings.
- Never reveal raw API secrets in the admin browser.

## Existing Stack

- React 19
- TypeScript
- Next/Vinext-compatible application structure
- Tailwind CSS
- Framer Motion
- GSAP
- Lucide React
- Supabase for Auth, Postgres, Storage, Realtime, and Edge Functions
- Flutterwave for payments
- LTX 2.3 worker/provider for video generation
- Resend for transactional email, if configured

Use the package manager and scripts already present in `package.json`. Do not
replace the framework, remove the current animations, or rewrite working visual
components unnecessarily.

## Stage 1 — Refactor Without Changing the Design

The current interface is concentrated in `app/page.tsx`. Split it into a
maintainable route and component structure while keeping its appearance:

```text
app/
  page.tsx
  login/page.tsx
  signup/page.tsx
  forgot-password/page.tsx
  reset-password/page.tsx
  dashboard/page.tsx
  dashboard/videos/page.tsx
  dashboard/assets/page.tsx
  dashboard/billing/page.tsx
  dashboard/settings/page.tsx
  admin/page.tsx
  admin/users/page.tsx
  admin/generations/page.tsx
  admin/billing/page.tsx
  admin/packages/page.tsx
  admin/system/page.tsx
  auth/callback/route.ts
  api/
    generate/route.ts
    jobs/[id]/route.ts
    jobs/[id]/cancel/route.ts
    payments/initialize/route.ts
    payments/verify/route.ts
components/
  marketing/
  dashboard/
  admin/
  auth/
  shared/
lib/
  supabase/
    client.ts
    server.ts
    middleware.ts
  auth.ts
  credits.ts
  jobs.ts
  payments.ts
  validation.ts
  rate-limit.ts
types/
  database.ts
  domain.ts
supabase/
  migrations/
  functions/
```

Use real routes instead of switching the entire application with a single
client-side `view` state. Add loading, empty, success, and error states. Preserve
keyboard navigation, visible focus states, semantic headings, labels, touch
targets, `prefers-reduced-motion`, and color contrast.

## Stage 2 — Environment Configuration

Create `.env.example` with names only and safe explanations:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_WEBHOOK_SECRET=

APP_URL=http://localhost:3000
APP_ENV=development

FLUTTERWAVE_PUBLIC_KEY=
FLUTTERWAVE_SECRET_KEY=
FLUTTERWAVE_WEBHOOK_SECRET_HASH=

LTX_API_BASE_URL=
LTX_API_KEY=
LTX_WEBHOOK_SECRET=

RESEND_API_KEY=
EMAIL_FROM=Morphly <no-reply@example.com>

CRON_SECRET=
ADMIN_BOOTSTRAP_EMAIL=
```

Rules:

- Only `NEXT_PUBLIC_*` values may enter browser bundles.
- `SUPABASE_SERVICE_ROLE_KEY`, Flutterwave secret, LTX key, webhook secrets,
  Resend key, and cron secret are server-only.
- Do not store provider secrets in normal Supabase tables.
- Do not print secrets in logs or return them in API responses.
- Validate required environment variables at server startup.
- Add `.env*` to `.gitignore` while keeping `.env.example`.

## Stage 3 — Supabase Authentication

Implement Supabase SSR authentication using the current official Supabase
server/client pattern for this framework.

Required flows:

- Email/password registration.
- Email verification callback.
- Login with useful, non-revealing error messages.
- Forgot-password email.
- Reset-password screen.
- Session refresh.
- Logout.
- Route protection for `/dashboard/**`.
- Role protection for `/admin/**`.
- Redirect authenticated users away from login/signup when appropriate.

Never determine admin access from a client-side variable or email comparison.
Authorization must be checked server-side using the user profile role.

Registration fields:

- Full name
- Email
- Password
- Optional referral code
- Consent to Terms and Privacy Policy

Do not directly award registration credits in client code. A database trigger
must create the profile, wallet, referral code, and one idempotent 50-credit
welcome transaction.

## Stage 4 — Database Schema

Create timestamped SQL migrations. Enable `pgcrypto` where required. Use UUID
primary keys, timezone-aware timestamps, foreign keys, constraints, and indexes.

### `profiles`

```text
id uuid primary key references auth.users(id) on delete cascade
full_name text not null
display_name text
avatar_url text
company text
role text not null default 'user' check in ('user','support','admin','super_admin')
status text not null default 'active' check in ('active','suspended','deleted')
referral_code text unique not null
referred_by uuid references profiles(id)
email_notifications boolean not null default true
marketing_emails boolean not null default false
onboarding_complete boolean not null default false
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
last_seen_at timestamptz
```

### `wallets`

```text
user_id uuid primary key references profiles(id) on delete cascade
balance bigint not null default 0 check (balance >= 0)
lifetime_purchased bigint not null default 0
lifetime_bonus bigint not null default 0
lifetime_spent bigint not null default 0
version bigint not null default 0
updated_at timestamptz not null default now()
```

### `credit_transactions`

This is the financial source of truth. Never edit or delete ledger rows.

```text
id uuid primary key
user_id uuid not null references profiles(id)
amount bigint not null check (amount <> 0)
balance_after bigint not null check (balance_after >= 0)
type text not null check in (
  'welcome_bonus','purchase','generation_hold','generation_charge',
  'generation_refund','referral_bonus','admin_adjustment','refund'
)
status text not null default 'completed'
reference_type text
reference_id uuid
idempotency_key text unique not null
description text
metadata jsonb not null default '{}'
created_by uuid references profiles(id)
created_at timestamptz not null default now()
```

### `credit_packages`

```text
id uuid primary key
name text not null
slug text unique not null
credits bigint not null check (credits > 0)
bonus_credits bigint not null default 0 check (bonus_credits >= 0)
price_minor bigint not null check (price_minor > 0)
currency text not null default 'NGN'
is_active boolean not null default true
sort_order integer not null default 0
metadata jsonb not null default '{}'
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

Seed packages through SQL, but make them admin-configurable. Do not hardcode
package price or credit values into the dashboard.

### `purchases`

```text
id uuid primary key
user_id uuid not null references profiles(id)
package_id uuid references credit_packages(id)
provider text not null default 'flutterwave'
provider_reference text unique
internal_reference text unique not null
amount_minor bigint not null
currency text not null
credits bigint not null
status text not null check in ('pending','successful','failed','cancelled','refunded')
payment_link text
provider_payload jsonb not null default '{}'
verified_at timestamptz
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

### `generation_jobs`

```text
id uuid primary key
user_id uuid not null references profiles(id)
mode text not null check in ('text_to_video','image_to_video','video_to_video')
title text
prompt text not null
negative_prompt text
model text not null default 'ltx-2.3'
aspect_ratio text not null
duration_seconds integer not null check (duration_seconds between 1 and 60)
fps integer
width integer
height integer
seed bigint
status text not null check in (
  'queued','submitted','processing','completed','failed','cancelled'
)
progress smallint not null default 0 check (progress between 0 and 100)
source_asset_id uuid
output_asset_id uuid
provider_job_id text unique
provider text not null default 'ltx'
credits_reserved bigint not null
credits_charged bigint not null default 0
error_code text
error_message text
attempt_count integer not null default 0
started_at timestamptz
completed_at timestamptz
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

### `assets`

```text
id uuid primary key
user_id uuid not null references profiles(id)
bucket text not null
storage_path text unique not null
kind text not null check in ('source_image','source_video','generated_video','thumbnail')
original_name text
mime_type text not null
size_bytes bigint not null check (size_bytes >= 0)
width integer
height integer
duration_seconds numeric
status text not null default 'ready'
created_at timestamptz not null default now()
deleted_at timestamptz
```

Add the `source_asset_id` and `output_asset_id` foreign keys after both tables
exist, or arrange migration order safely.

### `referrals`

```text
id uuid primary key
referrer_id uuid not null references profiles(id)
referred_user_id uuid unique not null references profiles(id)
referral_code text not null
qualifying_purchase_id uuid unique references purchases(id)
status text not null check in ('registered','qualified','rewarded','rejected')
reward_credits bigint not null default 200
rewarded_at timestamptz
created_at timestamptz not null default now()
```

### `admin_audit_logs`

```text
id uuid primary key
actor_id uuid references profiles(id)
action text not null
target_type text not null
target_id text
reason text
before_data jsonb
after_data jsonb
ip_hash text
user_agent text
created_at timestamptz not null default now()
```

### `webhook_events`

```text
id uuid primary key
provider text not null
provider_event_id text not null
event_type text not null
signature_valid boolean not null
payload jsonb not null
processing_status text not null default 'received'
error_message text
received_at timestamptz not null default now()
processed_at timestamptz
unique(provider, provider_event_id)
```

### `app_settings`

```text
key text primary key
value jsonb not null
is_public boolean not null default false
updated_by uuid references profiles(id)
updated_at timestamptz not null default now()
```

### `system_events`

```text
id uuid primary key
severity text not null check in ('info','warning','error','critical')
source text not null
event_type text not null
message text not null
metadata jsonb not null default '{}'
created_at timestamptz not null default now()
resolved_at timestamptz
resolved_by uuid references profiles(id)
```

Create indexes for user/time queries, job status, provider job ID, purchases,
referral status, audit timestamps, and unresolved system events.

## Stage 5 — Database Functions and Atomic Credits

All wallet changes must occur through PostgreSQL functions using row locks. The
browser must never directly update `wallets.balance`.

Create:

### `handle_new_auth_user()`

- Triggered after insertion into `auth.users`.
- Creates the profile and unique referral code.
- Resolves an optional referral code safely from user metadata.
- Creates the wallet.
- Awards exactly 50 credits once using a deterministic idempotency key such as
  `welcome:<user_id>`.
- Creates a `referrals` row if the referral is valid.
- Must be idempotent and must never block registration because an invalid
  referral code was supplied.

### `reserve_generation_credits(...)`

- Authenticated user only.
- Lock the wallet row using `FOR UPDATE`.
- Calculate price on the server using current generation pricing.
- Reject insufficient balance.
- Subtract the maximum estimated charge.
- Insert an immutable `generation_hold` ledger entry.
- Create the queued generation job in the same transaction.
- Return job ID, reserved credits, and new balance.

### `finalize_generation_charge(...)`

- Service role only.
- Lock job and wallet.
- Be idempotent for repeated provider callbacks.
- Calculate actual charge from actual billable duration/configuration.
- Convert the hold into the final cost using ledger entries.
- Refund unused reserved credits automatically.
- Mark the job completed and attach output asset metadata.

### `refund_failed_generation(...)`

- Service role only.
- Refund the unused reservation exactly once.
- Mark the job failed with a safe user-facing error.

### `apply_successful_purchase(...)`

- Service role only.
- Verify the purchase is not already fulfilled.
- Credit purchased and bonus credits atomically.
- Add immutable ledger entry.
- Mark purchase successful.
- Process a first-purchase referral reward exactly once.

### `admin_adjust_credits(...)`

- Admin/super-admin only.
- Requires non-empty reason.
- Locks wallet, prevents negative resulting balances, inserts ledger row, and
  writes an admin audit record.

Return structured JSON from each function. Add SQL tests for duplicate calls,
insufficient credits, concurrent calls, failed jobs, repeated webhooks, invalid
referrals, and attempts to create a negative balance.

## Stage 6 — Row Level Security

Enable RLS on every public table.

Policies:

- Users can select and update only safe fields on their own profile.
- Users cannot update their role, status, referral ownership, or wallet values.
- Users can read their own wallet and ledger rows.
- Users can read only their own jobs, assets, purchases, and referrals.
- Users can read active credit packages.
- Users can read only public app settings.
- Authenticated users may create job requests only through the secure server
  route/RPC, not by bypassing credit reservation.
- Storage access is restricted to the authenticated owner's folder.
- Admin reads and writes must be checked server-side and restricted by role.
- `service_role` handles provider callbacks and privileged financial functions.
- Deny anonymous reads by default except explicitly public packages/settings.

Do not write permissive policies such as `using (true)` for private records.
Do not grant authenticated users access to `auth.users`.

Create a reusable SQL helper such as `is_admin()` that checks the calling
profile role. Avoid recursive RLS policy queries.

## Stage 7 — Supabase Storage

Create private buckets:

- `generation-inputs`
- `generation-outputs`
- `avatars`

Paths:

```text
generation-inputs/<user_id>/<asset_id>/<safe_filename>
generation-outputs/<user_id>/<job_id>/output.mp4
generation-outputs/<user_id>/<job_id>/thumbnail.webp
avatars/<user_id>/avatar.webp
```

Requirements:

- Validate extension, MIME type, and magic bytes server-side.
- Use randomized storage paths; never trust the original filename as a path.
- Reject unsupported formats and oversized files.
- Recommended image limit: 15 MB.
- Recommended source video limit: 200 MB.
- Use short-lived signed URLs for private files.
- Never store large image/video bytes in Postgres.
- Remove abandoned uploads and expired failed-job artifacts with a scheduled
  cleanup function.

## Stage 8 — LTX 2.3 Generation Architecture

Do not keep a web request open while a GPU renders video.

Flow:

1. Client validates the form and uploads the source asset if required.
2. Client calls `POST /api/generate` with prompt and configuration.
3. Server authenticates the user, validates input with a schema, rate-limits,
   and invokes `reserve_generation_credits`.
4. Server submits the job to the configured LTX worker/provider using the
   server-only API key.
5. Store the returned provider job ID and mark the job `submitted`.
6. Return HTTP `202` with the internal job ID.
7. Worker/provider processes asynchronously.
8. Provider calls a signed webhook, or a protected scheduled poller checks
   status.
9. The server verifies the webhook signature before trusting the payload.
10. Output is copied to the private Supabase output bucket.
11. `finalize_generation_charge` or `refund_failed_generation` runs.
12. Client receives progress with Supabase Realtime or bounded polling.

Generation pricing must be server-controlled. Start with an admin-configurable
setting, for example:

```json
{
  "text_to_video": { "credits_per_second": 10 },
  "image_to_video": { "credits_per_second": 10 },
  "video_to_video": { "credits_per_second": 12 },
  "quality_multiplier": { "720p": 1, "1080p": 1.5 }
}
```

Treat this only as a seed. Never trust a credit cost sent by the client.

Generation safeguards:

- Validate prompt length and allowed modes.
- Apply per-user and per-IP rate limits.
- Set job timeouts and bounded retries.
- Never charge twice for a retry.
- Escape provider errors; show safe messages to users.
- Record provider latency, estimated cost, actual cost, worker ID, attempt
  count, and failure category for admin analytics.
- Support cancellation only when the provider allows it; calculate refunds
  server-side.

## Stage 9 — Flutterwave Payments

Payment initialization:

- User selects an active package by ID.
- Server fetches the package from Supabase.
- Server determines price, currency, and credits; never accept these values from
  the browser.
- Insert a pending purchase with a cryptographically random internal reference.
- Initialize Flutterwave from the server.
- Return only the hosted checkout link or safe public checkout data.

Payment completion:

- Treat browser redirects as status displays, not payment proof.
- Verify Flutterwave webhook signature/hash.
- Store every webhook event idempotently.
- Fetch/verify the transaction with Flutterwave server-side.
- Confirm reference, amount, currency, and successful status match the pending
  purchase.
- Call `apply_successful_purchase`.
- Repeated webhooks must not add credits twice.
- Display pending, successful, failed, cancelled, and refunded states.

Referral reward:

- Award 200 credits to the referrer only after the referred user's first
  verified successful purchase.
- Prevent self-referral.
- Prevent a user from changing referrer after registration.
- One referred account can qualify only one reward.
- Record the reward in both `referrals` and `credit_transactions`.

## Stage 10 — Admin Dashboard

Replace all mock values with secure aggregate queries.

Overview:

- Total/active/new/suspended users.
- Jobs by state and mode.
- Completion/failure/cancellation rate.
- Average queue and render time.
- Credits purchased, bonus, held, spent, and refunded.
- Gross revenue by currency.
- Estimated provider cost and gross margin.
- Queue depth and worker health.

Users:

- Search by name or email through a server-only admin endpoint.
- Filter by plan/status/date.
- View profile, wallet, purchases, generations, referral activity, and audit
  history.
- Suspend/reactivate with reason.
- Adjust credits with reason.
- Never return password hashes or sensitive Auth internals.

Packages:

- CRUD for packages.
- Validate positive credits and prices.
- Deactivating a package must not corrupt historical purchases.

System:

- Mask secrets as “configured/not configured”; never return their values.
- Show provider status, webhook failures, queue depth, worker heartbeat,
  generation failures, and unresolved system incidents.

Every admin mutation must:

- Recheck role on the server.
- Validate request input.
- Require a reason for destructive/financial actions.
- Write `admin_audit_logs`.
- Return safe structured errors.

## Stage 11 — Email Notifications

If Resend is configured, send:

- Welcome/verification guidance.
- Password reset through Supabase Auth.
- Purchase receipt.
- Low-credit warning using a configurable threshold.
- Generation completed/failed notification, depending on preference.
- Suspension/reactivation notification.
- Referral reward confirmation.

Email delivery failure must not roll back a completed payment or generation.
Log delivery status without storing sensitive message contents.

## Stage 12 — Dashboard Data and UX

Replace prototype state and hardcoded arrays with real Supabase data.

- Use server-rendered initial data where appropriate.
- Use skeletons for meaningful loading states.
- Use optimistic updates only when rollback is safe.
- Show generation progress, reserved cost, final charge, and refund clearly.
- Add pagination rather than loading unlimited jobs.
- Provide useful empty states.
- Confirm before deleting assets or cancelling jobs.
- Do not expose database errors, stack traces, or provider payloads.
- Preserve the existing lemon/yellow design and motion system.

## Stage 13 — SEO, Performance, and Accessibility

Marketing routes:

- Add unique titles and descriptions.
- Add canonical URL, Open Graph data, Twitter cards, robots, and sitemap.
- Add Organization, SoftwareApplication, FAQ, BlogPosting, and VideoObject
  structured data only where the page has matching visible content.
- Use semantic headings and descriptive internal links.
- Lazy-load below-the-fold media.
- Reserve media dimensions to prevent layout shift.
- Respect reduced-motion settings.

Application routes:

- Add `noindex` to dashboard, admin, auth callbacks, and private pages.
- Keep admin bundles out of the public homepage where practical.
- Ensure all form errors are programmatically connected to inputs.
- Ensure every icon-only button has an accessible label.

## Stage 14 — Security Checklist

- Validate all inputs on the server.
- Use parameterized queries/RPCs.
- Use RLS as defense in depth.
- Protect state-changing endpoints against CSRF where applicable.
- Restrict CORS to approved origins.
- Add security headers: CSP, HSTS in production, Referrer-Policy,
  X-Content-Type-Options, Permissions-Policy, and frame protection.
- Rate-limit login-sensitive, generation, payment, and admin endpoints.
- Verify all webhook signatures and reject stale/replayed requests.
- Hash IP addresses before audit storage if IP tracking is necessary.
- Sanitize filenames and user-generated text.
- Do not use `dangerouslySetInnerHTML` for user content.
- Do not log access tokens, refresh tokens, API keys, passwords, or full payment
  payloads.
- Keep service-role operations in server/Edge Function code only.
- Add dependency audit and secret scanning to CI.

## Stage 15 — Testing

Add:

- Unit tests for price calculations and validation.
- SQL tests for wallet concurrency and idempotency.
- Auth integration tests.
- RLS tests proving one user cannot access another user's records.
- Payment webhook tests for invalid signatures, mismatched amount/currency, and
  duplicate delivery.
- Generation tests for success, failure, timeout, cancellation, retry, partial
  refund, and duplicate callbacks.
- Referral tests for self-referral, repeated purchase, and duplicate webhook.
- Admin authorization tests.
- Responsive end-to-end tests for homepage, signup, login, generation, billing,
  settings, and admin.
- Accessibility checks for keyboard navigation and form errors.

Critical acceptance tests:

1. A new verified user receives exactly 50 credits even if signup is retried.
2. Two concurrent generation requests can never overspend the wallet.
3. A failed generation refunds the correct reservation exactly once.
4. Replaying a successful payment webhook cannot duplicate credits.
5. A referred user's first verified purchase rewards the referrer exactly once.
6. A normal user cannot load or call any admin function.
7. A user cannot read another user's jobs, files, wallet, or purchases.
8. No secret appears in the client bundle or browser network response.

## Stage 16 — Documentation and Delivery

Update `README.md` with:

- Architecture summary.
- Local setup.
- Supabase project setup.
- Migration order.
- Storage bucket setup.
- Authentication redirect URLs.
- Flutterwave test/live configuration.
- LTX worker/provider configuration.
- Resend configuration.
- Webhook URLs and signature setup.
- Deployment steps.
- Admin bootstrap procedure.
- Backup and incident-recovery notes.

Generate typed Supabase database types after migrations. Commit SQL migrations,
tests, `.env.example`, and documentation. Do not include `.env`, secrets,
`node_modules`, build output, provider videos, or user uploads.

## Required Final Report

When implementation is complete, report:

- Files and routes added or changed.
- Migration filenames.
- Tables, functions, triggers, policies, and storage buckets created.
- Environment variable names required.
- Tests and build commands run with results.
- Remaining manual dashboard steps in Supabase, Flutterwave, LTX, and Resend.
- Known limitations.

Do not claim Supabase, Flutterwave, email, storage, or LTX generation is working
unless it was tested with configured credentials and an end-to-end request.
