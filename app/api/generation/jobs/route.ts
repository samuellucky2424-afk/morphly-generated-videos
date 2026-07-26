import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { AuthenticationRequiredError, requireApiUser } from '@/src/lib/auth';
import { env } from '@/src/lib/env';
import {
  calculateFrameCount,
  calculateGenerationCost,
  DURATION_OPTION_IDS,
  GENERATION_MODES,
  getResolution,
  resolveDurationOption,
  RESOLUTION_OPTIONS,
} from '@/src/lib/generation-config';
import { reconcileGenerationJob } from '@/src/lib/generation-reconciliation';
import { submitRunPodJob } from '@/src/lib/runpod';
import { createAdminClient } from '@/src/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const generationSchema = z.object({
  clientRequestId: z.uuid(),
  durationOption: z.enum(DURATION_OPTION_IDS).optional(),
  durationSeconds: z.number().int().optional(),
  mode: z.enum(GENERATION_MODES),
  negativePrompt: z.string().trim().max(1200).optional(),
  presetId: z.uuid(),
  prompt: z.string().trim().min(3).max(1200),
  resolutionKey: z.enum(RESOLUTION_OPTIONS.map((option) => option.key) as [
    (typeof RESOLUTION_OPTIONS)[number]['key'],
    ...(typeof RESOLUTION_OPTIONS)[number]['key'][],
  ]),
  seed: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).nullable().optional(),
  sourceAssetId: z.uuid().nullable().optional(),
});

function isTrustedOrigin(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (!origin) {
    return true;
  }

  try {
    const allowed = new Set([
      new URL(request.url).origin,
      new URL(env.APP_URL).origin,
    ]);
    return allowed.has(new URL(origin).origin);
  } catch {
    return false;
  }
}

async function serializeJob(
  admin: ReturnType<typeof createAdminClient>,
  job: Record<string, unknown> & { output_storage_path?: string | null },
) {
  let outputUrl: string | null = null;
  const outputPath = job.output_storage_path;

  if (outputPath?.startsWith('https://') || outputPath?.startsWith('http://')) {
    outputUrl = outputPath;
  } else if (outputPath) {
    const { data } = await admin.storage
      .from(env.SUPABASE_VIDEO_BUCKET)
      .createSignedUrl(outputPath, 60 * 60);
    outputUrl = data?.signedUrl ?? null;
  }

  return {
    ...job,
    actual_duration_seconds:
      job.actual_duration_seconds === null ||
      job.actual_duration_seconds === undefined
        ? null
        : Number(job.actual_duration_seconds),
    credit_cost: Number(job.credit_cost ?? 0),
    duration_seconds: Number(job.duration_seconds ?? 0),
    fps: Number(job.fps ?? 0),
    frames: Number(job.frames ?? 0),
    height: Number(job.height ?? 0),
    output_fps:
      job.output_fps === null || job.output_fps === undefined
        ? null
        : Number(job.output_fps),
    output_frames:
      job.output_frames === null || job.output_frames === undefined
        ? null
        : Number(job.output_frames),
    progress_percent: Number(job.progress_percent ?? 0),
    runpod_delay_ms:
      job.runpod_delay_ms === null || job.runpod_delay_ms === undefined
        ? null
        : Number(job.runpod_delay_ms),
    runpod_execution_ms:
      job.runpod_execution_ms === null || job.runpod_execution_ms === undefined
        ? null
        : Number(job.runpod_execution_ms),
    requested_duration_seconds: Number(
      job.requested_duration_seconds ?? job.duration_seconds ?? 0,
    ),
    seed: job.seed === null || job.seed === undefined ? null : Number(job.seed),
    width: Number(job.width ?? 0),
    output_url: outputUrl,
  };
}

export async function GET() {
  try {
    const user = await requireApiUser();
    const admin = createAdminClient();

    const { data: activeJobs, error: activeJobsError } = await admin
      .from('generation_jobs')
      .select(
        'id,user_id,status,prompt,runpod_job_id,submitted_at,started_at,requested_duration_seconds,frames,fps',
      )
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .in('status', ['created', 'reserving', 'queued', 'processing'])
      .limit(2);

    if (activeJobsError) {
      throw activeJobsError;
    }

    await Promise.allSettled(
      (activeJobs ?? []).map((job) => reconcileGenerationJob(admin, job)),
    );

    const { data, error } = await admin
      .from('generation_jobs')
      .select(
        'id,preset_id,action,title,prompt,negative_prompt,status,progress_percent,credit_cost,source_asset_id,output_storage_path,error_message,created_at,submitted_at,started_at,completed_at,duration_seconds,requested_duration_seconds,actual_duration_seconds,fps,width,height,frames,output_fps,output_frames,seed,aspect_ratio,runpod_delay_ms,runpod_execution_ms,request_snapshot,generation_presets(name,slug)',
      )
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      throw error;
    }

    const jobs = await Promise.all(
      (data ?? []).map((job) => serializeJob(admin, job)),
    );

    return NextResponse.json(jobs, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error: unknown) {
    if (error instanceof AuthenticationRequiredError) {
      return NextResponse.json(
        { error: 'Sign in to view generation jobs.' },
        { status: 401 },
      );
    }

    console.error('Generation job request failed:', error);
    return NextResponse.json(
      { error: 'Generation jobs could not be loaded.' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!isTrustedOrigin(request)) {
      return NextResponse.json({ error: 'Request origin is not allowed.' }, { status: 403 });
    }

    const user = await requireApiUser();
    const parsed = generationSchema.safeParse(await request.json().catch(() => null));

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Check the prompt and generation settings, then try again.' },
        { status: 400 },
      );
    }

    const input = parsed.data;
    const durationOption = resolveDurationOption(input);
    if (!durationOption) {
      return NextResponse.json(
        {
          error:
            'Choose one of the available duration options: 4, 8, or 10 seconds.',
        },
        { status: 400 },
      );
    }

    const admin = createAdminClient();
    const { data: existingJob, error: existingError } = await admin
      .from('generation_jobs')
      .select('id,runpod_job_id,status')
      .eq('user_id', user.id)
      .eq('client_request_id', input.clientRequestId)
      .maybeSingle();

    if (existingError) {
      throw existingError;
    }

    if (existingJob) {
      return NextResponse.json(
        {
          job_id: existingJob.id,
          runpod_job_id: existingJob.runpod_job_id,
          status: existingJob.status,
          duplicate: true,
        },
        { status: 202 },
      );
    }

    const { count: activeJobCount, error: activeJobError } = await admin
      .from('generation_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .in('status', ['created', 'reserving', 'queued', 'processing']);

    if (activeJobError) {
      throw activeJobError;
    }

    if ((activeJobCount ?? 0) >= 2) {
      return NextResponse.json(
        { error: 'You already have two active renders. Wait for one to finish.' },
        { status: 429 },
      );
    }

    const { data: preset, error: presetError } = await admin
      .from('generation_presets')
      .select('*')
      .eq('id', input.presetId)
      .eq('is_active', true)
      .eq('is_public', true)
      .single();

    if (presetError || !preset || preset.action !== input.mode) {
      return NextResponse.json(
        { error: 'The selected preset is not available for this mode.' },
        { status: 400 },
      );
    }

    const resolution = getResolution(input.resolutionKey);
    const presetFps = Number(preset.fps);
    const creditCost = calculateGenerationCost({
      mode: input.mode,
      presetSlug: preset.slug,
      resolutionKey: input.resolutionKey,
      durationSeconds: durationOption?.seconds ?? 0,
      fps: presetFps,
    });

    if (
      !resolution ||
      !durationOption ||
      !Number.isInteger(presetFps) ||
      presetFps <= 0 ||
      presetFps > 60 ||
      resolution.width % 64 !== 0 ||
      resolution.height % 64 !== 0 ||
      !creditCost
    ) {
      return NextResponse.json(
        { error: 'The selected generation configuration is unavailable.' },
        { status: 400 },
      );
    }

    let sourceAsset: {
      bucket: string;
      id: string;
      kind: string;
      storage_path: string;
    } | null = null;
    let sourceUrl: string | null = null;

    if (input.mode !== 'text_to_video') {
      if (!input.sourceAssetId) {
        return NextResponse.json(
          {
            error:
              input.mode === 'image_to_video'
                ? 'Upload or select a source image.'
                : 'Upload or select a source video.',
          },
          { status: 400 },
        );
      }

      const { data, error } = await admin
        .from('assets')
        .select('id,bucket,storage_path,kind')
        .eq('id', input.sourceAssetId)
        .eq('user_id', user.id)
        .eq('status', 'ready')
        .is('deleted_at', null)
        .single();

      const expectedKind =
        input.mode === 'image_to_video' ? 'source_image' : 'source_video';
      if (error || !data || data.kind !== expectedKind) {
        return NextResponse.json(
          { error: 'The selected source asset is not available for this mode.' },
          { status: 400 },
        );
      }

      sourceAsset = data;
      const { data: signedSource, error: signedSourceError } = await admin.storage
        .from(data.bucket)
        .createSignedUrl(data.storage_path, 60 * 60);

      if (signedSourceError || !signedSource?.signedUrl) {
        return NextResponse.json(
          { error: 'The source asset could not be prepared for generation.' },
          { status: 500 },
        );
      }

      sourceUrl = signedSource.signedUrl;
    }

    const frames = calculateFrameCount(durationOption.seconds, presetFps);
    const seed = input.seed ?? Math.floor(Math.random() * 2_147_483_647);
    const idempotencyKey = `gen-reserve:${input.clientRequestId}`;
    const { data: job, error: jobError } = await admin
      .from('generation_jobs')
      .insert({
        user_id: user.id,
        preset_id: preset.id,
        action: input.mode,
        title: input.prompt.slice(0, 80),
        prompt: input.prompt,
        negative_prompt: input.negativePrompt || null,
        source_asset_id: sourceAsset?.id ?? null,
        source_asset_path: sourceAsset?.storage_path ?? null,
        credit_cost: creditCost,
        client_request_id: input.clientRequestId,
        model: 'ltx-2.3',
        aspect_ratio: resolution.aspectRatio,
        duration_seconds: durationOption.seconds,
        requested_duration_seconds: durationOption.seconds,
        fps: presetFps,
        width: resolution.width,
        height: resolution.height,
        frames,
        seed,
        request_snapshot: {
          mode: input.mode,
          preset: {
            id: preset.id,
            name: preset.name,
            slug: preset.slug,
            inference_steps: preset.inference_steps,
            guidance_scale: preset.guidance_scale,
          },
          configuration: {
            resolution_key: input.resolutionKey,
            aspect_ratio: resolution.aspectRatio,
            duration_option: durationOption.id,
            duration_seconds: durationOption.seconds,
            requested_duration_seconds: durationOption.seconds,
            fps: presetFps,
            width: resolution.width,
            height: resolution.height,
            frames,
            seed,
          },
        },
      })
      .select('id')
      .single();

    if (jobError || !job) {
      console.error('Generation job creation failed:', jobError);
      return NextResponse.json(
        { error: 'The generation job could not be created.' },
        { status: 500 },
      );
    }

    const { error: reserveError } = await admin.rpc('reserve_generation_credits', {
      p_user_id: user.id,
      p_generation_id: job.id,
      p_required_credits: creditCost,
      p_idempotency_key: idempotencyKey,
    });

    if (reserveError) {
      await admin
        .from('generation_jobs')
        .update({
          status: 'failed',
          error_message: reserveError.message.includes('Insufficient')
            ? 'Insufficient credits'
            : 'Credits could not be reserved',
          failed_at: new Date().toISOString(),
        })
        .eq('id', job.id)
        .eq('user_id', user.id);

      return NextResponse.json(
        {
          error: reserveError.message.includes('Insufficient')
            ? 'You do not have enough credits for this render.'
            : 'Credits could not be reserved for this render.',
        },
        { status: reserveError.message.includes('Insufficient') ? 402 : 409 },
      );
    }

    try {
      const runpodResponse = await submitRunPodJob(job.id, {
        mode: input.mode,
        prompt: input.prompt,
        negative_prompt: input.negativePrompt || '',
        frames,
        width: resolution.width,
        height: resolution.height,
        fps: presetFps,
        requested_duration_seconds: durationOption.seconds,
        num_inference_steps: Number(preset.inference_steps),
        guidance_scale: Number(preset.guidance_scale),
        seed,
        image_path:
          input.mode === 'image_to_video' ? sourceUrl ?? undefined : undefined,
        video_path:
          input.mode === 'video_to_video' ? sourceUrl ?? undefined : undefined,
        job_id: job.id,
        user_id: user.id,
        output_bucket: env.SUPABASE_VIDEO_BUCKET,
        output_path: `generation-outputs/${user.id}/${job.id}/output.mp4`,
      });

      const { error: updateError } = await admin
        .from('generation_jobs')
        .update({
          runpod_job_id: runpodResponse.id,
          runpod_status: runpodResponse.status,
          runpod_endpoint_id: env.RUNPOD_ENDPOINT_ID,
          status: 'processing',
          progress_percent: 1,
          submitted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', job.id)
        .eq('user_id', user.id);

      if (updateError) {
        throw updateError;
      }

      return NextResponse.json(
        {
          job_id: job.id,
          runpod_job_id: runpodResponse.id,
          status: 'processing',
          credit_cost: creditCost,
          fps: presetFps,
          frames,
          requested_duration_seconds: durationOption.seconds,
        },
        { status: 202, headers: { 'Cache-Control': 'no-store' } },
      );
    } catch (runpodError) {
      console.error('RunPod submission failed:', runpodError);
      await admin.rpc('refund_generation_reservation', {
        p_generation_id: job.id,
        p_terminal_status: 'failed',
      });
      await admin
        .from('generation_jobs')
        .update({
          error_message: 'The render provider could not accept the job.',
          failed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', job.id)
        .eq('user_id', user.id);

      return NextResponse.json(
        { error: 'The render provider was unavailable. Reserved credits were refunded.' },
        { status: 502 },
      );
    }
  } catch (error: unknown) {
    if (error instanceof AuthenticationRequiredError) {
      return NextResponse.json(
        { error: 'Sign in to generate a video.' },
        { status: 401 },
      );
    }

    console.error('Generation submission failed:', error);
    return NextResponse.json(
      { error: 'The generation request could not be submitted.' },
      { status: 500 },
    );
  }
}
