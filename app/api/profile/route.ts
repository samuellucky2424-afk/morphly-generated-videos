import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { AuthenticationRequiredError, requireApiUser } from '@/src/lib/auth';
import { createAdminClient } from '@/src/lib/supabase/admin';
import { bootstrapUser } from '@/src/lib/user-bootstrap';

export const dynamic = 'force-dynamic';

const profileSchema = z.object({
  company: z.string().trim().max(120),
  displayName: z.string().trim().min(2).max(80),
  emailNotifications: z.boolean(),
  generationNotifications: z.boolean(),
});

async function serializeProfile(
  admin: ReturnType<typeof createAdminClient>,
  user: { email?: string | null; id: string },
  profile: Record<string, unknown>,
) {
  const avatarPath =
    typeof profile.avatar_url === 'string' ? profile.avatar_url : null;
  let avatarUrl: string | null = null;

  if (avatarPath?.startsWith('http://') || avatarPath?.startsWith('https://')) {
    avatarUrl = avatarPath;
  } else if (avatarPath) {
    const { data } = await admin.storage
      .from(process.env.SUPABASE_VIDEO_BUCKET || 'morphly-generated-videos')
      .createSignedUrl(avatarPath, 60 * 60);
    avatarUrl = data?.signedUrl ?? null;
  }

  return {
    id: user.id,
    email: user.email ?? String(profile.email ?? ''),
    displayName: String(profile.display_name ?? ''),
    company: String(profile.company ?? ''),
    referralCode: String(profile.referral_code ?? ''),
    emailNotifications: Boolean(profile.email_notifications),
    generationNotifications: Boolean(profile.generation_notifications),
    avatarUrl,
  };
}

export async function GET() {
  try {
    const user = await requireApiUser();
    await bootstrapUser(user);
    const admin = createAdminClient();
    const { data: profile, error } = await admin
      .from('profiles')
      .select(
        'email,display_name,avatar_url,company,referral_code,email_notifications,generation_notifications',
      )
      .eq('id', user.id)
      .single();

    if (error || !profile) {
      throw error ?? new Error('Profile not found');
    }

    return NextResponse.json(await serializeProfile(admin, user, profile), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return NextResponse.json(
        { error: 'Sign in to view your profile.' },
        { status: 401 },
      );
    }

    console.error('Profile request failed:', error);
    return NextResponse.json(
      { error: 'Your profile could not be loaded.' },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireApiUser();
    const parsed = profileSchema.safeParse(await request.json().catch(() => null));

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Check your profile information and try again.' },
        { status: 400 },
      );
    }

    const admin = createAdminClient();
    const { data: profile, error } = await admin
      .from('profiles')
      .update({
        display_name: parsed.data.displayName,
        company: parsed.data.company || null,
        email_notifications: parsed.data.emailNotifications,
        generation_notifications: parsed.data.generationNotifications,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)
      .select(
        'email,display_name,avatar_url,company,referral_code,email_notifications,generation_notifications',
      )
      .single();

    if (error || !profile) {
      throw error ?? new Error('Profile update failed');
    }

    return NextResponse.json(await serializeProfile(admin, user, profile), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return NextResponse.json(
        { error: 'Sign in before changing your profile.' },
        { status: 401 },
      );
    }

    console.error('Profile update failed:', error);
    return NextResponse.json(
      { error: 'Your profile changes could not be saved.' },
      { status: 500 },
    );
  }
}
