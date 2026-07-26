import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ASSET_KINDS, validateAssetMetadata } from '@/src/lib/assets';
import { AuthenticationRequiredError, requireApiUser } from '@/src/lib/auth';
import { env } from '@/src/lib/env';
import { createAdminClient } from '@/src/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const uploadSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  kind: z.enum(ASSET_KINDS),
  mimeType: z.string().trim().min(1).max(100),
  sizeBytes: z.number().int().positive(),
});

async function withSignedUrl(
  admin: ReturnType<typeof createAdminClient>,
  asset: Record<string, unknown> & {
    bucket: string;
    size_bytes: number | string;
    storage_path: string;
  },
) {
  const { data, error } = await admin.storage
    .from(asset.bucket)
    .createSignedUrl(asset.storage_path, 60 * 60);

  return {
    ...asset,
    size_bytes: Number(asset.size_bytes),
    url: error ? null : data.signedUrl,
  };
}

export async function GET() {
  try {
    const user = await requireApiUser();
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('assets')
      .select(
        'id,bucket,storage_path,kind,original_name,mime_type,size_bytes,status,created_at',
      )
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .eq('status', 'ready')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      throw error;
    }

    const assets = await Promise.all(
      (data ?? []).map((asset) => withSignedUrl(admin, asset)),
    );

    return NextResponse.json(assets, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return NextResponse.json(
        { error: 'Sign in to view your assets.' },
        { status: 401 },
      );
    }

    console.error('Asset list request failed:', error);
    return NextResponse.json(
      { error: 'Your assets could not be loaded.' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireApiUser();
    const parsed = uploadSchema.safeParse(await request.json().catch(() => null));

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'The selected file metadata is invalid.' },
        { status: 400 },
      );
    }

    const validated = validateAssetMetadata(parsed.data);
    if ('error' in validated) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }

    const admin = createAdminClient();
    const assetId = crypto.randomUUID();
    const directory =
      parsed.data.kind === 'avatar'
        ? `avatars/${user.id}/${assetId}`
        : `generation-inputs/${user.id}/${assetId}`;
    const storagePath = `${directory}/source.${validated.extension}`;

    const { data: asset, error: assetError } = await admin
      .from('assets')
      .insert({
        id: assetId,
        user_id: user.id,
        bucket: env.SUPABASE_VIDEO_BUCKET,
        storage_path: storagePath,
        kind: parsed.data.kind,
        original_name: validated.originalName,
        mime_type: parsed.data.mimeType,
        size_bytes: parsed.data.sizeBytes,
        status: 'uploading',
      })
      .select(
        'id,bucket,storage_path,kind,original_name,mime_type,size_bytes,status,created_at',
      )
      .single();

    if (assetError || !asset) {
      console.error('Unable to create asset upload:', assetError);
      return NextResponse.json(
        { error: 'The upload could not be initialized.' },
        { status: 500 },
      );
    }

    const { data: upload, error: uploadError } = await admin.storage
      .from(asset.bucket)
      .createSignedUploadUrl(asset.storage_path);

    if (uploadError || !upload?.token) {
      await admin.from('assets').delete().eq('id', asset.id).eq('user_id', user.id);
      console.error('Unable to sign asset upload:', uploadError);
      return NextResponse.json(
        { error: 'The upload could not be initialized.' },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        asset: {
          ...asset,
          size_bytes: Number(asset.size_bytes),
        },
        upload: {
          bucket: asset.bucket,
          path: asset.storage_path,
          token: upload.token,
        },
      },
      { status: 201, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return NextResponse.json(
        { error: 'Sign in before uploading an asset.' },
        { status: 401 },
      );
    }

    console.error('Asset upload initialization failed:', error);
    return NextResponse.json(
      { error: 'The upload could not be initialized.' },
      { status: 500 },
    );
  }
}
