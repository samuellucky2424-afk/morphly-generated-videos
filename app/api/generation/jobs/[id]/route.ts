import { NextResponse } from 'next/server';
import { AuthenticationRequiredError, requireApiUser } from '@/src/lib/auth';
import { createAdminClient } from '@/src/lib/supabase/admin';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;
    const admin = createAdminClient();
    const { data: job, error: jobError } = await admin
      .from('generation_jobs')
      .select('id,status')
      .eq('id', id)
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .single();

    if (jobError || !job) {
      return NextResponse.json({ error: 'Generation not found.' }, { status: 404 });
    }

    if (['created', 'reserving', 'queued', 'processing'].includes(job.status)) {
      return NextResponse.json(
        { error: 'Cancel the active render before removing it.' },
        { status: 409 },
      );
    }

    const { error } = await admin
      .from('generation_jobs')
      .update({
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.id)
      .eq('user_id', user.id);

    if (error) {
      throw error;
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return NextResponse.json(
        { error: 'Sign in before removing a generation.' },
        { status: 401 },
      );
    }

    console.error('Generation deletion failed:', error);
    return NextResponse.json(
      { error: 'The generation could not be removed.' },
      { status: 500 },
    );
  }
}
