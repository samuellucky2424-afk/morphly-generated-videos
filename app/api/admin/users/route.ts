import { NextRequest, NextResponse } from 'next/server';
import { getAdminAccess } from '@/src/lib/admin-auth';
import { createAdminClient } from '@/src/lib/supabase/admin';

export const dynamic = 'force-dynamic';

function unauthorizedResponse(reason: string) {
  return NextResponse.json(
    {
      error:
        reason === 'unauthenticated'
          ? 'Sign in to continue.'
          : 'Administrator access is required.',
    },
    {
      status: reason === 'unauthenticated' ? 401 : 403,
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, '\\$&');
}

export async function GET(request: NextRequest) {
  const access = await getAdminAccess();

  if (!access.authorized) {
    return unauthorizedResponse(access.reason);
  }

  const query = request.nextUrl.searchParams.get('query')?.trim().slice(0, 160) ?? '';

  try {
    const admin = createAdminClient();
    let profilesQuery = admin
      .from('profiles')
      .select('id,email,display_name,account_status,created_at')
      .limit(20);

    if (query) {
      profilesQuery = isUuid(query)
        ? profilesQuery.eq('id', query)
        : profilesQuery.ilike('email', `%${escapeLikePattern(query)}%`);
    } else {
      profilesQuery = profilesQuery.order('created_at', { ascending: false });
    }

    const { data: profiles, error: profilesError } = await profilesQuery;

    if (profilesError) {
      console.error('Unable to search admin users:', profilesError);
      return NextResponse.json(
        { error: 'User accounts could not be loaded.' },
        { status: 500, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const userIds = (profiles ?? []).map((profile) => profile.id);
    const walletsByUserId = new Map<
      string,
      { available_credits: number; reserved_credits: number }
    >();

    if (userIds.length) {
      const { data: wallets, error: walletsError } = await admin
        .from('wallets')
        .select('user_id,available_credits,reserved_credits')
        .in('user_id', userIds);

      if (walletsError) {
        console.error('Unable to load admin user wallets:', walletsError);
        return NextResponse.json(
          { error: 'User balances could not be loaded.' },
          { status: 500, headers: { 'Cache-Control': 'no-store' } },
        );
      }

      for (const wallet of wallets ?? []) {
        walletsByUserId.set(wallet.user_id, {
          available_credits: Number(wallet.available_credits ?? 0),
          reserved_credits: Number(wallet.reserved_credits ?? 0),
        });
      }
    }

    const users = (profiles ?? []).map((profile) => ({
      ...profile,
      available_credits: walletsByUserId.get(profile.id)?.available_credits ?? null,
      reserved_credits: walletsByUserId.get(profile.id)?.reserved_credits ?? null,
    }));

    return NextResponse.json(
      { users },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('Admin user search failed:', error);
    return NextResponse.json(
      { error: 'User accounts could not be loaded.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
