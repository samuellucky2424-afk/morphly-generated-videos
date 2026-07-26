import type { User } from '@supabase/supabase-js';
import { createAdminClient } from '@/src/lib/supabase/admin';

export class AccountBootstrapError extends Error {
  constructor(message = 'Unable to initialize this Morphly account.') {
    super(message);
    this.name = 'AccountBootstrapError';
  }
}

export async function bootstrapUser(user: User) {
  if (!user.email) {
    throw new AccountBootstrapError('A verified email address is required.');
  }

  try {
    const admin = createAdminClient();
    const { error } = await admin.rpc('bootstrap_new_user', {
      p_user_id: user.id,
      p_email: user.email,
      p_display_name:
        user.user_metadata?.full_name ??
        user.user_metadata?.name ??
        user.email.split('@')[0] ??
        'Morphly User',
      p_referral_code_used: user.user_metadata?.referral_code_used ?? null,
    });

    if (error) {
      console.error('Unable to bootstrap Morphly user:', error);
      throw new AccountBootstrapError();
    }
  } catch (error) {
    if (error instanceof AccountBootstrapError) {
      throw error;
    }
    console.error('Unable to initialize Morphly user:', error);
    throw new AccountBootstrapError();
  }
}
