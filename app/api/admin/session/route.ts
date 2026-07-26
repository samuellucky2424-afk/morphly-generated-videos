import { NextResponse } from 'next/server';
import { getAdminAccess } from '@/src/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const access = await getAdminAccess();

  if (!access.authorized) {
    const status = access.reason === 'unauthenticated' ? 401 : 403;
    const error =
      access.reason === 'unverified'
        ? 'Verify this email address before opening the admin console.'
        : access.reason === 'configuration'
          ? 'Admin access is temporarily unavailable.'
          : 'This account is not authorized to access the admin console.';

    return NextResponse.json(
      {
        authorized: false,
        error,
      },
      {
        status,
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    );
  }

  return NextResponse.json(
    {
      authorized: true,
      role: access.role,
      user: {
        email: access.user.email,
        name:
          access.user.user_metadata?.full_name ??
          access.user.user_metadata?.name ??
          access.user.email,
      },
    },
    {
      headers: {
        'Cache-Control': 'no-store',
      },
    },
  );
}
