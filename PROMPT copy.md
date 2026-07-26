# MORPHLY BACKEND, MONETIZATION, RUNPOD AND ADMIN DASHBOARD BLUEPRINT

## Role

Act as a senior full-stack SaaS architect and implementation engineer. Work inside the existing Morphly website repository.

The website UI is already designed as a mockup. **Do not rebuild or replace the design.** Inspect the repository first, identify its framework, routes, components and styling system, then connect the current UI to the real backend while preserving the responsive layout, dark theme, lemon-green/yellow accents, typography, animations and brand identity.

Implement the system phase by phase. Do not leave mock data in production-facing screens. Do not expose private API keys in browser code.

---

# 1. Product objective

Morphly is an AI video-generation SaaS where users can:

1. Sign up, verify email, log in, log out and reset passwords.
2. Receive one controlled signup test bonus.
3. Buy credits through Flutterwave.
4. Submit asynchronous AI video jobs.
5. See the exact credit cost before submitting.
6. Leave the page while a job remains queued or generating.
7. Track queued, preparing, generating, uploading, completed, failed, cancelled and timed-out states.
8. Receive automatic refunds when a job fails without delivering a valid video.
9. View, play and download generated videos.
10. Copy a referral link and track referrals.
11. Earn referral credits only after the referred user completes their first verified successful payment.
12. View a complete credit transaction history.

Administrators must be able to:

1. Monitor revenue, estimated GPU cost, payment fees, gross margin, user growth, paid conversion, generation performance and referral performance.
2. Search and manage users.
3. Add or deduct credits with a mandatory reason and audit trail.
4. Suspend and reactivate users.
5. Manage credit packages and generation presets.
6. Configure signup and referral bonuses.
7. Inspect, cancel, retry, reconcile and refund generation jobs.
8. Review payments and reconcile pending transactions.
9. Monitor RunPod health and activate generation maintenance mode.
10. Review immutable admin audit logs.

---

# 2. Existing infrastructure

Use these current resources:

```env
NEXT_PUBLIC_SUPABASE_URL=https://rcaaqjvqpcpkzvuswunf.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<browser-safe publishable key>
SUPABASE_SECRET_KEY=<server-only Supabase secret/service key>
SUPABASE_VIDEO_BUCKET=morphly-generated-videos

RUNPOD_ENDPOINT_ID=qqlt640ds63arb
RUNPOD_API_KEY=<server-only RunPod API key>
RUNPOD_WEBHOOK_SECRET=<long random value>

FLW_PUBLIC_KEY=<Flutterwave public key>
FLW_SECRET_KEY=<server-only Flutterwave secret key>
FLW_SECRET_HASH=<server-only webhook secret hash>

APP_URL=https://<production-domain>
CRON_SECRET=<long random value>
```

Current facts:

- The RunPod endpoint is queue-based Serverless.
- `text_to_video` has been tested successfully.
- The worker uploads completed MP4 files to the private Supabase bucket `morphly-generated-videos`.
- The worker returns `storage_bucket`, `storage_path`, `download_url`, `file_size_bytes`, dimensions, frames, FPS and seed.
- CPU offloading is currently enabled for stability.
- Image-to-video and video-to-video must remain disabled behind feature flags until their worker actions are implemented and tested.
- Store `storage_path` as the permanent file reference. Do not store a temporary signed URL as the canonical video URL.

---

# 3. Required architecture

Use this flow:

```text
Browser
  -> Morphly server API
  -> Supabase transaction reserves credits
  -> Morphly server submits an asynchronous RunPod job
  -> RunPod returns a job ID immediately
  -> Browser displays Queued
  -> RunPod processes the job
  -> Worker uploads MP4 to private Supabase Storage
  -> RunPod webhook calls Morphly server
  -> Morphly server verifies the job using RunPod status API
  -> Supabase marks the job completed and finalizes reserved credits
  -> User dashboard updates by Realtime or polling
  -> Authorized server route creates a fresh signed video URL
```

Never use:

```text
Browser -> RunPod directly
```

The browser must never receive `RUNPOD_API_KEY`, `SUPABASE_SECRET_KEY` or `FLW_SECRET_KEY`.

Use Next.js App Router server routes if the repository is Next.js. If it uses another framework, implement equivalent server-only routes without changing this architecture.

---

# 4. Implementation phases

## Phase 1 — Foundation

- Inspect the repository before editing.
- Preserve existing UI components.
- Add browser and server Supabase clients.
- Add environment validation with Zod or equivalent.
- Add SQL migrations and generated database types.
- Add structured logging with secret redaction.

## Phase 2 — Authentication

- Email/password signup and login.
- Email verification.
- Forgot password and password reset.
- Protected routes and session refresh.
- Profile, wallet, referral code and signup bonus bootstrap.
- Optional referral code captured during signup.

## Phase 3 — Wallet and ledger

- Available and reserved credits.
- Lifetime purchased, spent, bonus and refunded.
- Append-only credit ledger.
- Atomic database functions for reserve, finalize, refund, payment credit, referral reward and admin adjustment.

## Phase 4 — Flutterwave

- Packages loaded from Supabase.
- Server-created checkout.
- Pending payment row.
- Verified webhook and transaction verification.
- Idempotent wallet credit.
- Referral reward on first verified successful purchase only.

## Phase 5 — RunPod jobs

- Server-calculated generation price.
- Atomic credit reservation.
- Asynchronous RunPod `/run` request.
- RunPod webhook plus status-polling fallback.
- Successful finalization and automatic failure refund.

## Phase 6 — User dashboard

- Replace all mock data.
- Generation form, job status, gallery, wallet, purchases, credit ledger, referrals, settings and notifications.

## Phase 7 — Admin dashboard

- Overview analytics, users, jobs, payments, packages, presets, referrals, health, settings and audit logs.

## Phase 8 — Reliability

- Rate limits, idempotency, reconciliation, tests and deployment documentation.

---

# 5. Database schema

Create timestamped SQL migrations. Use UUID primary keys, foreign keys, `timestamptz`, constraints and indexes.

## `profiles`

```sql
id uuid primary key references auth.users(id) on delete cascade
email text not null
display_name text
avatar_url text
referral_code text not null unique
referred_by_user_id uuid null references profiles(id)
account_status text not null default 'active'
signup_bonus_granted_at timestamptz null
first_successful_payment_at timestamptz null
last_login_at timestamptz null
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

Allowed account statuses: `active`, `suspended`, `deleted`.

Rules:

- A user cannot refer themselves.
- `referred_by_user_id` becomes immutable after registration.
- Referral-code lookup is case-insensitive.
- Authorization roles must not be stored in user-editable metadata.

## `user_roles`

```sql
user_id uuid references auth.users(id) on delete cascade
role text not null
created_by uuid null references auth.users(id)
created_at timestamptz not null default now()
primary key (user_id, role)
```

Allowed roles: `user`, `support`, `finance`, `admin`, `super_admin`.

## `wallets`

```sql
user_id uuid primary key references auth.users(id) on delete cascade
available_credits bigint not null default 0 check (available_credits >= 0)
reserved_credits bigint not null default 0 check (reserved_credits >= 0)
lifetime_purchased bigint not null default 0
lifetime_spent bigint not null default 0
lifetime_bonus bigint not null default 0
lifetime_refunded bigint not null default 0
version bigint not null default 0
updated_at timestamptz not null default now()
```

The browser may read its wallet but must never update balances directly.

## `credit_transactions`

Append-only ledger:

```sql
id uuid primary key default gen_random_uuid()
user_id uuid not null references auth.users(id) on delete restrict
transaction_type text not null
credit_delta bigint not null
available_balance_after bigint not null
reserved_balance_after bigint not null
reference_type text null
reference_id uuid null
idempotency_key text not null unique
description text
metadata jsonb not null default '{}'::jsonb
created_by uuid null references auth.users(id)
created_at timestamptz not null default now()
```

Allowed types:

```text
signup_bonus
purchase
generation_reserve
generation_charge
generation_refund
referral_bonus
admin_credit
admin_debit
promotional_bonus
chargeback
expiry
```

Every wallet mutation must create a matching ledger entry in the same database transaction.

## `credit_packages`

```sql
id uuid primary key default gen_random_uuid()
name text not null
slug text not null unique
description text
price_minor bigint not null check (price_minor > 0)
currency text not null default 'NGN'
base_credits bigint not null check (base_credits > 0)
bonus_credits bigint not null default 0 check (bonus_credits >= 0)
badge text null
sort_order integer not null default 0
is_featured boolean not null default false
is_active boolean not null default true
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

Use kobo for `price_minor`. Seed editable defaults:

| Package | Price | Base | Bonus | Total |
|---|---:|---:|---:|---:|
| Starter | ₦5,000 | 300 | 0 | 300 |
| Creator | ₦10,000 | 600 | 50 | 650 |
| Pro | ₦20,000 | 1,200 | 150 | 1,350 |
| Studio | ₦50,000 | 3,000 | 500 | 3,500 |

Admin must be able to change these without deployment.

## `payments`

```sql
id uuid primary key default gen_random_uuid()
user_id uuid not null references auth.users(id) on delete restrict
package_id uuid not null references credit_packages(id)
provider text not null default 'flutterwave'
tx_ref text not null unique
provider_transaction_id text null unique
status text not null default 'pending'
currency text not null
expected_amount_minor bigint not null
paid_amount_minor bigint null
credits_to_grant bigint not null
provider_fee_minor bigint null
payment_method text null
checkout_url text null
raw_verified_response jsonb null
credited_at timestamptz null
failed_at timestamptz null
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

Allowed statuses: `pending`, `successful`, `failed`, `cancelled`, `reversed`, `chargeback`.

Never store full card information.

## `payment_events`

```sql
id uuid primary key default gen_random_uuid()
provider text not null
provider_event_id text not null
event_type text
signature_valid boolean not null
payload_hash text not null
payload jsonb not null
processed_at timestamptz null
processing_error text null
received_at timestamptz not null default now()
unique(provider, provider_event_id)
```

## `referrals`

```sql
id uuid primary key default gen_random_uuid()
referrer_user_id uuid not null references auth.users(id) on delete restrict
referred_user_id uuid not null unique references auth.users(id) on delete restrict
referral_code_used text not null
status text not null default 'registered'
qualifying_payment_id uuid null references payments(id)
referrer_bonus_credits bigint not null default 0
referee_bonus_credits bigint not null default 0
qualified_at timestamptz null
rewarded_at timestamptz null
rejection_reason text null
created_at timestamptz not null default now()
```

Allowed statuses: `registered`, `qualified`, `rewarded`, `rejected`.

Default values from settings:

```text
Verified-user signup bonus: 70 credits
Referrer reward after referred user's first successful payment: 200 credits
Referred buyer extra reward: 0 credits
```

Do not hardcode these values in UI components.

## `generation_presets`

```sql
id uuid primary key default gen_random_uuid()
name text not null
slug text not null unique
description text
action text not null
width integer not null
height integer not null
frames integer not null
fps integer not null
inference_steps integer not null
guidance_scale numeric not null
credit_cost bigint not null check (credit_cost > 0)
estimated_seconds_min integer null
estimated_seconds_max integer null
feature_flag text null
is_public boolean not null default true
is_active boolean not null default true
sort_order integer not null default 0
metadata jsonb not null default '{}'::jsonb
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

Allowed actions: `text_to_video`, `image_to_video`, `video_to_video`.

Seed only the tested preview preset as active:

```text
Name: Preview
Action: text_to_video
Width: 256
Height: 256
Frames: 9
FPS: 8
Inference steps: 1
Guidance scale: 1
Credit cost: 70
```

Create Standard and Pro as disabled placeholders until benchmark results are entered by an administrator.

## `generation_jobs`

```sql
id uuid primary key default gen_random_uuid()
user_id uuid not null references auth.users(id) on delete restrict
preset_id uuid not null references generation_presets(id)
action text not null
prompt text not null
negative_prompt text null
source_asset_path text null
status text not null default 'created'
progress_percent smallint not null default 0 check (progress_percent between 0 and 100)
progress_message text null
credit_cost bigint not null
credits_reserved_at timestamptz null
credits_finalized_at timestamptz null
credits_refunded_at timestamptz null
runpod_job_id text null unique
runpod_status text null
runpod_worker_id text null
runpod_delay_ms bigint null
runpod_execution_ms bigint null
runpod_endpoint_id text null
gpu_type text null
gpu_hourly_rate_usd numeric null
estimated_gpu_cost_usd numeric null
actual_gpu_cost_usd numeric null
output_bucket text null
output_storage_path text null
output_file_size_bytes bigint null
output_width integer null
output_height integer null
output_frames integer null
output_fps integer null
output_seed bigint null
error_code text null
error_message text null
retry_count integer not null default 0
client_request_id text not null
request_snapshot jsonb not null default '{}'::jsonb
submitted_at timestamptz null
started_at timestamptz null
completed_at timestamptz null
failed_at timestamptz null
cancelled_at timestamptz null
last_runpod_check_at timestamptz null
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
unique(user_id, client_request_id)
```

Allowed statuses:

```text
created
reserving
queued
preparing
generating
uploading
completed
failed
cancelled
timed_out
refund_pending
refunded
```

Store a complete preset/request snapshot so later price changes do not affect existing jobs.

## `generation_events`

```sql
id bigint generated always as identity primary key
generation_id uuid not null references generation_jobs(id) on delete cascade
event_type text not null
from_status text null
to_status text null
message text null
metadata jsonb not null default '{}'::jsonb
created_at timestamptz not null default now()
```

## `system_settings`

```sql
key text primary key
value jsonb not null
description text
is_public boolean not null default false
updated_by uuid null references auth.users(id)
updated_at timestamptz not null default now()
```

Seed:

```json
{
  "signup_bonus_credits": 70,
  "referral_referrer_bonus_credits": 200,
  "referral_referee_bonus_credits": 0,
  "generation_maintenance_mode": false,
  "default_signed_url_ttl_seconds": 3600,
  "max_active_jobs_per_user": 2,
  "max_prompt_length": 2000,
  "runpod_gpu_hourly_rate_usd": 3.49,
  "job_execution_timeout_ms": 900000,
  "job_total_ttl_ms": 3600000
}
```

## `notifications`

```sql
id uuid primary key default gen_random_uuid()
user_id uuid not null references auth.users(id) on delete cascade
type text not null
title text not null
message text not null
action_url text null
read_at timestamptz null
metadata jsonb not null default '{}'::jsonb
created_at timestamptz not null default now()
```

## `admin_audit_logs`

```sql
id uuid primary key default gen_random_uuid()
actor_user_id uuid not null references auth.users(id)
action text not null
target_type text not null
target_id text null
before_data jsonb null
after_data jsonb null
reason text null
ip_hash text null
user_agent text null
created_at timestamptz not null default now()
```

Normal users and ordinary admins must not update or delete audit logs.

---

# 6. Atomic database functions

Create security-definer functions with a fixed safe `search_path`. Revoke public execution and grant only to required roles.

## `bootstrap_new_user`

- Create profile and unique referral code.
- Resolve optional referral code.
- Prevent self-referral.
- Create referral relationship once.
- Create wallet.
- Grant signup bonus once.
- Insert signup-bonus ledger entry.
- Be safe against duplicate execution.

## `reserve_generation_credits`

Inputs: user ID, generation ID, required credits and idempotency key.

1. Lock wallet with `FOR UPDATE`.
2. Confirm account is active.
3. Confirm sufficient available credits.
4. Move credits from available to reserved.
5. Increment wallet version.
6. Insert `generation_reserve` ledger entry.
7. Update generation status.
8. Commit atomically.

## `finalize_generation_charge`

1. Lock wallet and job.
2. Exit safely if already finalized.
3. Remove amount from reserved credits.
4. Add to lifetime spent.
5. Insert `generation_charge` ledger entry.
6. Mark the job completed.
7. Commit atomically.

## `refund_generation_reservation`

1. Lock wallet and job.
2. Exit safely if already refunded or finalized.
3. Move amount from reserved back to available.
4. Add to lifetime refunded.
5. Insert `generation_refund` ledger entry.
6. Mark refund timestamp and terminal state.
7. Commit atomically.

## `complete_verified_payment`

1. Lock payment and wallet.
2. Exit safely if already credited.
3. Confirm expected amount and currency match verified data.
4. Mark payment successful.
5. Add package credits to wallet.
6. Update lifetime purchased.
7. Insert purchase ledger entry.
8. Set first successful payment timestamp if null.
9. Qualify and reward referral exactly once.
10. Insert referral ledger entry.
11. Mark payment credited.
12. Commit atomically.

## `admin_adjust_credits`

Require authorized role, amount, direction and mandatory reason. Lock wallet, update balance, insert ledger entry and insert admin audit log in one transaction.

---

# 7. Row Level Security

Enable RLS on every exposed table.

Authenticated users may:

- Read/update safe fields in their own profile.
- Read their own wallet, ledger, payments, jobs, referrals and notifications.
- Mark their notifications read.
- Read active public packages and presets.

Users may not directly:

- Update wallet balances.
- Insert payment success.
- Finalize/refund jobs.
- Grant referral rewards.
- Edit roles, settings or audit logs.

Admin authorization must be checked server-side and in database functions/policies. Use indexed policy columns and explicit checks such as:

```sql
(select auth.uid()) = user_id
```

Do not use editable user metadata as the source of truth for admin authorization. Never expose the Supabase secret/service key in browser code.

---

# 8. Authentication UI

Connect existing mockups.

Signup fields:

- Full name
- Email
- Password
- Confirm password
- Optional referral code
- Terms checkbox

Requirements:

- Client and server validation.
- CAPTCHA and rate limiting.
- Verification email.
- “Check your email” state.
- Preserve referral code through verification.
- One signup bonus only.
- Display bonus in credit history.

Add login, logout, forgot password, recovery callback, new-password screen and suspended-account screen.

---

# 9. Credits and referral rules

- Credits are integers.
- Frontend sends `preset_id`; server loads trusted cost.
- Show exact cost before generation.
- Reserve before RunPod submission.
- Finalize only on successful valid output.
- Refund on definitive failure, cancellation or timeout.
- Closing or refreshing the page does not cause a refund.
- Retries must not double-charge.
- Admin price changes affect future jobs only.

Wallet UI must show:

- Available credits
- Reserved credits
- Purchased credits
- Spent credits
- Bonus credits
- Refunded credits
- Buy Credits button
- Transaction history

Referral UI must show:

- Personal referral code
- Copyable URL such as `https://domain/signup?ref=ABC123`
- Total registrations
- Qualified referrals
- Pending referrals
- Rewarded referrals
- Total bonus credits earned
- Masked referred identity, date, status and reward amount

Reward the referrer only when the referred user completes their first verified successful payment. Prevent duplicate rewards, self-referrals, failed/test/reversed payment rewards and manual changes without audit logs.

---

# 10. Flutterwave integration

## `POST /api/billing/checkout`

1. Accept only `package_id`.
2. Load active package from database.
3. Read trusted price and credits from database.
4. Generate unique unpredictable `tx_ref`.
5. Create pending payment row.
6. Call Flutterwave server-side.
7. Return hosted checkout link.
8. Never trust amount or credits from browser input.

## `POST /api/webhooks/flutterwave`

- Read raw request body.
- Verify `flutterwave-signature` using HMAC-SHA256 and `FLW_SECRET_HASH`.
- Store an idempotent event record.
- Verify the transaction server-side with Flutterwave.
- Confirm status, transaction ID, `tx_ref`, exact expected amount, currency and customer relationship.
- Call `complete_verified_payment`.
- Handle duplicate webhooks without duplicate credits.
- Return HTTP 200 promptly after safe receipt/dispatch.
- Add a scheduled pending-payment reconciler.

The payment redirect page must never grant credits. It should display “Verifying payment” and query Morphly’s payment status until the verified webhook/reconciler finishes.

---

# 11. RunPod integration

Use asynchronous `/run`, not a long browser-held synchronous request.

## `POST /api/generations`

Authenticated browser body:

```json
{
  "preset_id": "uuid",
  "prompt": "A cinematic aerial shot of Lagos at sunset",
  "negative_prompt": "",
  "seed": 42,
  "client_request_id": "browser-generated-uuid"
}
```

Server workflow:

1. Authenticate user.
2. Confirm active account and maintenance mode off.
3. Validate prompt and selected active preset.
4. Enforce maximum active jobs.
5. Create job row and immutable request snapshot.
6. Reserve credits atomically.
7. Submit RunPod request server-side.
8. Store RunPod job ID.
9. Return Morphly job immediately.

Build this RunPod body for current text-to-video support:

```json
{
  "input": {
    "action": "text_to_video",
    "generation_id": "<Morphly generation UUID>",
    "user_id": "<authenticated user UUID>",
    "prompt": "<validated prompt>",
    "negative_prompt": "<validated optional negative prompt>",
    "width": 256,
    "height": 256,
    "frames": 9,
    "fps": 8,
    "seed": 42,
    "guidance_scale": 1,
    "inference_steps": 1
  },
  "webhook": "https://<domain>/api/webhooks/runpod?token=<RUNPOD_WEBHOOK_SECRET>",
  "policy": {
    "executionTimeout": 900000,
    "ttl": 3600000,
    "lowPriority": false
  }
}
```

Submit:

```text
POST https://api.runpod.ai/v2/{RUNPOD_ENDPOINT_ID}/run
Authorization: Bearer {RUNPOD_API_KEY}
Content-Type: application/json
```

Expected immediate response:

```json
{
  "id": "<runpod-job-id>",
  "status": "IN_QUEUE"
}
```

If reservation succeeds but RunPod submission fails before a valid job ID is stored, mark the job failed and refund atomically.

## `POST /api/webhooks/runpod`

- Require unguessable webhook token.
- Validate body.
- Confirm job ID belongs to a Morphly job.
- Do not trust callback output alone.
- Fetch authoritative status server-side:

```text
GET https://api.runpod.ai/v2/{RUNPOD_ENDPOINT_ID}/status/{RUNPOD_JOB_ID}
Authorization: Bearer {RUNPOD_API_KEY}
```

Map statuses:

| RunPod | Morphly |
|---|---|
| IN_QUEUE | queued |
| IN_PROGRESS / RUNNING | generating |
| COMPLETED | completed after output validation |
| FAILED | failed then refunded |
| CANCELLED | cancelled then refunded |
| TIMED_OUT | timed_out then refunded |

On completion, require valid output containing:

```json
{
  "success": true,
  "storage_bucket": "morphly-generated-videos",
  "storage_path": "generated/...mp4",
  "file_size_bytes": 31801,
  "width": 256,
  "height": 256,
  "frames": 9,
  "fps": 8,
  "seed": 42
}
```

Validate bucket, safe path, file size and metadata. Store output path and metrics. Finalize reserved credits only after valid success.

Calculate a clearly labelled estimate:

```text
estimated_gpu_cost_usd =
  (runpod_execution_ms / 3,600,000) * job_gpu_hourly_rate_usd
```

Do not present this estimate as the exact RunPod invoice.

## Polling fallback

Create:

```text
GET /api/generations/:id/status
```

- Authorize owner or admin.
- Return database state.
- If non-terminal and last check is old enough, query RunPod and reconcile.
- Rate-limit polling.
- Frontend polls every 8–15 seconds and stops on terminal states.
- Optionally subscribe to Supabase Realtime.
- Add scheduled reconciliation for abandoned jobs.

## Cancellation

Create:

```text
POST /api/generations/:id/cancel
```

Only owner/admin, only cancellable states, server-side RunPod cancel request, refund only after definitive cancellation.

---

# 12. Storage and signed URLs

Keep generated videos private.

Create:

```text
POST /api/generations/:id/signed-url
```

1. Authenticate user.
2. Confirm ownership of completed job or authorized admin access.
3. Read stored bucket/path.
4. Generate a fresh short-lived signed URL server-side.
5. Return URL and expiration.
6. Never allow a user to sign an arbitrary storage path.

Default signed URL TTL: 1 hour.

For future image-to-video/video-to-video, use a private input bucket, controlled signed upload flow, MIME/size restrictions and retention cleanup. Keep these modes disabled until the worker supports them.

Feature flags:

```text
text_to_video_enabled = true
image_to_video_enabled = false
video_to_video_enabled = false
```

---

# 13. User dashboard design

Preserve the current Morphly interface and design language.

Navigation:

- Create Video
- My Generations
- Credits & Billing
- Referrals
- Notifications
- Account Settings
- Help

Top bar:

- Logo
- Available credit balance
- Reserved-credit indicator when jobs are active
- Buy Credits
- Notifications
- User menu

## Create Video

- Mode selector
- Prompt textarea
- Optional negative prompt under Advanced
- Admin-controlled preset cards
- Duration, resolution and quality derived from preset
- Seed and randomize button
- Estimated waiting range
- Exact credit cost
- Remaining balance after reservation
- Generate button

Do not allow arbitrary unbenchmarked settings during beta.

Use `client_request_id` to prevent duplicate submissions. Show an insufficient-credit modal when necessary.

## Job card

Show:

- Prompt excerpt
- Preset and duration
- Status badge
- Honest status text
- Created time
- Estimated wait
- Credits reserved/charged/refunded
- Cancel or retry when valid
- Video when completed

User-facing messages:

```text
Queued — Your job is waiting for a GPU worker.
Preparing — A worker is loading the video model.
Generating — Morphly is creating your video.
Uploading — Your video is being saved securely.
Completed — Your video is ready.
Failed — Generation failed and your reserved credits were refunded.
Timed out — The job exceeded its limit and your reserved credits were refunded.
```

Do not fake exact percentages. Use stage-based or indeterminate progress unless the worker provides genuine progress updates.

## Gallery

- Responsive grid/list.
- Thumbnail/video.
- Prompt and date.
- Preset and duration.
- Download.
- Copy prompt.
- Reuse settings.
- Delete.
- Retention notice.
- Cursor pagination.

## Credits & Billing

Cards:

- Available
- Reserved
- Purchased
- Spent
- Bonuses
- Refunds

Sections:

- Credit packages
- Payment history
- Credit transaction ledger

## Referrals

Cards:

- Total invited
- Qualified
- Pending
- Rewarded
- Bonus credits earned

Include copy-link and sharing actions without exposing private referred-user information.

---

# 14. Admin dashboard design

Use the same Morphly dark design but with denser professional data presentation.

Sidebar:

- Overview
- Users
- Generations
- Payments
- Credit Ledger
- Packages
- Generation Presets
- Referrals
- Notifications
- Platform Health
- Settings
- Audit Logs

## Overview

Date filters: Today, 7 days, 30 days, 90 days, custom.

KPI cards:

- Verified gross revenue
- Estimated payment fees
- Estimated GPU cost
- Estimated gross profit
- Gross margin percentage
- Credits sold
- Credits consumed
- Outstanding available/reserved credits
- Bonus and refund credits
- New users
- Active users
- Paying users
- Signup-to-paid conversion
- Total/successful/failed generations
- Success rate
- Average queue delay
- Average execution time
- Estimated average cost per generation
- Revenue per paying user

Charts:

- Revenue vs estimated GPU cost vs estimated profit
- New users vs paid users
- Generations by status
- Credits purchased vs consumed
- Referral registrations vs paid conversions
- Generation volume by preset
- Queue and execution-time trend
- Failure reasons

Tables:

- Latest payments
- Latest failures
- Highest-spending users
- Users with highest unused credit balances
- Top referrers
- Abnormally long jobs

Clearly distinguish verified revenue, estimated costs, actual reconciled costs and unused-credit liability.

## User management

Search by name, email, ID, referral code, account status and paid status.

User details:

- Profile and status
- Available/reserved credits
- Lifetime purchased/spent/bonus/refunded
- Payments
- Credit ledger
- Generations
- Referral summary
- Referred users
- Admin notes and audit history

Actions:

- Add credits
- Deduct credits
- Suspend
- Reactivate
- View jobs/payments

Every financial/destructive action requires a confirmation, mandatory reason, server authorization, atomic function and audit log.

## Generation monitoring

Columns:

- Morphly job ID
- RunPod job ID
- User
- Prompt excerpt
- Preset
- Credits
- Status
- Queue delay
- Execution time
- Estimated GPU cost
- Worker ID
- Created/completed time
- Error summary

Actions:

- View timeline
- Reconcile status
- Cancel
- Retry
- Refund after policy check
- Generate signed URL
- Copy sanitized diagnostics

## Package management

Allow create/edit/archive/reorder/feature/activate. Never hard-delete a package referenced by payments.

## Preset management

Allow action, dimensions, frames, FPS, steps, guidance, credit cost, estimated time, feature flag and activation.

Display:

```text
Approximate duration = frames / fps
Estimated customer revenue per job
Estimated GPU cost per job
Estimated gross margin
```

Warn when configured price falls below an admin-defined minimum margin.

## Referral management

Show referrer, masked referred user, registration, qualifying payment, status, reward and suspicious patterns. Manual reward/reversal must be super-admin only and audited.

## Platform health

Show:

- Maintenance mode
- RunPod endpoint health
- Jobs queued/running/completed/failed
- Recent delay, execution and cold-start metrics when available
- Last successful generation
- Last webhooks and webhook failures
- Pending payment reconciliations
- Stuck jobs
- Storage usage when available
- Configured GPU hourly estimate

Controls:

- Toggle generation maintenance mode
- Disable presets
- Adjust max active jobs per user
- Trigger reconciliation
- Test endpoint health

Never place private API keys in client-visible settings.

---

# 15. Analytics definitions

```text
Verified revenue = successful non-reversed payments
Estimated GPU cost = sum of job estimated_gpu_cost_usd
Estimated gross profit = verified revenue - payment fees - estimated GPU cost - tracked direct costs
Generation success rate = completed terminal jobs / all terminal jobs
Signup-to-paid conversion = users with first successful payment / eligible registered users
Referral paid conversion = referred users with qualifying payment / referred registrations
Average queue delay = average runpod_delay_ms
Average execution time = average runpod_execution_ms
Credit utilization = credits consumed / credits granted
Outstanding credits = sum(available_credits + reserved_credits)
```

Do not silently mix NGN and USD. Store original currency and use stored exchange rates only when a combined report is intentionally produced.

---

# 16. Required API routes

```text
POST   /api/billing/checkout
GET    /api/billing/payments
GET    /api/wallet
GET    /api/wallet/transactions

POST   /api/generations
GET    /api/generations
GET    /api/generations/:id
GET    /api/generations/:id/status
POST   /api/generations/:id/cancel
POST   /api/generations/:id/retry
POST   /api/generations/:id/signed-url
DELETE /api/generations/:id

GET    /api/referrals/summary
GET    /api/referrals/list

POST   /api/webhooks/flutterwave
POST   /api/webhooks/runpod

GET    /api/admin/overview
GET    /api/admin/users
GET    /api/admin/users/:id
POST   /api/admin/users/:id/credit-adjustment
POST   /api/admin/users/:id/suspend
POST   /api/admin/users/:id/reactivate

GET    /api/admin/generations
GET    /api/admin/generations/:id
POST   /api/admin/generations/:id/reconcile
POST   /api/admin/generations/:id/cancel
POST   /api/admin/generations/:id/refund

GET    /api/admin/payments
POST   /api/admin/payments/:id/reconcile

GET    /api/admin/packages
POST   /api/admin/packages
PATCH  /api/admin/packages/:id

GET    /api/admin/presets
POST   /api/admin/presets
PATCH  /api/admin/presets/:id

GET    /api/admin/referrals
GET    /api/admin/health
GET    /api/admin/audit-logs
PATCH  /api/admin/settings
```

Response format:

```json
{
  "success": true,
  "data": {},
  "request_id": "uuid"
}
```

```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_CREDITS",
    "message": "You need 70 credits but have 50 available."
  },
  "request_id": "uuid"
}
```

Never return stack traces, SQL, private keys or sensitive provider payloads to the browser.

---

# 17. Validation, abuse prevention and idempotency

Validate prompts, preset IDs, allowed actions, seed ranges, UUIDs, files, pagination, admin reasons and webhook payloads.

Rate-limit signup, login, password reset, checkout, generation, status polling, referral validation, signed URLs and admin endpoints.

Generation protections:

- Maximum active jobs per user.
- Maintenance mode.
- Suspended-user blocking.
- Insufficient-credit blocking.
- Duplicate `client_request_id` blocking.
- Prompt moderation hook.
- Input-size limits.

Use idempotency keys:

```text
signup-bonus:{user_id}
payment-credit:{payment_id}
referral-reward:{referral_id}
generation-reserve:{generation_id}
generation-charge:{generation_id}
generation-refund:{generation_id}
admin-adjustment:{request_uuid}
```

Add scheduled reconciliation for pending payments, stuck jobs, missed RunPod webhooks, orphaned reservations and qualified-but-unrewarded referrals.

---

# 18. Notifications

Create in-app notifications for:

- Welcome/signup bonus
- Payment successful/failed
- Low credits
- Generation completed
- Generation failed/refunded
- Referral qualified/rewarded
- Account suspended/reactivated
- Video approaching deletion

Email delivery must not block core database transactions.

---

# 19. Testing requirements

Database tests:

- Signup bonus granted once.
- Duplicate bootstrap cannot duplicate bonus.
- Insufficient balance cannot reserve.
- Concurrent jobs cannot overspend one wallet.
- Completed job finalizes once.
- Failed job refunds once.
- Duplicate payment webhook credits once.
- Referral reward only on first verified successful payment.
- Self-referral blocked.
- Suspended user cannot generate.
- User cannot access another user’s data.
- User cannot write wallet balance.
- Admin adjustment creates ledger and audit records.

API tests:

- Private keys remain server-only.
- Duplicate client request returns existing job.
- RunPod submission failure refunds.
- Invalid RunPod webhook token is rejected.
- Completion webhook is verified through RunPod status.
- Signed URL rejects non-owner.
- Unsupported/disabled modes are blocked.

End-to-end tests:

1. Signup and email verification.
2. Signup bonus appears.
3. Referral relationship is recorded.
4. Preview generation reserves credits.
5. Queued/generating status displays.
6. Completion finalizes credits and video plays.
7. Failure refunds credits.
8. Package purchase credits wallet once.
9. Referrer receives reward once.
10. Admin can inspect analytics and adjust credits.
11. Suspended user is blocked.

Mock provider requests in automated tests. Do not spend real RunPod funds during the normal test suite.

---

# 20. Required deliverables

Create/update:

```text
.env.example
README.md
docs/architecture.md
docs/database.md
docs/runpod-integration.md
docs/flutterwave-integration.md
docs/admin-dashboard.md
docs/deployment-checklist.md

supabase/migrations/<timestamp>_morphly_core.sql
supabase/migrations/<timestamp>_morphly_rls.sql
supabase/migrations/<timestamp>_morphly_functions.sql
supabase/seed.sql

src/lib/supabase/client.*
src/lib/supabase/server.*
src/lib/env.*
src/lib/auth.*
src/lib/credits.*
src/lib/runpod.*
src/lib/flutterwave.*
src/lib/validation.*
src/lib/admin.*
src/lib/analytics.*

app/api/... or framework-equivalent server routes
```

Also provide:

- Generated database types.
- Route map.
- Migration execution order.
- Setup commands.
- Supabase settings.
- Flutterwave webhook URL.
- RunPod webhook URL.
- Local test instructions.
- Production deployment checklist.
- List of unfinished worker modes behind feature flags.

---

# 21. Definition of done

The project is complete only when:

- Existing design remains intact.
- Auth and password recovery work.
- Signup bonus is granted once.
- Referral relationship is secure.
- Verified payments credit once.
- Referral reward occurs once after first verified purchase.
- Wallet and ledger reconcile.
- Private keys are server-only.
- Generation price is calculated server-side.
- Credits reserve before RunPod submission.
- RunPod uses asynchronous `/run`.
- User sees queued and generating states.
- Webhook and status fallback work.
- Success stores bucket/path and finalizes credits.
- Failure/cancellation/timeout refunds automatically.
- User receives fresh authorized signed video URLs.
- Admin can inspect users, credits, jobs, payments, referrals, packages, presets, settings, health and logs.
- Analytics use real data.
- Critical operations are idempotent.
- RLS prevents cross-user access.
- Automated tests cover authorization, credits, payments, referrals and generation.

---

# 22. Non-negotiable prohibitions

Do not:

- Expose RunPod, Flutterwave secret or Supabase secret/service credentials in browser code.
- Let the frontend directly modify credits.
- Trust client-supplied amount, credit cost, package credits or user ID.
- Grant payment credits from redirect parameters.
- Grant referral credits at signup.
- Store permanent public video URLs.
- Mark jobs complete without output validation.
- Delete ledger/audit records to fix balances.
- Authorize admins only through frontend email checks.
- Enable unsupported video modes.
- Fake progress percentages.
- Replace the existing design unnecessarily.
- Run destructive migrations without rollback planning.
- Silently swallow errors.

---

# 23. Execution instruction

First inspect the existing repository and produce a concise plan referencing the actual files that will change. Then implement Phase 1 and Phase 2 completely, run tests and report exact files changed. Continue phase by phase without skipping migrations, RLS, security, idempotency or tests.

When an assumption conflicts with the existing repository, preserve the product requirements and adapt the file structure instead of rebuilding the application from scratch.
