import { NextResponse } from 'next/server';
import { AuthenticationRequiredError, requireApiUser } from '@/src/lib/auth';
import { cancelRunPodJob } from '@/src/lib/runpod';
import { createAdminClient } from '@/src/lib/supabase/admin';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;
    const admin = createAdminClient();
    const { data: job, error: jobError } = await admin
      .from('generation_jobs')
      .select('id,status,runpod_job_id')
      .eq('id', id)
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .single();

    if (jobError || !job) {
      return NextResponse.json({ error: 'Generation not found.' }, { status: 404 });
    }

    if (!['created', 'reserving', 'queued', 'processing'].includes(job.status)) {
      return NextResponse.json(
        { error: 'This generation is no longer active.' },
        { status: 409 },
      );
    }

    if (job.runpod_job_id) {
      await cancelRunPodJob(job.runpod_job_id);
    }

    const { error: refundError } = await admin.rpc('refund_generation_reservation', {
      p_generation_id: job.id,
      p_terminal_status: 'cancelled',
    });

    if (refundError) {
      throw refundError;
    }

    return NextResponse.json({ cancelled: true });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return NextResponse.json(
        { error: 'Sign in before cancelling a generation.' },
        { status: 401 },
      );
    }

    console.error('Generation cancellation failed:', error);
    return NextResponse.json(
      { error: 'The generation could not be cancelled.' },
      { status: 500 },
    );
  }
}
