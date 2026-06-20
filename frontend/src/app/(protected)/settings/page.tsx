import { UserManagement } from '@/features/users/components/UserManagement';

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          User Center
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage user access for the CRM platform.
        </p>
      </div>

      <UserManagement />
    </div>
  );
}
