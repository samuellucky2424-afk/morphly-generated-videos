import { redirect } from 'next/navigation';
import { ResetPasswordForm } from './reset-password-form';
import { getUser } from '@/src/lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AdminResetPasswordPage() {
  const user = await getUser();

  if (!user?.email) {
    redirect('/admin/login?reason=signin');
  }

  return <ResetPasswordForm email={user.email} />;
}
