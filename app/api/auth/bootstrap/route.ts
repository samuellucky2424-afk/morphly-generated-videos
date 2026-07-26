import { NextResponse } from 'next/server';
import { AuthenticationRequiredError, requireApiUser } from '@/src/lib/auth';
import { AccountBootstrapError, bootstrapUser } from '@/src/lib/user-bootstrap';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const user = await requireApiUser();
    await bootstrapUser(user);

    return NextResponse.json(
      { initialized: true },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    );
  } catch (error: unknown) {
    if (error instanceof AuthenticationRequiredError) {
      return NextResponse.json(
        { error: 'Sign in before initializing your account.' },
        { status: 401 },
      );
    }
    if (error instanceof AccountBootstrapError) {
      return NextResponse.json(
        { error: error.message },
        { status: 503 },
      );
    }

    console.error('Account bootstrap request failed:', error);
    return NextResponse.json(
      { error: 'Your Morphly account could not be initialized.' },
      { status: 500 },
    );
  }
}
