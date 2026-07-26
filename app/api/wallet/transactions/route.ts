import { NextResponse } from 'next/server';
import { getUserTransactions } from '@/src/lib/credits';
import { AuthenticationRequiredError } from '@/src/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const transactions = await getUserTransactions();
    return NextResponse.json(transactions, {
      headers: {
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: unknown) {
    if (error instanceof AuthenticationRequiredError) {
      return NextResponse.json(
        { error: 'Sign in to view wallet transactions.' },
        { status: 401 },
      );
    }
    console.error('Wallet transaction request failed:', error);
    return NextResponse.json(
      { error: 'Wallet transactions could not be loaded.' },
      { status: 500 },
    );
  }
}
