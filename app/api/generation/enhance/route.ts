import { NextRequest, NextResponse } from 'next/server';
import { requireApiUser } from '@/src/lib/auth';
import { createAdminClient } from '@/src/lib/supabase/admin';
import { enhanceVideoPrompt } from '@/src/lib/gemini-enhancer';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const user = await requireApiUser();
    const body = await request.json() as { prompt?: string };
    const prompt = body.prompt;

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const admin = createAdminClient();
    const idempotencyKey = `prompt-enhance:${user.id}:${randomUUID()}`;
    const cost = 10; // Fixed cost for prompt enhancement

    // 1. Charge the credits
    const { error: chargeError } = await admin.rpc('charge_prompt_enhancement_credits', {
      p_user_id: user.id,
      p_amount: cost,
      p_idempotency_key: idempotencyKey,
    });

    if (chargeError) {
      console.error('Failed to charge credits for enhancement:', chargeError);
      return NextResponse.json(
        { error: chargeError.message || 'Insufficient credits for prompt enhancement' },
        { status: 402 }
      );
    }

    // 2. Call Gemini
    const enhancedPrompt = await enhanceVideoPrompt(prompt);

    // 3. If Gemini failed (returned original prompt), refund the credits
    if (enhancedPrompt === prompt) {
      // Refund by granting credits back
      await admin.rpc('admin_grant_credits', {
        p_actor_user_id: user.id, // using user as actor since it's an automated system refund
        p_target_user_id: user.id,
        p_amount: cost,
        p_reason: 'Refund for failed prompt enhancement',
        p_idempotency_key: `refund:${idempotencyKey}`,
      });
      return NextResponse.json(
        { error: 'Enhancement failed, credits refunded.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ enhancedPrompt });
  } catch (error: any) {
    console.error('Error in prompt enhancement route:', error);
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
