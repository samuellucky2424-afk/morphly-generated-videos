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
    const { data: asset, error: assetError } = await admin
      .from('assets')
      .select('id,bucket,storage_path')
      .eq('id', id)
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .single();

    if (assetError || !asset) {
      return NextResponse.json({ error: 'Asset not found.' }, { status: 404 });
    }

    const { count, error: jobsError } = await admin
      .from('generation_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('source_asset_id', asset.id)
      .in('status', ['created', 'reserving', 'queued', 'processing']);

    if (jobsError) {
      throw jobsError;
    }

    if ((count ?? 0) > 0) {
      return NextResponse.json(
        { error: 'This asset is being used by an active generation.' },
        { status: 409 },
      );
    }

    const { error: deleteError } = await admin
      .from('assets')
      .update({
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', asset.id)
      .eq('user_id', user.id);

    if (deleteError) {
      throw deleteError;
    }

    const { count: references } = await admin
      .from('generation_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('source_asset_id', asset.id);

    if ((references ?? 0) === 0) {
      const { error: storageError } = await admin.storage
        .from(asset.bucket)
        .remove([asset.storage_path]);
      if (storageError) {
        console.error('Unable to remove deleted asset object:', storageError);
      }
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return NextResponse.json(
        { error: 'Sign in before deleting an asset.' },
        { status: 401 },
      );
    }

    console.error('Asset deletion failed:', error);
    return NextResponse.json(
      { error: 'The asset could not be deleted.' },
      { status: 500 },
    );
  }
}
