import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell/AppShell';
import { LOGIN_ROUTE } from '@/features/auth/constants/auth-routes';
import { readSessionFromCookies } from '@/features/auth/lib/auth-session';

export default async function ProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = readSessionFromCookies(await cookies());

  if (
    !session.accessToken ||
    !session.role ||
    !session.email ||
    !session.userId
  ) {
    redirect(LOGIN_ROUTE);
  }

  return (
    <AppShell
      user={{
        userId: session.userId,
        name: session.name ?? session.email,
        email: session.email,
        role: session.role,
      }}
    >
      {children}
    </AppShell>
  );
}
