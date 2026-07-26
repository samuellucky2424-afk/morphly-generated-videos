import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { env } from '@/src/lib/env';
import { verifyTransaction } from '@/src/lib/flutterwave';
import { createAdminClient } from '@/src/lib/supabase/admin';

export async function POST(request: Request) {
  try {
    const signature = request.headers.get('verif-hash');
    if (!signature || signature !== env.FLW_SECRET_HASH) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const payload = await request.json() as {
      event?: string;
      data?: {
        id?: string | number;
        status?: string;
      };
    };
    const supabase = createAdminClient();

    // Log the event securely
    await supabase.from('payment_events').insert({
      provider: 'flutterwave',
      provider_event_id: payload.data?.id?.toString() || Date.now().toString(),
      event_type: payload.event,
      signature_valid: true,
      payload_hash: crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex'),
      payload: payload,
    });

    if (
      payload.event === 'charge.completed' &&
      payload.data?.status === 'successful' &&
      payload.data.id != null
    ) {
      const transactionId = payload.data.id.toString();
      
      // Verify with Flutterwave directly to avoid spoofed payloads
      const verifiedData = await verifyTransaction(transactionId);
      
      if (verifiedData.status === 'successful') {
        const txRef = verifiedData.tx_ref;
        
        // Find payment
        const { data: payment, error } = await supabase
          .from('payments')
          .select('id, status, expected_amount_minor, currency')
          .eq('tx_ref', txRef)
          .single();

        if (error || !payment) {
          console.error('Payment not found for tx_ref:', txRef);
          return new NextResponse('Payment not found', { status: 404 });
        }

        if (payment.status === 'successful') {
          // Already processed
          return new NextResponse('Already processed', { status: 200 });
        }

        // Verify amounts match
        const amountPaidMinor = verifiedData.amount * 100;
        if (amountPaidMinor < payment.expected_amount_minor || verifiedData.currency !== payment.currency) {
          console.error('Amount or currency mismatch', { verifiedData, payment });
          
          await supabase.from('payments').update({
            status: 'failed',
            failed_at: new Date().toISOString(),
            raw_verified_response: verifiedData,
            paid_amount_minor: amountPaidMinor
          }).eq('id', payment.id);

          return new NextResponse('Amount mismatch', { status: 400 });
        }

        // Update payment with verified data
        await supabase.from('payments').update({
            raw_verified_response: verifiedData,
            paid_amount_minor: amountPaidMinor,
            provider_transaction_id: transactionId.toString(),
            provider_fee_minor: verifiedData.app_fee * 100,
            payment_method: verifiedData.payment_type
        }).eq('id', payment.id);

        // Call the atomic completion function
        const { error: rpcError } = await supabase.rpc('complete_verified_payment', {
          p_payment_id: payment.id
        });

        if (rpcError) {
          console.error('Failed to complete payment via RPC', rpcError);
          return new NextResponse('Internal Server Error', { status: 500 });
        }

        return new NextResponse('OK', { status: 200 });
      }
    }

    return new NextResponse('Ignored', { status: 200 });
  } catch (error) {
    console.error('Webhook error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
