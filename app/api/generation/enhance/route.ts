import { NextRequest, NextResponse } from 'next/server';
import { requireApiUser } from '@/src/lib/auth';
import { createAdminClient } from '@/src/lib/supabase/admin';
import {
  enhanceVideoPrompt,
  GeminiEnhancementError,
  isPromptEnhancerConfigured,
} from '@/src/lib/gemini-enhancer';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

const ENHANCEMENT_COST = 10;
const MAX_PROMPT_LENGTH = 4_000;

export async function POST(request: NextRequest) {
  try {
    const user = await requireApiUser();
    const body = (await request.json().catch(() => null)) as {
      prompt?: unknown;
    } | null;
    const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';

    if (prompt.length < 3) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    if (prompt.length > MAX_PROMPT_LENGTH) {
      return NextResponse.json(
        { error: `Prompt must be ${MAX_PROMPT_LENGTH.toLocaleString()} characters or fewer.` },
        { status: 400 },
      );
    }

    if (!isPromptEnhancerConfigured()) {
      console.error(
        'Prompt enhancement is unavailable because GEMINI_API_KEY is not configured.',
      );
      return NextResponse.json(
        { error: 'Prompt enhancement is temporarily unavailable.' },
        { status: 503 },
      );
    }

    const admin = createAdminClient();
    const idempotencyKey = `prompt-enhance:${user.id}:${randomUUID()}`;

    const { error: chargeError } = await admin.rpc('charge_prompt_enhancement_credits', {
      p_user_id: user.id,
      p_amount: ENHANCEMENT_COST,
      p_idempotency_key: idempotencyKey,
    });

    if (chargeError) {
      console.error('Failed to charge credits for enhancement:', chargeError);
      const insufficientCredits = chargeError.message
        ?.toLowerCase()
        .includes('insufficient credits');
      return NextResponse.json(
        {
          error: insufficientCredits
            ? `You need at least ${ENHANCEMENT_COST} credits to enhance a prompt.`
            : 'Credits could not be charged. Please try again.',
        },
        { status: insufficientCredits ? 402 : 503 },
      );
    }

    try {
      const enhancedPrompt = await enhanceVideoPrompt(prompt);

      if (enhancedPrompt === prompt) {
        throw new GeminiEnhancementError(
          'invalid_response',
          'Gemini returned the original prompt without enhancing it.',
        );
      }

      return NextResponse.json({ enhancedPrompt });
    } catch (enhancementError) {
      const { error: refundError } = await admin.rpc(
        'refund_prompt_enhancement_credits',
        {
          p_user_id: user.id,
          p_amount: ENHANCEMENT_COST,
          p_idempotency_key: `refund:${idempotencyKey}`,
        },
      );

      if (refundError) {
        console.error('Prompt enhancement and automatic refund failed:', {
          enhancementError,
          refundError,
          userId: user.id,
        });
        return NextResponse.json(
          {
            error:
              'Enhancement failed and the credit refund could not be confirmed. Please contact support.',
          },
          { status: 500 },
        );
      }

      console.error('Prompt enhancement failed; credits refunded:', {
        code:
          enhancementError instanceof GeminiEnhancementError
            ? enhancementError.code
            : 'unknown',
        providerStatus:
          enhancementError instanceof GeminiEnhancementError
            ? enhancementError.providerStatus
            : undefined,
        userId: user.id,
      });
      return NextResponse.json(
        { error: 'Enhancement failed, and your credits were refunded. Please try again.' },
        { status: 503 },
      );
    }
  } catch (error: unknown) {
    console.error('Error in prompt enhancement route:', error);
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
