import { createClient } from './supabase/server';
import { requireApiUser } from './auth';
import { AccountBootstrapError, bootstrapUser } from './user-bootstrap';

export async function getUserWallet() {
  const user = await requireApiUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('wallets')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    console.error('Error fetching wallet:', error);
    throw new Error('Failed to load wallet');
  }

  if (data) {
    return data;
  }

  await bootstrapUser(user);

  const { data: initializedWallet, error: initializedWalletError } = await supabase
    .from('wallets')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (initializedWalletError) {
    console.error('Error fetching initialized wallet:', initializedWalletError);
    throw new AccountBootstrapError();
  }

  if (!initializedWallet) {
    throw new AccountBootstrapError(
      'Your account exists, but its wallet could not be initialized.',
    );
  }

  return initializedWallet;
}

export async function getUserTransactions(limit = 50) {
  const user = await requireApiUser();
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('credit_transactions')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching transactions:', error);
    throw new Error('Failed to load transactions');
  }

  return data;
}

export async function getCreditPackages() {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('credit_packages')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('Error fetching credit packages:', error);
    throw new Error('Failed to load packages');
  }

  return data;
}
