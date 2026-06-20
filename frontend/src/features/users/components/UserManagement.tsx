'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  UserPlus,
  Users,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { HttpError } from '@/lib/api/http-error';
import { usersApi } from '../api/users-api';
import {
  createUserSchema,
  type CreateUserSchema,
} from '../schemas/user.schema';
import type { UserRecord } from '../types/user.types';

const roleBadgeVariants: Record<string, string> = {
  ADMIN: 'bg-violet-100 text-violet-700 border-violet-200',
  SALES: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  SHIPPING: 'bg-sky-100 text-sky-700 border-sky-200',
};

export function UserManagement() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const form = useForm<CreateUserSchema>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      name: '',
      email: '',
      role: 'SALES',
      password: '',
    },
  });

  const loadUsers = useCallback(async () => {
    try {
      setIsLoadingUsers(true);
      const data = await usersApi.list();
      setUsers(data);
    } catch {
      // Silently fail — users will see an empty list
    } finally {
      setIsLoadingUsers(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    setSuccessMessage(null);

    try {
      await usersApi.create(values);
      const accountType =
        values.role === 'SALES' ? 'sales agent' : 'shipping account';
      setSuccessMessage(`${values.name} has been added as a ${accountType}.`);
      form.reset();
      await loadUsers();

      // Clear success after 5 seconds
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (error) {
      if (error instanceof HttpError) {
        setFormError(error.message);
        return;
      }
      setFormError('Failed to create user. Please try again.');
    }
  });

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
      {/* LEFT: Create User Form */}
      <Card className="border-slate-200/80 bg-white shadow-sm">
        <CardHeader className="space-y-3 pb-6">
          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-violet-600">
            <UserPlus className="h-3.5 w-3.5" />
            Add User
          </span>
          <CardTitle className="text-lg">Create New User Account</CardTitle>
          <CardDescription>
            Admins can create sales agents and shipping accounts from this
            workspace.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <form className="space-y-5" onSubmit={onSubmit}>
            <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                <Users className="h-4 w-4" />
              </div>
              <div>
                <p className="font-medium">Sales and shipping access</p>
                <p className="mt-1 text-emerald-700/80">
                  Choose the right role for each new team member before they
                  sign in.
                </p>
              </div>
            </div>

            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="create-user-name">Full Name</Label>
              <Input
                id="create-user-name"
                type="text"
                autoComplete="off"
                placeholder="John Doe"
                {...form.register('name')}
              />
              {form.formState.errors.name ? (
                <p className="text-sm text-destructive">
                  {form.formState.errors.name.message}
                </p>
              ) : null}
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="create-user-email">Email</Label>
              <Input
                id="create-user-email"
                type="email"
                autoComplete="off"
                placeholder="agent@meeautoparts.com"
                {...form.register('email')}
              />
              {form.formState.errors.email ? (
                <p className="text-sm text-destructive">
                  {form.formState.errors.email.message}
                </p>
              ) : null}
            </div>

            {/* Role */}
            <div className="space-y-2">
              <Label htmlFor="create-user-role">Role</Label>
              <Select id="create-user-role" {...form.register('role')}>
                <option value="SALES">Sales Agent</option>
                <option value="SHIPPING">Shipping Account</option>
              </Select>
              {form.formState.errors.role ? (
                <p className="text-sm text-destructive">
                  {form.formState.errors.role.message}
                </p>
              ) : null}
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label htmlFor="create-user-password">Password</Label>
              <Input
                id="create-user-password"
                type="password"
                autoComplete="new-password"
                placeholder="Minimum 8 characters"
                {...form.register('password')}
              />
              {form.formState.errors.password ? (
                <p className="text-sm text-destructive">
                  {form.formState.errors.password.message}
                </p>
              ) : null}
            </div>

            {/* Error message */}
            {formError ? (
              <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                {formError}
              </div>
            ) : null}

            {/* Success message */}
            {successMessage ? (
              <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-600">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                {successMessage}
              </div>
            ) : null}

            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Create User Account
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* RIGHT: Users List */}
      <Card className="border-slate-200/80 bg-white shadow-sm">
        <CardHeader className="space-y-3 pb-6">
          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-sky-600">
            <Users className="h-3.5 w-3.5" />
            Team
          </span>
          <CardTitle className="text-lg">All Users</CardTitle>
          <CardDescription>
            {users.length} {users.length === 1 ? 'user' : 'users'} registered in
            the system.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {isLoadingUsers ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <Loader2 className="mb-3 h-6 w-6 animate-spin" />
              <p className="text-sm">Loading users...</p>
            </div>
          ) : users.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <Users className="mb-3 h-8 w-8 opacity-40" />
              <p className="text-sm">No users found.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center gap-4 py-3.5 first:pt-0 last:pb-0"
                >
                  {/* Avatar */}
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-100 to-slate-200 text-sm font-semibold text-slate-600">
                    {user.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .toUpperCase()
                      .slice(0, 2)}
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {user.name}
                    </p>
                    <p className="truncate text-xs text-slate-400">
                      {user.email}
                    </p>
                  </div>

                  {/* Role Badge */}
                  <Badge
                    variant="outline"
                    className={`shrink-0 text-xs ${roleBadgeVariants[user.role] ?? ''}`}
                  >
                    {user.role}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
