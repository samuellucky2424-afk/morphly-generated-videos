import { env } from '@/src/lib/env';
import {
  validateCompletionTiming,
  type CompletionTimingValidation,
} from '@/src/lib/generation-timing';
import {
  getRunPodJobStatus,
  type RunPodStatusResponse,
} from '@/src/lib/runpod';
import { createAdminClient } from '@/src/lib/supabase/admin';

type AdminClient = ReturnType<typeof createAdminClient>;

export type ReconciliableGenerationJob = {
  fps: number;
  frames: number;
  id: string;
  prompt: string;
  requested_duration_seconds: number;
  runpod_job_id: string | null;
  started_at: string | null;
  status: string;
  submitted_at: string | null;
  user_id: string;
};

const TERMINAL_STATUSES = new Set([
  'completed',
  'failed',
  'cancelled',
  'timed_out',
]);

function normalizeOutputLocation(value: string) {
  if (!value.startsWith('http://') && !value.startsWith('https://')) {
    const normalized = value.replace(/^\/+/, '');
    const bucketPrefix = `${env.SUPABASE_VIDEO_BUCKET}/`;
    return normalized.startsWith(bucketPrefix)
      ? normalized.slice(bucketPrefix.length)
      : normalized;
  }

  try {
    const url = new URL(value);
    const match = url.pathname.match(
      /^\/storage\/v1\/object\/(?:sign|public|authenticated)\/([^/]+)\/(.+)$/,
    );
    if (match?.[1] === env.SUPABASE_VIDEO_BUCKET) {
      return decodeURIComponent(match[2]);
    }
  } catch {
    // Keep a valid external provider URL unchanged.
  }

  return value;
}

export function extractOutputLocation(value: unknown): string | null {
  if (typeof value === 'string') {
    const candidate = value.trim();
    if (
      candidate.startsWith('https://') ||
      candidate.startsWith('http://') ||
      /^[A-Za-z0-9_./-]+\.(?:mp4|mov|webm)(?:\?.*)?$/i.test(candidate)
    ) {
      return normalizeOutputLocation(candidate);
    }
    return null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const location = extractOutputLocation(item);
      if (location) return location;
    }
    return null;
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    for (const key of [
      'url',
      'video_url',
      'video',
      'storage_path',
      'file_path',
      'path',
      'file',
      'output',
    ]) {
      const location = extractOutputLocation(record[key]);
      if (location) return location;
    }
  }

  return null;
}

async function findStoredOutput(
  admin: AdminClient,
  userId: string,
  generationId: string,
  runpodJobId: string | null,
) {
  const directories = [
    `generation-outputs/${userId}/${generationId}`,
    `generation-outputs/${generationId}`,
    `generated/${generationId}`,
  ];
  if (runpodJobId) {
    directories.push(
      `generation-outputs/${runpodJobId}`,
      `outputs/${runpodJobId}`,
      `generated/${runpodJobId}`,
      `generated`,
    );
  }

  for (const directory of directories) {
    const { data, error } = await admin.storage
      .from(env.SUPABASE_VIDEO_BUCKET)
      .list(directory, {
        limit: 20,
        sortBy: { column: 'updated_at', order: 'desc' },
      });

    if (error) {
      throw error;
    }

    const output = data?.find((entry) => {
      const size = Number(entry.metadata?.size);
      return (
        entry.id !== null &&
        Number.isFinite(size) &&
        size > 0 &&
        /\.(?:mp4|mov|webm)$/i.test(entry.name)
      );
    });
    if (output) {
      return `${directory}/${output.name}`;
    }
  }

  return null;
}

async function createNotificationOnce(
  admin: AdminClient,
  {
    generationId,
    message,
    title,
    type,
    userId,
  }: {
    generationId: string;
    message: string;
    title: string;
    type: string;
    userId: string;
  },
) {
  const { count } = await admin
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('type', type)
    .contains('metadata', { generation_id: generationId });

  if ((count ?? 0) > 0) return;

  await admin.from('notifications').insert({
    user_id: userId,
    type,
    title,
    message,
    action_url: '/?view=dashboard&section=videos',
    metadata: { generation_id: generationId },
  });
}

function safeProgress(value: unknown, fallback: number) {
  const progress = Number(value);
  return Number.isFinite(progress)
    ? Math.max(0, Math.min(100, Math.round(progress)))
    : fallback;
}

async function applyCompletedStatus(
  admin: AdminClient,
  job: ReconciliableGenerationJob,
  provider: RunPodStatusResponse | null,
  outputLocation: string,
) {
  const timingValidation = validateCompletionTiming({
    expectedFps: Number(job.fps),
    expectedFrames: Number(job.frames),
    expectedRequestedDurationSeconds: Number(
      job.requested_duration_seconds,
    ),
    output: provider?.output,
  });

  if (!timingValidation.ok) {
    await applyInvalidCompletionTiming(
      admin,
      job,
      provider,
      timingValidation,
    );
    return;
  }

  const now = new Date().toISOString();
  const timing = timingValidation.metadata;
  const { error: updateError } = await admin
    .from('generation_jobs')
    .update({
      actual_duration_seconds: timing.actualDurationSeconds,
      requested_duration_seconds: timing.requestedDurationSeconds,
      output_fps: timing.fps,
      output_frames: timing.frames,
      runpod_status: provider?.status?.toUpperCase() || 'COMPLETED',
      output_storage_path: normalizeOutputLocation(outputLocation),
      runpod_execution_ms: provider?.executionTime ?? null,
      runpod_delay_ms: provider?.delayTime ?? null,
      runpod_worker_id: provider?.workerId ?? null,
      progress_percent: 100,
      last_runpod_check_at: now,
      updated_at: now,
    })
    .eq('id', job.id)
    .eq('user_id', job.user_id);

  if (updateError) {
    throw updateError;
  }

  const { error: finalizeError } = await admin.rpc(
    'finalize_generation_charge',
    { p_generation_id: job.id },
  );
  if (finalizeError) {
    throw finalizeError;
  }

  await createNotificationOnce(admin, {
    generationId: job.id,
    userId: job.user_id,
    type: 'generation_completed',
    title: 'Your video is ready',
    message: job.prompt.slice(0, 140),
  });
}

async function applyInvalidCompletionTiming(
  admin: AdminClient,
  job: ReconciliableGenerationJob,
  provider: RunPodStatusResponse | null,
  validation: Exclude<CompletionTimingValidation, { ok: true }>,
) {
  console.warn(
    `Generation ${job.id} failed completion timing validation: ${validation.reason}`,
    validation.metadata,
  );

  const { error: refundError } = await admin.rpc(
    'refund_generation_reservation',
    {
      p_generation_id: job.id,
      p_terminal_status: 'failed',
    },
  );

  if (refundError) {
    throw refundError;
  }

  const now = new Date().toISOString();
  const timing = validation.metadata;
  const { error: updateError } = await admin
    .from('generation_jobs')
    .update({
      actual_duration_seconds:
        timing?.actualDurationSeconds ?? null,
      error_code: validation.reason,
      error_message:
        validation.reason === 'actual-duration-mismatch'
          ? `The generated MP4 duration (${timing?.actualDurationSeconds.toFixed(3)}s) did not match the requested duration (${job.requested_duration_seconds}s).`
          : 'The render provider returned incomplete or inconsistent video timing metadata.',
      output_fps: timing?.fps ?? null,
      output_frames: timing?.frames ?? null,
      progress_percent: 0,
      requested_duration_seconds: Number(
        job.requested_duration_seconds,
      ),
      runpod_delay_ms: provider?.delayTime ?? null,
      runpod_execution_ms: provider?.executionTime ?? null,
      runpod_status: 'COMPLETED_DURATION_INVALID',
      runpod_worker_id: provider?.workerId ?? null,
      last_runpod_check_at: now,
      updated_at: now,
    })
    .eq('id', job.id)
    .eq('user_id', job.user_id);

  if (updateError) {
    throw updateError;
  }

  await createNotificationOnce(admin, {
    generationId: job.id,
    userId: job.user_id,
    type: 'generation_failed',
    title: 'Video duration validation failed',
    message: 'The generated video did not match the requested duration. Reserved credits were returned.',
  });
}

async function applyFailedStatus(
  admin: AdminClient,
  job: ReconciliableGenerationJob,
  provider: RunPodStatusResponse,
) {
  const providerStatus = provider.status.toUpperCase();
  const terminalStatus =
    providerStatus === 'CANCELLED'
      ? 'cancelled'
      : providerStatus === 'TIMED_OUT'
        ? 'timed_out'
        : 'failed';

  const { error: refundError } = await admin.rpc(
    'refund_generation_reservation',
    {
      p_generation_id: job.id,
      p_terminal_status: terminalStatus,
    },
  );
  if (refundError) {
    throw refundError;
  }

  await admin
    .from('generation_jobs')
    .update({
      runpod_status: providerStatus,
      error_message:
        typeof provider.error === 'string'
          ? provider.error.slice(0, 500)
          : providerStatus === 'TIMED_OUT'
            ? 'The render exceeded its processing time limit.'
            : providerStatus === 'CANCELLED'
              ? 'The render was cancelled.'
              : 'The render provider could not complete this video.',
      progress_percent: 0,
      last_runpod_check_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', job.id)
    .eq('user_id', job.user_id);

  await createNotificationOnce(admin, {
    generationId: job.id,
    userId: job.user_id,
    type: 'generation_failed',
    title:
      providerStatus === 'CANCELLED'
        ? 'Render cancelled'
        : 'Render did not complete',
    message: 'Reserved credits were returned to your wallet.',
  });
}

export async function reconcileGenerationJob(
  admin: AdminClient,
  job: ReconciliableGenerationJob,
) {
  if (TERMINAL_STATUSES.has(job.status)) return;

  let provider: RunPodStatusResponse | null = null;
  if (job.runpod_job_id) {
    try {
      provider = await getRunPodJobStatus(job.runpod_job_id);
    } catch (error) {
      console.error(`RunPod status check failed for ${job.id}:`, error);
    }
  }

  let storedOutput: string | null = null;
  try {
    storedOutput = await findStoredOutput(
      admin,
      job.user_id,
      job.id,
      job.runpod_job_id,
    );
  } catch (error) {
    console.error(`Stored output check failed for ${job.id}:`, error);
  }

  const providerStatus = provider?.status?.toUpperCase() ?? '';
  const providerOutput = extractOutputLocation(provider?.output);
  if (
    providerStatus === 'COMPLETED' &&
    (providerOutput || storedOutput)
  ) {
    await applyCompletedStatus(
      admin,
      job,
      provider,
      providerOutput ?? storedOutput!,
    );
    return;
  }

  if (['FAILED', 'CANCELLED', 'TIMED_OUT'].includes(providerStatus) && provider) {
    await applyFailedStatus(admin, job, provider);
    return;
  }

  if (!provider || !providerStatus) {
    await admin
      .from('generation_jobs')
      .update({ last_runpod_check_at: new Date().toISOString() })
      .eq('id', job.id)
      .eq('user_id', job.user_id);
    return;
  }

  const now = new Date().toISOString();
  const processing = ['IN_PROGRESS', 'RUNNING'].includes(providerStatus);
  const awaitingOutput = providerStatus === 'COMPLETED';
  const update: Record<string, unknown> = {
    runpod_status: providerStatus,
    status: processing || awaitingOutput ? 'processing' : 'queued',
    progress_percent: safeProgress(
      provider.progress,
      awaitingOutput ? 99 : processing ? 5 : 1,
    ),
    runpod_execution_ms: provider.executionTime ?? null,
    runpod_delay_ms: provider.delayTime ?? null,
    runpod_worker_id: provider.workerId ?? null,
    last_runpod_check_at: now,
    updated_at: now,
  };
  if (processing && !job.started_at) {
    update.started_at = now;
  }

  await admin
    .from('generation_jobs')
    .update(update)
    .eq('id', job.id)
    .eq('user_id', job.user_id);
}
