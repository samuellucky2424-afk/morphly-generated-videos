import { NextResponse } from 'next/server';
import { env } from '@/src/lib/env';
import {
  extractOutputLocation,
  reconcileGenerationJob,
} from '@/src/lib/generation-reconciliation';
import { validateCompletionTiming } from '@/src/lib/generation-timing';
import { createAdminClient } from '@/src/lib/supabase/admin';

export const dynamic = 'force-dynamic';

type RunPodPayload = {
  delayTime?: number;
  error?: string;
  executionTime?: number;
  id?: string;
  output?: unknown;
  progress?: number;
  status?: string;
  workerId?: string;
};

function safeProgress(value: unknown, fallback: number) {
  const progress = Number(value);
  return Number.isFinite(progress)
    ? Math.max(0, Math.min(100, Math.round(progress)))
    : fallback;
}

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');
    const secret = searchParams.get('secret');

    if (!jobId || !secret) {
      return new NextResponse('Missing webhook credentials', { status: 400 });
    }

    if (secret !== env.RUNPOD_WEBHOOK_SECRET) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const payload = (await request.json()) as RunPodPayload;
    const status = String(payload.status ?? '').toUpperCase();
    if (!status) {
      return new NextResponse('Missing job status', { status: 400 });
    }

    const admin = createAdminClient();
    const { data: job, error: jobError } = await admin
      .from('generation_jobs')
      .select(
        'id,user_id,status,prompt,runpod_job_id,submitted_at,started_at,requested_duration_seconds,frames,fps',
      )
      .eq('id', jobId)
      .single();

    if (jobError || !job) {
      return new NextResponse('Generation not found', { status: 404 });
    }

    await admin.from('generation_events').insert({
      generation_id: jobId,
      event_type: status.toLowerCase(),
      from_status: job.status,
      message: 'RunPod status update received',
      metadata: {
        delay_time: payload.delayTime ?? null,
        execution_time: payload.executionTime ?? null,
        progress: payload.progress ?? null,
        worker_id: payload.workerId ?? null,
      },
    });

    if (['completed', 'failed', 'cancelled', 'timed_out'].includes(job.status)) {
      return new NextResponse('OK', { status: 200 });
    }

    if (status === 'COMPLETED') {
      const outputLocation = extractOutputLocation(payload.output);
      if (!outputLocation) {
        await reconcileGenerationJob(admin, job);
        return new NextResponse('OK', { status: 200 });
      }

      const timingValidation = validateCompletionTiming({
        expectedFps: Number(job.fps),
        expectedFrames: Number(job.frames),
        expectedRequestedDurationSeconds: Number(
          job.requested_duration_seconds,
        ),
        output: payload.output,
      });

      if (!timingValidation.ok) {
        console.warn(
          `Generation ${jobId} failed webhook timing validation: ${timingValidation.reason}`,
          timingValidation.metadata,
        );

        const { error: refundError } = await admin.rpc(
          'refund_generation_reservation',
          {
            p_generation_id: jobId,
            p_terminal_status: 'failed',
          },
        );

        if (refundError) {
          throw refundError;
        }

        const timing = timingValidation.metadata;
        const { error: invalidTimingUpdateError } = await admin
          .from('generation_jobs')
          .update({
            actual_duration_seconds:
              timing?.actualDurationSeconds ?? null,
            error_code: timingValidation.reason,
            error_message:
              timingValidation.reason === 'actual-duration-mismatch'
                ? `The generated MP4 duration (${timing?.actualDurationSeconds.toFixed(3)}s) did not match the requested duration (${job.requested_duration_seconds}s).`
                : 'The render provider returned incomplete or inconsistent video timing metadata.',
            output_fps: timing?.fps ?? null,
            output_frames: timing?.frames ?? null,
            progress_percent: 0,
            requested_duration_seconds: Number(
              job.requested_duration_seconds,
            ),
            runpod_status: 'COMPLETED_DURATION_INVALID',
            runpod_execution_ms: payload.executionTime ?? null,
            runpod_delay_ms: payload.delayTime ?? null,
            runpod_worker_id: payload.workerId ?? null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', jobId);

        if (invalidTimingUpdateError) {
          throw invalidTimingUpdateError;
        }

        await admin.from('notifications').insert({
          user_id: job.user_id,
          type: 'generation_failed',
          title: 'Video duration validation failed',
          message:
            'The generated video did not match the requested duration. Reserved credits were returned.',
          action_url: '/?view=dashboard&section=videos',
          metadata: {
            generation_id: jobId,
            timing_validation: timingValidation.reason,
          },
        });

        return new NextResponse('OK', { status: 200 });
      }

      const timing = timingValidation.metadata;
      const { error: updateError } = await admin
        .from('generation_jobs')
        .update({
          actual_duration_seconds: timing.actualDurationSeconds,
          requested_duration_seconds: timing.requestedDurationSeconds,
          output_fps: timing.fps,
          output_frames: timing.frames,
          runpod_status: status,
          output_storage_path: outputLocation,
          runpod_execution_ms: payload.executionTime ?? null,
          runpod_delay_ms: payload.delayTime ?? null,
          runpod_worker_id: payload.workerId ?? null,
          progress_percent: 100,
          updated_at: new Date().toISOString(),
        })
        .eq('id', jobId);

      if (updateError) {
        throw updateError;
      }

      const { error: finalizeError } = await admin.rpc(
        'finalize_generation_charge',
        { p_generation_id: jobId },
      );
      if (finalizeError) {
        throw finalizeError;
      }

      if (job.status !== 'completed') {
        await admin.from('notifications').insert({
          user_id: job.user_id,
          type: 'generation_completed',
          title: 'Your video is ready',
          message: job.prompt.slice(0, 140),
          action_url: '/?view=dashboard&section=videos',
          metadata: { generation_id: jobId },
        });
      }

      return new NextResponse('OK', { status: 200 });
    }

    if (['FAILED', 'CANCELLED', 'TIMED_OUT'].includes(status)) {
      const terminalStatus =
        status === 'CANCELLED'
          ? 'cancelled'
          : status === 'TIMED_OUT'
            ? 'timed_out'
            : 'failed';
      const { error: refundError } = await admin.rpc(
        'refund_generation_reservation',
        {
          p_generation_id: jobId,
          p_terminal_status: terminalStatus,
        },
      );

      if (refundError) {
        throw refundError;
      }

      await admin
        .from('generation_jobs')
        .update({
          runpod_status: status,
          error_message:
            typeof payload.error === 'string'
              ? payload.error.slice(0, 500)
              : status === 'TIMED_OUT'
                ? 'The render exceeded its processing time limit.'
                : status === 'CANCELLED'
                  ? 'The render was cancelled.'
                  : 'The render provider could not complete this video.',
          progress_percent: 0,
          updated_at: new Date().toISOString(),
        })
        .eq('id', jobId);

      if (!['failed', 'cancelled', 'timed_out'].includes(job.status)) {
        await admin.from('notifications').insert({
          user_id: job.user_id,
          type: 'generation_failed',
          title: status === 'CANCELLED' ? 'Render cancelled' : 'Render did not complete',
          message: 'Reserved credits were returned to your wallet.',
          action_url: '/?view=dashboard&section=videos',
          metadata: { generation_id: jobId, provider_status: status },
        });
      }

      return new NextResponse('OK', { status: 200 });
    }

    const processingUpdate: Record<string, unknown> = {
      runpod_status: status,
      status: 'processing',
      progress_percent: safeProgress(payload.progress, 5),
      updated_at: new Date().toISOString(),
    };
    if (status === 'IN_PROGRESS') {
      processingUpdate.started_at = new Date().toISOString();
    }

    await admin
      .from('generation_jobs')
      .update(processingUpdate)
      .eq('id', jobId);

    return new NextResponse('OK', { status: 200 });
  } catch (error) {
    console.error('RunPod webhook processing failed:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
