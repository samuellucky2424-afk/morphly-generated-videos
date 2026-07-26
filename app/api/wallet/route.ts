import { NextResponse } from 'next/server';
import { getUserWallet } from '@/src/lib/credits';

export async function GET() {
  try {
    const wallet = await getUserWallet();
    return NextResponse.json(wallet);
  } catch (error: any) {
    if (error.message === 'NEXT_REDIRECT') {
        return new NextResponse('Unauthorized', { status: 401 });
    }
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
