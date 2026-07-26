import { env } from './env';

const FLW_API_BASE = 'https://api.flutterwave.com/v3';

interface FlutterwaveTransaction {
  id: string | number;
  status: string;
  tx_ref: string;
  amount: number;
  currency: string;
  app_fee: number;
  payment_type: string;
}

export async function generateCheckoutUrl(
  tx_ref: string,
  amount: number,
  currency: string,
  customerEmail: string,
  customerName: string,
  redirectUrl: string
) {
  const response = await fetch(`${FLW_API_BASE}/payments`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.FLW_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      tx_ref,
      amount,
      currency,
      redirect_url: redirectUrl,
      customer: {
        email: customerEmail,
        name: customerName,
      },
      customizations: {
        title: 'Morphly Credits',
        description: 'Purchase credits for Morphly AI Video Generation',
        logo: 'https://morphly.studio/logo.png',
      },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error('Flutterwave Error:', err);
    throw new Error('Failed to create Flutterwave checkout session');
  }

  const data = await response.json() as { data: { link: string } };
  return data.data.link; // The hosted checkout URL
}

export async function verifyTransaction(transactionId: string): Promise<FlutterwaveTransaction> {
  const response = await fetch(`${FLW_API_BASE}/transactions/${transactionId}/verify`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${env.FLW_SECRET_KEY}`,
    },
  });

  if (!response.ok) {
    const err = await response.text();
    console.error('Flutterwave Verify Error:', err);
    throw new Error('Failed to verify Flutterwave transaction');
  }

  const data = await response.json() as { data: FlutterwaveTransaction };
  return data.data; // Includes status, amount, currency, tx_ref
}
