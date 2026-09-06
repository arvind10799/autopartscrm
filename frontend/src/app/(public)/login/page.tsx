import { Suspense } from 'react';
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { LoginForm } from '@/features/auth/components/LoginForm';

export default function LoginPage() {
  return (
    <section className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(246,112,45,0.14),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(16,59,87,0.16),transparent_30%)] px-4 py-10 sm:px-6">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center gap-3">
          <div className="rounded-3xl border border-border/70 bg-card/90 px-6 py-4 shadow-sm backdrop-blur">
            <Image
              src="/images/mee-auto-parts-sidebar-logo.png"
              alt="MEE AUTO PARTS"
              width={300}
              height={120}
              priority
              className="h-auto w-[230px] sm:w-[280px]"
            />
          </div>
          <p className="text-center text-sm leading-6 text-muted-foreground">
            Auto Parts CRM — Secure workspace for your team
          </p>
        </div>

        <Suspense fallback={<LoginPageFallback />}>
          <LoginForm />
        </Suspense>

      </div>

      <div className="absolute bottom-5 right-5 hidden items-center gap-2 rounded-2xl border border-border/70 bg-card/85 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground shadow-sm backdrop-blur sm:flex">
        <span>Powered by</span>
        <Image
          src="/images/rock-one-solutions-logo.png"
          alt="Rock One Solutions"
          width={126}
          height={32}
          className="h-7 w-auto"
        />
      </div>
    </section>
  );
}

function LoginPageFallback() {
  return (
    <Card className="border-border/70 bg-card/90">
      <CardContent className="space-y-4 p-6">
        <div className="h-4 w-28 animate-pulse rounded-full bg-secondary" />
        <div className="h-10 w-44 animate-pulse rounded-2xl bg-secondary" />
        <div className="h-4 w-full animate-pulse rounded-full bg-secondary" />
        <div className="h-12 w-full animate-pulse rounded-2xl bg-secondary" />
        <div className="h-12 w-full animate-pulse rounded-2xl bg-secondary" />
        <div className="h-12 w-full animate-pulse rounded-2xl bg-secondary" />
      </CardContent>
    </Card>
  );
}
