import { NextResponse } from 'next/server';
import { requireUser } from '@/src/lib/auth';
import { createClient } from '@/src/lib/supabase/server';
import { generateCheckoutUrl } from '@/src/lib/flutterwave';
import { v4 as uuidv4 } from 'uuid';
import { env } from '@/src/lib/env';

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const { packageId } = await request.json();

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
    const txRef = `tx-${uuidv4()}`;
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
      pkg.price_minor / 100, // Flutterwave expects major currency units (e.g., NGN instead of Kobo, but usually we just divide by 100 if we stored minor units)
      // wait, the prompt says "price_minor", so if price is 500,000 NGN, maybe we stored it as 50,000,000 kobo? 
      // The seed data has 500000 for $500,000 ? Wait, Starter is 5,000 NGN (which is ~3 USD), so 500,000 in minor means 5,000.00 NGN.
      pkg.price_minor / 100,
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
