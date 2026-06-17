import { Suspense } from 'react';
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { LoginForm } from '@/features/auth/components/LoginForm';

export default function LoginPage() {
  return (
    <section className="flex min-h-screen items-center justify-center px-4 py-10 sm:px-6">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center gap-3">
          <Image
            src="/logo.png"
            alt="Intracia Technologies"
            width={260}
            height={80}
            priority
            className="h-auto w-[220px] sm:w-[260px]"
          />
          <p className="text-center text-sm leading-6 text-muted-foreground">
            Auto Parts CRM — Secure workspace for your team
          </p>
        </div>

        <Suspense fallback={<LoginPageFallback />}>
          <LoginForm />
        </Suspense>

        <p className="text-center text-xs text-muted-foreground/70">
          &copy; {new Date().getFullYear()} Intracia Technologies. All rights reserved.
        </p>
      </div>
    </section>
  );
}

function LoginPageFallback() {
  return (
    <Card className="border-border/70 bg-white/90">
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
