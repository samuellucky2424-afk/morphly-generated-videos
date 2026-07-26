import { AdminDashboard } from './admin-dashboard';
import { requireAdminPage } from '@/src/lib/admin-auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AdminPage() {
  const access = await requireAdminPage();
  const name =
    access.user.user_metadata?.full_name ??
    access.user.user_metadata?.name ??
    access.user.email ??
    'Administrator';

  return (
    <AdminDashboard
      adminEmail={access.user.email ?? ''}
      adminName={name}
      role={access.role}
    />
  );
}
