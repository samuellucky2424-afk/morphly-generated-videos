import { redirect } from 'next/navigation';
import { AdminLoginForm } from './admin-login-form';
import { getAdminAccess } from '@/src/lib/admin-auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const access = await getAdminAccess();

  if (access.authorized) {
    redirect('/admin');
  }

  const { reason } = await searchParams;
  const initialMessage =
    reason === 'forbidden'
      ? 'The signed-in account does not have administrator access.'
      : reason === 'unverified'
        ? 'Verify this email address before opening the admin console.'
        : reason === 'unavailable' || access.reason === 'configuration'
          ? 'Administrator access is temporarily unavailable.'
          : undefined;

  return (
    <AdminLoginForm
      initialEmail={access.user?.email ?? undefined}
      initialMessage={initialMessage}
    />
  );
}
