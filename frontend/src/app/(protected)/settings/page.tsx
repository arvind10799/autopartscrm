import type { Metadata } from 'next';
import { UserManagement } from '@/features/users/components/UserManagement';

export const metadata: Metadata = {
  title: 'User Center',
};

export default function UserCenterPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          User Center
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage team access, user details, and secure password updates.
        </p>
      </div>

      <UserManagement />
    </div>
  );
}
