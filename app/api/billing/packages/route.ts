import { NextResponse } from 'next/server';
import { getCreditPackages } from '@/src/lib/credits';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const packages = await getCreditPackages();
    return NextResponse.json(packages, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('Credit package request failed:', error);
    return NextResponse.json(
      { error: 'Credit packages could not be loaded.' },
      { status: 500 },
    );
  }
}
