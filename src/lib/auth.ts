import { createClient } from './supabase/server';
import { redirect } from 'next/navigation';

export class AuthenticationRequiredError extends Error {
  readonly status = 401;

  constructor() {
    super('Authentication required');
    this.name = 'AuthenticationRequiredError';
  }
}

export async function getUser() {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ) {
    return null;
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      return null;
    }
    return data.user;
  } catch (error) {
    console.error('Unable to read the Supabase user session:', error);
    return null;
  }
}

export async function requireUser() {
  const user = await getUser();
  if (!user) {
    redirect('/');
  }
  return user;
}

export async function requireApiUser() {
  const user = await getUser();
  if (!user) {
    throw new AuthenticationRequiredError();
  }
  return user;
}

export async function getProfile(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
    
  if (error) {
    console.error('Error fetching profile:', error);
    return null;
  }
  
  return data;
}

export async function getWallet(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('wallets')
    .select('*')
    .eq('user_id', userId)
    .single();
    
  if (error) {
    console.error('Error fetching wallet:', error);
    return null;
  }
  
  return data;
}
