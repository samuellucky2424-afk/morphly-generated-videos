import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminAccess } from '@/src/lib/admin-auth';
import { createAdminClient } from '@/src/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const grantCreditsSchema = z.object({
  userId: z.uuid(),
  amount: z.number().int().min(1).max(1_000_000),
  reason: z.string().trim().min(3).max(250),
  requestId: z.uuid(),
});

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

export async function POST(request: NextRequest) {
  const access = await getAdminAccess();

  if (!access.authorized) {
    return unauthorizedResponse(access.reason);
  }

  const body = await request.json().catch(() => null);
  const parsed = grantCreditsSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          'Enter a valid user, 1 to 1,000,000 whole credits, and a reason of at least 3 characters.',
      },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc('admin_grant_credits', {
      p_actor_user_id: access.user.id,
      p_target_user_id: parsed.data.userId,
      p_amount: parsed.data.amount,
      p_reason: parsed.data.reason,
      p_idempotency_key: `admin-credit:${parsed.data.requestId}`,
    });

    if (error) {
      console.error('Unable to grant user credits:', error);

      if (error.code === 'P0002' || error.message.includes('wallet not found')) {
        return NextResponse.json(
          { error: 'This user does not have an initialized wallet yet.' },
          { status: 404, headers: { 'Cache-Control': 'no-store' } },
        );
      }

      if (error.code === '42501') {
        return NextResponse.json(
          { error: 'Administrator access is required.' },
          { status: 403, headers: { 'Cache-Control': 'no-store' } },
        );
      }

      if (error.code === '22023' || error.code === '23505') {
        return NextResponse.json(
          { error: error.message },
          { status: 400, headers: { 'Cache-Control': 'no-store' } },
        );
      }

      return NextResponse.json(
        { error: 'Credits could not be added. No balance was changed.' },
        { status: 500, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const result = Array.isArray(data) ? data[0] : data;

    if (!result) {
      return NextResponse.json(
        { error: 'Credits could not be added. No balance was changed.' },
        { status: 500, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    return NextResponse.json(
      {
        grant: {
          transactionId: result.transaction_id,
          userId: result.user_id,
          availableCredits: Number(result.available_credits),
          reservedCredits: Number(result.reserved_credits),
        },
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('Admin credit grant failed:', error);
    return NextResponse.json(
      { error: 'Credits could not be added. No balance was changed.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
