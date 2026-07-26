import { NextResponse } from 'next/server';
import { matchesAssetSignature, validateAssetMetadata } from '@/src/lib/assets';
import { AuthenticationRequiredError, requireApiUser } from '@/src/lib/auth';
import { createAdminClient } from '@/src/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

type RouteContext = {
  params: Promise<{ id: string }>;
};

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function readStoredHeader(signedUrl: string) {
  let lastError: unknown = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8_000);

    try {
      const response = await fetch(signedUrl, {
        headers: { Range: 'bytes=0-31' },
        cache: 'no-store',
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error('Stored file could not be verified');
      }

      const reader = response.body.getReader();
      const { value } = await reader.read();
      controller.abort();
      return value ?? new Uint8Array();
    } catch (error) {
      lastError = error;
      if (attempt < 2) {
        await wait(300 * (attempt + 1));
      }
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Stored file could not be verified');
}

async function getStoredFileSize(
  admin: ReturnType<typeof createAdminClient>,
  bucket: string,
  storagePath: string,
) {
  const pathParts = storagePath.split('/');
  const fileName = pathParts.pop();
  const directory = pathParts.join('/');
  if (!fileName) return null;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { data, error } = await admin.storage.from(bucket).list(directory, {
      limit: 10,
      search: fileName,
    });
    if (error) {
      if (attempt === 4) throw error;
    } else {
      const storedFile = data?.find((entry) => entry.name === fileName);
      const sizeBytes = Number(storedFile?.metadata?.size);
      if (Number.isSafeInteger(sizeBytes)) {
        return sizeBytes;
      }
    }

    await wait(250 * (attempt + 1));
  }

  return null;
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
    const [storedHeader, storedSizeBytes] = await Promise.all([
      readStoredHeader(signed.signedUrl),
      getStoredFileSize(admin, asset.bucket, asset.storage_path),
    ]);

    if (
      'error' in validated ||
      storedSizeBytes === null ||
      storedSizeBytes !== Number(asset.size_bytes) ||
      storedSizeBytes > validated.sizeLimit ||
      !matchesAssetSignature(asset.mime_type, storedHeader)
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
