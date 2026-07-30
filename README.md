# Morphly LTX 2.3

Morphly is a full-stack AI video studio for text-to-video, image-to-video, and
video-to-video generation. The production application uses Next.js/Vinext,
Supabase Auth/Postgres/Storage, RunPod Serverless, and Flutterwave.

## User dashboard

The authenticated studio includes:

- configurable preset, resolution, duration, frame rate, seed, and negative prompt controls;
- private image/video uploads with signed URLs, size checks, and file-signature verification;
- server-calculated credit estimates and atomic credit reservation/refund;
- asynchronous RunPod submission, progress polling, cancellation, and webhook completion;
- real generated-video, source-asset, billing, transaction, notification, profile, and password views.

## Production setup

1. Create a Supabase project and run the migrations in
   [`supabase/migrations`](supabase/migrations) in numeric order. Existing
   installations that already ran `0001` through `0005` only need
   `0006_functional_creator_dashboard.sql`.
2. Add the values from [`.env.example`](.env.example) to the deployment
   environment. Set `APP_URL=https://ai.morphly.fun` in production. Set
   `GEMINI_API_KEY` to a Google AI Studio API key; `GEMINI_MODEL` defaults to
   the current production model shown in `.env.example`.
3. In Supabase Auth, add `https://ai.morphly.fun/api/auth/callback` to the
   allowed redirect URLs. Configure Google as an optional OAuth provider.
4. Configure the RunPod endpoint worker to accept the input contract below.
   Morphly supplies the per-job webhook URL automatically.
5. Configure Flutterwave keys and the existing
   `https://ai.morphly.fun/api/webhooks/flutterwave` webhook.

The RunPod webhook base route is:

```text
https://ai.morphly.fun/api/webhooks/runpod
```

Do not paste a static secret into RunPod. The server appends a job ID and the
`RUNPOD_WEBHOOK_SECRET` to each submitted job URL.

## RunPod worker input

Each asynchronous request contains an `input` object with:

```json
{
  "mode": "text_to_video | image_to_video | video_to_video",
  "prompt": "string",
  "negative_prompt": "string",
  "num_frames": 121,
  "width": 768,
  "height": 432,
  "fps": 24,
  "duration_seconds": 5,
  "num_inference_steps": 20,
  "guidance_scale": 5,
  "seed": 123456,
  "image": "signed URL for image-to-video",
  "video": "signed URL for video-to-video"
}
```

On success, the worker output must include an HTTP(S) video URL, either directly
or under `url`, `video_url`, `video`, or `output`.

## Local validation

Requires Node.js `>=22.13.0` and Git Bash on Windows:

```bash
npm ci
npm run lint
npm test
npm run validate:artifact
```

The admin portal is available at `/admin/login`. Access is authorized
server-side from `ADMIN_EMAILS`; never expose the Supabase service key, RunPod
key, or Flutterwave secret to browser code.
