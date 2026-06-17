import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { LOGIN_ROUTE } from '@/features/auth/constants/auth-routes';
import { getDefaultRouteForRole } from '@/features/auth/lib/permissions';
import { readSessionFromCookies } from '@/features/auth/lib/auth-session';

export default async function HomePage() {
  const session = readSessionFromCookies(await cookies());

  if (!session.accessToken || !session.role) {
    redirect(LOGIN_ROUTE);
  }

  redirect(getDefaultRouteForRole(session.role));
}
