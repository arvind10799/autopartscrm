'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { HttpError } from '@/lib/api/http-error';
import { resolveAuthorizedRedirectPath } from '../lib/permissions';
import { loginSchema, type LoginSchema } from '../schemas/login.schema';
import { useAuthStore } from '../store/auth.store';
import { authApi } from '../api/auth-api';



export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setSession = useAuthStore((state) => state.setSession);
  const setLoading = useAuthStore((state) => state.setLoading);
  const clearSession = useAuthStore((state) => state.clearSession);
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<LoginSchema>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    setLoading();

    try {
      const session = await authApi.login(values);
      setSession(session);

      const nextPath = resolveAuthorizedRedirectPath(
        searchParams.get('next'),
        session.user.role,
      );

      router.replace(nextPath);
      router.refresh();
    } catch (error) {
      clearSession();

      if (error instanceof HttpError) {
        setFormError(error.message);
        return;
      }

      setFormError('Login failed. Please try again.');
    }
  });

  return (
    <Card className="w-full max-w-xl border-border/70 bg-white/95">
      <CardHeader className="space-y-4">
        <span className="inline-flex w-fit items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-primary">
          <ShieldCheck className="h-3.5 w-3.5" />
          Secure Sign In
        </span>
        <CardTitle>Welcome back</CardTitle>
        <CardDescription>
          Sign in with the account already created in the CRM database. Your workspace opens based on your role.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <form className="space-y-5" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="name@company.com"
              {...form.register('email')}
            />
            {form.formState.errors.email ? (
              <p className="text-sm text-destructive">
                {form.formState.errors.email.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <PasswordInput
              id="password"
              autoComplete="current-password"
              placeholder="Enter your password"
              {...form.register('password')}
            />
            {form.formState.errors.password ? (
              <p className="text-sm text-destructive">
                {form.formState.errors.password.message}
              </p>
            ) : null}
          </div>

          {formError ? (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {formError}
            </div>
          ) : null}

          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting ? 'Signing in...' : 'Sign in'}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </form>


      </CardContent>
    </Card>
  );
}
