import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { AuthenticationRequiredError, requireApiUser } from '@/src/lib/auth';
import { createAdminClient } from '@/src/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const markReadSchema = z.union([
  z.object({ id: z.uuid() }),
  z.object({ markAll: z.literal(true) }),
]);

export async function GET() {
  try {
    const user = await requireApiUser();
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('notifications')
      .select('id,type,title,message,action_url,read_at,created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) {
      throw error;
    }

    return NextResponse.json(data ?? [], {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return NextResponse.json(
        { error: 'Sign in to view notifications.' },
        { status: 401 },
      );
    }

    console.error('Notification request failed:', error);
    return NextResponse.json(
      { error: 'Notifications could not be loaded.' },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireApiUser();
    const parsed = markReadSchema.safeParse(await request.json().catch(() => null));

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'A valid notification action is required.' },
        { status: 400 },
      );
    }

    const admin = createAdminClient();
    let update = admin
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .is('read_at', null);

    if ('id' in parsed.data) {
      update = update.eq('id', parsed.data.id);
    }

    const { error } = await update;
    if (error) {
      throw error;
    }

    return NextResponse.json({ updated: true });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return NextResponse.json(
        { error: 'Sign in before changing notifications.' },
        { status: 401 },
      );
    }

    console.error('Notification update failed:', error);
    return NextResponse.json(
      { error: 'Notifications could not be updated.' },
      { status: 500 },
    );
  }
}
