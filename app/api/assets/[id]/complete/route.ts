import { NextResponse } from 'next/server';
import { matchesAssetSignature, validateAssetMetadata } from '@/src/lib/assets';
import { AuthenticationRequiredError, requireApiUser } from '@/src/lib/auth';
import { createAdminClient } from '@/src/lib/supabase/admin';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function readStoredHeader(signedUrl: string) {
  const response = await fetch(signedUrl, {
    headers: { Range: 'bytes=0-31' },
    cache: 'no-store',
  });

  if (!response.ok || !response.body) {
    throw new Error('Stored file could not be verified');
  }

  const reader = response.body.getReader();
  const { value } = await reader.read();
  await reader.cancel();
  const contentRange = response.headers.get('content-range');
  const rangeSize = contentRange?.match(/\/(\d+)$/)?.[1];
  const contentLength = response.headers.get('content-length');
  const sizeBytes = Number(
    rangeSize ?? (response.status === 200 ? contentLength : Number.NaN),
  );

  return {
    bytes: value ?? new Uint8Array(),
    sizeBytes: Number.isSafeInteger(sizeBytes) ? sizeBytes : null,
  };
}

export async function POST(_request: Request, context: RouteContext) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;
    const admin = createAdminClient();
    const { data: asset, error: assetError } = await admin
      .from('assets')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .single();

    if (assetError || !asset) {
      return NextResponse.json({ error: 'Asset not found.' }, { status: 404 });
    }

    const { data: signed, error: signedError } = await admin.storage
      .from(asset.bucket)
      .createSignedUrl(asset.storage_path, 60 * 60);

    if (signedError || !signed?.signedUrl) {
      return NextResponse.json(
        { error: 'The uploaded file could not be verified.' },
        { status: 400 },
      );
    }

    if (asset.status === 'ready') {
      return NextResponse.json({
        asset: {
          ...asset,
          size_bytes: Number(asset.size_bytes),
          url: signed.signedUrl,
        },
      });
    }

    const validated = validateAssetMetadata({
      fileName: asset.original_name || 'upload',
      kind: asset.kind,
      mimeType: asset.mime_type,
      sizeBytes: Number(asset.size_bytes),
    });
    const storedFile = await readStoredHeader(signed.signedUrl);

    if (
      'error' in validated ||
      storedFile.sizeBytes === null ||
      storedFile.sizeBytes !== Number(asset.size_bytes) ||
      storedFile.sizeBytes > validated.sizeLimit ||
      !matchesAssetSignature(asset.mime_type, storedFile.bytes)
    ) {
      await admin.storage.from(asset.bucket).remove([asset.storage_path]);
      await admin
        .from('assets')
        .update({ status: 'failed', updated_at: new Date().toISOString() })
        .eq('id', asset.id)
        .eq('user_id', user.id);
      return NextResponse.json(
        { error: 'The uploaded file content does not match a supported format.' },
        { status: 400 },
      );
    }

    const { data: completed, error: completeError } = await admin
      .from('assets')
      .update({ status: 'ready', updated_at: new Date().toISOString() })
      .eq('id', asset.id)
      .eq('user_id', user.id)
      .select(
        'id,bucket,storage_path,kind,original_name,mime_type,size_bytes,status,created_at',
      )
      .single();

    if (completeError || !completed) {
      throw completeError ?? new Error('Asset update failed');
    }

    if (completed.kind === 'avatar') {
      await admin
        .from('profiles')
        .update({
          avatar_url: completed.storage_path,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);
    }

    return NextResponse.json({
      asset: {
        ...completed,
        size_bytes: Number(completed.size_bytes),
        url: signed.signedUrl,
      },
    });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return NextResponse.json(
        { error: 'Sign in before completing an upload.' },
        { status: 401 },
      );
    }

    console.error('Asset verification failed:', error);
    return NextResponse.json(
      { error: 'The uploaded file could not be verified.' },
      { status: 500 },
    );
  }
}
