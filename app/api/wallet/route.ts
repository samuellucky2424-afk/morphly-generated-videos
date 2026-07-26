import { NextResponse } from 'next/server';
import { getUserWallet } from '@/src/lib/credits';
import { AuthenticationRequiredError } from '@/src/lib/auth';
import { AccountBootstrapError } from '@/src/lib/user-bootstrap';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const wallet = await getUserWallet();
    return NextResponse.json(wallet, {
      headers: {
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: unknown) {
    if (error instanceof AuthenticationRequiredError) {
      return NextResponse.json(
        { error: 'Sign in to view your wallet.' },
        { status: 401 },
      );
    }
    if (error instanceof AccountBootstrapError) {
      return NextResponse.json(
        { error: error.message },
        { status: 503 },
      );
    }
    console.error('Wallet request failed:', error);
    return NextResponse.json(
      { error: 'Your wallet could not be loaded.' },
      { status: 500 },
    );
  }
}
