import type { User } from '@supabase/supabase-js';
import { redirect } from 'next/navigation';
import { createClient } from '@/src/lib/supabase/server';
import { createAdminClient } from '@/src/lib/supabase/admin';

const PRIMARY_ADMIN_EMAIL = 'samuellucky2424@gmail.com';
const ADMIN_ROLES = new Set(['admin', 'super_admin']);

export type AdminRole = 'admin' | 'super_admin';

type AdminAccess =
  | {
      authorized: true;
      role: AdminRole;
      user: User;
    }
  | {
      authorized: false;
      reason: 'unauthenticated' | 'unverified' | 'forbidden' | 'configuration';
      user: User | null;
    };

function normalizeEmail(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? '';
}

export function getBootstrapAdminEmails() {
  const configured = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map(normalizeEmail)
    .filter(Boolean);

  return new Set([PRIMARY_ADMIN_EMAIL, ...configured]);
}

export function isBootstrapAdminEmail(email: string | null | undefined) {
  return getBootstrapAdminEmails().has(normalizeEmail(email));
}

export async function getAdminAccess({
  bootstrap = true,
}: {
  bootstrap?: boolean;
} = {}): Promise<AdminAccess> {
  let user: User | null = null;

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ) {
    return {
      authorized: false,
      reason: 'configuration',
      user: null,
    };
  }

  try {
    const supabase = await createClient();
    const {
      data,
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !data.user) {
      return {
        authorized: false,
        reason: 'unauthenticated',
        user: null,
      };
    }

    user = data.user;
  } catch (error) {
    console.error('Unable to read the administrator session:', error);
    return {
      authorized: false,
      reason: 'configuration',
      user: null,
    };
  }

  if (!user.email || !user.email_confirmed_at) {
    return {
      authorized: false,
      reason: 'unverified',
      user,
    };
  }

  try {
    const admin = createAdminClient();
    const { data: roles, error: rolesError } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    if (rolesError) {
      console.error('Unable to read admin roles:', rolesError);
      return {
        authorized: false,
        reason: 'configuration',
        user,
      };
    }

    const matchingRole = roles
      ?.map(({ role }) => role)
      .find((role): role is AdminRole => ADMIN_ROLES.has(role));

    if (matchingRole) {
      return {
        authorized: true,
        role: matchingRole,
        user,
      };
    }

    if (!bootstrap || !isBootstrapAdminEmail(user.email)) {
      return {
        authorized: false,
        reason: 'forbidden',
        user,
      };
    }

    const { error: bootstrapError } = await admin.from('user_roles').upsert(
      {
        user_id: user.id,
        role: 'super_admin',
        created_by: user.id,
      },
      {
        onConflict: 'user_id,role',
        ignoreDuplicates: true,
      },
    );

    if (bootstrapError) {
      console.error('Unable to bootstrap the primary administrator:', bootstrapError);
      return {
        authorized: false,
        reason: 'configuration',
        user,
      };
    }

    const { error: auditError } = await admin.from('admin_audit_logs').insert({
      actor_user_id: user.id,
      action: 'bootstrap_super_admin',
      target_type: 'user_role',
      target_id: user.id,
      after_data: {
        email: normalizeEmail(user.email),
        role: 'super_admin',
      },
      reason: 'Verified primary administrator email allowlist',
    });

    if (auditError) {
      console.error('Unable to record the administrator bootstrap audit:', auditError);
    }

    return {
      authorized: true,
      role: 'super_admin',
      user,
    };
  } catch (error) {
    console.error('Unable to verify administrator access:', error);
    return {
      authorized: false,
      reason: 'configuration',
      user,
    };
  }
}

export async function requireAdminPage() {
  const access = await getAdminAccess();

  if (access.authorized) {
    return access;
  }

  const reason =
    access.reason === 'unauthenticated'
      ? 'signin'
      : access.reason === 'configuration'
        ? 'unavailable'
        : access.reason;

  redirect(`/admin/login?reason=${reason}`);
}
