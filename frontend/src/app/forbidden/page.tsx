import Link from 'next/link';
import { cookies } from 'next/headers';
import { buttonVariants } from '@/components/ui/button';
import { getDefaultRouteForRole } from '@/features/auth/lib/permissions';
import { readSessionFromCookies } from '@/features/auth/lib/auth-session';
import { cn } from '@/lib/utils/cn';

export default async function ForbiddenPage() {
  const session = readSessionFromCookies(await cookies());
  const fallbackHref = session.role ? getDefaultRouteForRole(session.role) : '/login';

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="max-w-md space-y-4 rounded-2xl border border-border/80 bg-card/90 p-8 shadow-panel backdrop-blur">
        <span className="inline-flex rounded-full bg-destructive/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-destructive">
          Access blocked
        </span>
        <h1 className="font-[var(--font-heading)] text-3xl font-bold">
          You do not have permission to open that area.
        </h1>
        <p className="text-sm text-muted-foreground">
          Your account is signed in, but this route is reserved for another role. Head back to the workspace that matches your access level.
        </p>
        <Link
          href={fallbackHref}
          className={cn(buttonVariants({}), 'w-fit')}
        >
          Go to my workspace
        </Link>
      </div>
    </main>
  );
}
