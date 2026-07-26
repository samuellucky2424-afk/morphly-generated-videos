import { NextResponse } from 'next/server';
import { getUserTransactions } from '@/src/lib/credits';

export async function GET() {
  try {
    const transactions = await getUserTransactions();
    return NextResponse.json(transactions);
  } catch (error: any) {
    if (error.message === 'NEXT_REDIRECT') {
        return new NextResponse('Unauthorized', { status: 401 });
    }
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
