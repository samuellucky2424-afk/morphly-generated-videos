import { NextResponse } from 'next/server';
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
      headers: {
        'Cache-Control': 'no-store',
      },
    },
  );
}

export async function GET() {
  const access = await getAdminAccess();

  if (!access.authorized) {
    return unauthorizedResponse(access.reason);
  }

  try {
    const admin = createAdminClient();
    const [
      profilesResult,
      jobsResult,
      paymentsResult,
      walletsResult,
      recentUsersResult,
      recentJobsResult,
    ] = await Promise.all([
      admin.from('profiles').select('*', { count: 'exact', head: true }),
      admin.from('generation_jobs').select('*', { count: 'exact', head: true }),
      admin
        .from('payments')
        .select('paid_amount_minor,currency,created_at')
        .eq('status', 'credited')
        .limit(1000),
      admin.from('wallets').select('lifetime_spent').limit(1000),
      admin
        .from('profiles')
        .select('id,email,display_name,account_status,created_at')
        .order('created_at', { ascending: false })
        .limit(8),
      admin
        .from('generation_jobs')
        .select(
          'id,prompt,status,progress_percent,credit_cost,created_at,requested_duration_seconds,actual_duration_seconds,frames,fps,output_frames,output_fps',
        )
        .order('created_at', { ascending: false })
        .limit(8),
    ]);

    const queryError =
      profilesResult.error ??
      jobsResult.error ??
      paymentsResult.error ??
      walletsResult.error ??
      recentUsersResult.error ??
      recentJobsResult.error;

    if (queryError) {
      console.error('Unable to load admin overview:', queryError);
      return NextResponse.json(
        { error: 'The admin overview could not be loaded.' },
        {
          status: 500,
          headers: {
            'Cache-Control': 'no-store',
          },
        },
      );
    }

    const revenueByCurrency = new Map<string, number>();
    for (const payment of paymentsResult.data ?? []) {
      const currency = String(payment.currency || 'NGN').toUpperCase();
      const amount = Number(payment.paid_amount_minor ?? 0);
      revenueByCurrency.set(currency, (revenueByCurrency.get(currency) ?? 0) + amount);
    }

    const revenue = [...revenueByCurrency.entries()]
      .map(([currency, amountMinor]) => ({ currency, amountMinor }))
      .sort((a, b) => b.amountMinor - a.amountMinor);

    const creditsConsumed = (walletsResult.data ?? []).reduce(
      (total, wallet) => total + Number(wallet.lifetime_spent ?? 0),
      0,
    );

    const recentUsers = recentUsersResult.data ?? [];
    const balancesByUserId = new Map<
      string,
      { available_credits: number; reserved_credits: number }
    >();

    if (recentUsers.length) {
      const { data: recentWallets, error: recentWalletsError } = await admin
        .from('wallets')
        .select('user_id,available_credits,reserved_credits')
        .in(
          'user_id',
          recentUsers.map((user) => user.id),
        );

      if (recentWalletsError) {
        console.error('Unable to load recent user balances:', recentWalletsError);
        return NextResponse.json(
          { error: 'The admin overview could not be loaded.' },
          {
            status: 500,
            headers: {
              'Cache-Control': 'no-store',
            },
          },
        );
      }

      for (const wallet of recentWallets ?? []) {
        balancesByUserId.set(wallet.user_id, {
          available_credits: Number(wallet.available_credits ?? 0),
          reserved_credits: Number(wallet.reserved_credits ?? 0),
        });
      }
    }

    return NextResponse.json(
      {
        generatedAt: new Date().toISOString(),
        admin: {
          email: access.user.email,
          role: access.role,
        },
        metrics: {
          totalUsers: profilesResult.count ?? 0,
          videosGenerated: jobsResult.count ?? 0,
          creditsConsumed,
          revenue,
        },
        recentUsers: recentUsers.map((user) => ({
          ...user,
          available_credits: balancesByUserId.get(user.id)?.available_credits ?? null,
          reserved_credits: balancesByUserId.get(user.id)?.reserved_credits ?? null,
        })),
        recentJobs: (recentJobsResult.data ?? []).map((job) => ({
          ...job,
          actual_duration_seconds:
            job.actual_duration_seconds === null
              ? null
              : Number(job.actual_duration_seconds),
          fps: Number(job.fps ?? 0),
          frames: Number(job.frames ?? 0),
          output_fps:
            job.output_fps === null
              ? null
              : Number(job.output_fps),
          output_frames:
            job.output_frames === null
              ? null
              : Number(job.output_frames),
          requested_duration_seconds: Number(
            job.requested_duration_seconds ?? 0,
          ),
        })),
      },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    );
  } catch (error) {
    console.error('Admin overview request failed:', error);
    return NextResponse.json(
      { error: 'The admin overview could not be loaded.' },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    );
  }
}
