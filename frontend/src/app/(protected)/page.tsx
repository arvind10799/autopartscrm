import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDefaultRouteForRole } from '@/features/auth/lib/permissions';
import { readSessionFromCookies } from '@/features/auth/lib/auth-session';

export default async function ProtectedIndexPage() {
  const session = readSessionFromCookies(await cookies());

  if (!session.role) {
    redirect('/login');
  }

  redirect(getDefaultRouteForRole(session.role));
}
