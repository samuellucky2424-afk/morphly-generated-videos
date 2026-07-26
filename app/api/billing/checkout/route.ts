import { NextResponse } from 'next/server';
import { requireUser } from '@/src/lib/auth';
import { createClient } from '@/src/lib/supabase/server';
import { generateCheckoutUrl } from '@/src/lib/flutterwave';
import { env } from '@/src/lib/env';

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const { packageId } = await request.json() as { packageId?: string };

    if (!packageId) {
      return NextResponse.json({ error: 'packageId is required' }, { status: 400 });
    }

    const supabase = await createClient();

    // 1. Fetch package details
    const { data: pkg, error: pkgError } = await supabase
      .from('credit_packages')
      .select('*')
      .eq('id', packageId)
      .eq('is_active', true)
      .single();

    if (pkgError || !pkg) {
      return NextResponse.json({ error: 'Invalid or inactive credit package' }, { status: 400 });
    }

    // 2. Create pending payment record
    const txRef = `tx-${crypto.randomUUID()}`;
    const creditsToGrant = pkg.base_credits + pkg.bonus_credits;
    
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .insert({
        user_id: user.id,
        package_id: pkg.id,
        tx_ref: txRef,
        currency: pkg.currency,
        expected_amount_minor: pkg.price_minor,
        credits_to_grant: creditsToGrant,
      })
      .select()
      .single();

    if (paymentError) {
      console.error('Failed to create payment record:', paymentError);
      return NextResponse.json({ error: 'Failed to initialize payment' }, { status: 500 });
    }

    // 3. Generate Flutterwave Checkout URL
    const checkoutUrl = await generateCheckoutUrl(
      txRef,
      pkg.price_minor / 100,
      pkg.currency,
      user.email || '',
      user.user_metadata?.full_name || 'Morphly User',
      `${env.APP_URL}/?billing_status=success`
    );

    // 4. Update checkout URL on payment record (optional but good for tracking)
    await supabase.from('payments').update({ checkout_url: checkoutUrl }).eq('id', payment.id);

    // 5. Return checkout URL to client
    return NextResponse.json({ checkoutUrl });
  } catch (error: any) {
    console.error('Checkout error:', error);
    if (error.message === 'NEXT_REDIRECT') {
      return new NextResponse('Unauthorized', { status: 401 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
