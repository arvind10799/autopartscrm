'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  Shield,
  Trash2,
  UserCog,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Badge } from '@/components/ui/badge';
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
import { Select } from '@/components/ui/select';
import { HttpError } from '@/lib/api/http-error';
import { toast } from '@/lib/stores/toast.store';
import { usersApi } from '../api/users-api';
import {
  createUserSchema,
  updateUserPasswordSchema,
  type CreateUserSchema,
  type UpdateUserPasswordSchema,
} from '../schemas/user.schema';
import type { UserRecord } from '../types/user.types';

const roleBadgeVariants: Record<UserRecord['role'], string> = {
  ADMIN: 'bg-violet-100 text-violet-700 border-violet-200',
  SALES: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  SHIPPING: 'bg-sky-100 text-sky-700 border-sky-200',
};

const roleLabels: Record<UserRecord['role'], string> = {
  ADMIN: 'Admin',
  SALES: 'Sales Agent',
  SHIPPING: 'Shipping Account',
};

export function UserManagement() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [emailValue, setEmailValue] = useState('');
  const [roleValue, setRoleValue] = useState<'SALES' | 'SHIPPING'>('SALES');
  const [isUpdatingAccount, setIsUpdatingAccount] = useState(false);
  const [isDeletingUser, setIsDeletingUser] = useState(false);

  const form = useForm<CreateUserSchema>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      name: '',
      email: '',
      role: 'SALES',
      password: '',
    },
  });

  const passwordForm = useForm<UpdateUserPasswordSchema>({
    resolver: zodResolver(updateUserPasswordSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  });

  const loadUsers = useCallback(async () => {
    try {
      setIsLoadingUsers(true);
      const data = await usersApi.list();
      setUsers(data);
    } catch {
      setUsers([]);
    } finally {
      setIsLoadingUsers(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    if (!selectedUser) {
      return;
    }

    passwordForm.reset({
      password: '',
      confirmPassword: '',
    });
    setPasswordError(null);
    setAccountError(null);
    setEmailValue(selectedUser.email);
    if (selectedUser.role !== 'ADMIN') {
      setRoleValue(selectedUser.role);
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [passwordForm, selectedUser]);

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

      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (error) {
      if (error instanceof HttpError) {
        setFormError(error.message);
        return;
      }
      setFormError('Failed to create user. Please try again.');
    }
  });

  const onPasswordSubmit = passwordForm.handleSubmit(async (values) => {
    if (!selectedUser) {
      return;
    }

    setPasswordError(null);

    try {
      await usersApi.updatePassword(selectedUser.id, {
        password: values.password,
      });
      passwordForm.reset({
        password: '',
        confirmPassword: '',
      });
      toast.success(
        'Password updated successfully.',
        `${selectedUser.name} can now sign in with the new password.`,
      );
      await loadUsers();
    } catch (error) {
      if (error instanceof HttpError) {
        setPasswordError(error.message);
        return;
      }
      setPasswordError('Failed to update password. Please try again.');
    }
  });

  const handleAccountUpdate = async () => {
    if (!selectedUser) {
      return;
    }

    setAccountError(null);
    setIsUpdatingAccount(true);

    try {
      const updatedUser = await usersApi.update(selectedUser.id, {
        email: emailValue,
        role: selectedUser.role === 'ADMIN' ? undefined : roleValue,
      });
      setSelectedUser(updatedUser);
      toast.success(
        'User account updated.',
        `${updatedUser.name}'s email and role are up to date.`,
      );
      await loadUsers();
    } catch (error) {
      setAccountError(
        error instanceof HttpError
          ? error.message
          : 'Failed to update user. Please try again.',
      );
    } finally {
      setIsUpdatingAccount(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser || selectedUser.role === 'ADMIN') {
      return;
    }

    const confirmed = window.confirm(
      `Delete ${selectedUser.name}? This action cannot be undone.`,
    );
    if (!confirmed) {
      return;
    }

    setAccountError(null);
    setIsDeletingUser(true);

    try {
      await usersApi.delete(selectedUser.id);
      toast.success('User deleted.', `${selectedUser.name} has been removed.`);
      setSelectedUser(null);
      await loadUsers();
    } catch (error) {
      setAccountError(
        error instanceof HttpError
          ? error.message
          : 'Failed to delete user. Please try again.',
      );
    } finally {
      setIsDeletingUser(false);
    }
  };

  return (
    <>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
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

              <div className="space-y-2">
                <Label htmlFor="create-user-password">Password</Label>
                <PasswordInput
                  id="create-user-password"
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

              {formError ? (
                <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  {formError}
                </div>
              ) : null}

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

          <CardContent>
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
              <div className="overflow-hidden rounded-2xl border border-slate-200">
                <div className="grid grid-cols-[1.1fr_1.4fr_0.9fr_0.7fr_44px] bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  <span>Name</span>
                  <span>Email</span>
                  <span>Role</span>
                  <span>Status</span>
                  <span className="sr-only">View Details</span>
                </div>

                <div className="divide-y divide-slate-100">
                  {users.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      className="grid w-full cursor-pointer grid-cols-[1.1fr_1.4fr_0.9fr_0.7fr_44px] items-center gap-3 px-4 py-3.5 text-left transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => setSelectedUser(user)}
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-100 to-slate-200 text-xs font-semibold text-slate-600">
                          {getInitials(user.name)}
                        </span>
                        <span className="truncate text-sm font-medium text-slate-900">
                          {user.name}
                        </span>
                      </span>
                      <span className="truncate text-sm text-slate-500">
                        {user.email}
                      </span>
                      <span>
                        <RoleBadge role={user.role} />
                      </span>
                      <span>
                        <Badge variant="success">Active</Badge>
                      </span>
                      <span className="flex justify-end text-slate-400">
                        <Eye className="h-4 w-4" aria-hidden="true" />
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {selectedUser ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/45 px-4 py-4 backdrop-blur-sm sm:py-8"
          onClick={() => setSelectedUser(null)}
        >
          <div
            className="w-full max-w-2xl rounded-[1.75rem] border border-border/70 bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-border/70 px-6 py-5">
              <div className="space-y-1">
                <h2 className="font-[var(--font-heading)] text-2xl font-semibold tracking-[-0.03em] text-foreground">
                  User Details
                </h2>
                <p className="text-sm text-muted-foreground">
                  View account information and securely update the password.
                </p>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedUser(null)}
                aria-label="Close user details modal"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="max-h-[calc(100vh-7rem)] space-y-6 overflow-y-auto px-6 py-6">
              <section className="grid gap-3 sm:grid-cols-2">
                <UserDetailBlock label="Full Name" value={selectedUser.name} />
                <UserDetailBlock
                  label="Email Address"
                  value={
                    <a
                      href={`mailto:${selectedUser.email}`}
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      {selectedUser.email}
                    </a>
                  }
                />
                <UserDetailBlock
                  label="Role"
                  value={roleLabels[selectedUser.role]}
                />
                <UserDetailBlock label="Account Status" value="Active" />
                <UserDetailBlock
                  label="Created Date"
                  value={formatUserDate(selectedUser.createdAt)}
                />
              </section>

              <section className="rounded-2xl border border-border/70 bg-secondary/20 p-5">
                <div className="mb-5 flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <KeyRound className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">
                      Update Password
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Existing passwords are never shown. A new password is hashed
                      before it is saved.
                    </p>
                  </div>
                </div>

                <form className="space-y-4" onSubmit={onPasswordSubmit}>
                  <div className="space-y-2">
                    <Label htmlFor="new-password">New Password</Label>
                    <PasswordInput
                      id="new-password"
                      autoComplete="new-password"
                      placeholder="Minimum 8 characters"
                      {...passwordForm.register('password')}
                    />
                    {passwordForm.formState.errors.password ? (
                      <p className="text-sm text-destructive">
                        {passwordForm.formState.errors.password.message}
                      </p>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirm Password</Label>
                    <PasswordInput
                      id="confirm-password"
                      autoComplete="new-password"
                      placeholder="Re-enter new password"
                      {...passwordForm.register('confirmPassword')}
                    />
                    {passwordForm.formState.errors.confirmPassword ? (
                      <p className="text-sm text-destructive">
                        {passwordForm.formState.errors.confirmPassword.message}
                      </p>
                    ) : null}
                  </div>

                  {passwordError ? (
                    <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      {passwordError}
                    </div>
                  ) : null}

                  <div className="flex flex-wrap gap-3">
                    <Button
                      type="submit"
                      disabled={passwordForm.formState.isSubmitting}
                    >
                      {passwordForm.formState.isSubmitting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Updating...
                        </>
                      ) : (
                        <>
                          <KeyRound className="h-4 w-4" />
                          Update Password
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setSelectedUser(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </section>

              <section className="rounded-2xl border border-border/70 bg-white/70 p-5">
                <div className="mb-5 flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
                    <UserCog className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">
                      Account Management
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Change the email or role. Admin accounts keep their role and
                      cannot be deleted.
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="manage-user-email">Email Address</Label>
                    <Input
                      id="manage-user-email"
                      type="email"
                      value={emailValue}
                      onChange={(event) => setEmailValue(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="manage-user-role">Role</Label>
                    <Select
                      id="manage-user-role"
                      value={selectedUser.role === 'ADMIN' ? 'ADMIN' : roleValue}
                      disabled={selectedUser.role === 'ADMIN'}
                      onChange={(event) =>
                        setRoleValue(event.target.value as 'SALES' | 'SHIPPING')
                      }
                    >
                      {selectedUser.role === 'ADMIN' ? (
                        <option value="ADMIN">Admin</option>
                      ) : null}
                      <option value="SALES">Sales Agent</option>
                      <option value="SHIPPING">Shipping Account</option>
                    </Select>
                  </div>
                </div>

                {accountError ? (
                  <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    {accountError}
                  </div>
                ) : null}

                <div className="mt-5 flex flex-wrap gap-3">
                  <Button
                    type="button"
                    onClick={handleAccountUpdate}
                    disabled={isUpdatingAccount || isDeletingUser}
                  >
                    {isUpdatingAccount ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Mail className="h-4 w-4" />
                    )}
                    Save Account Changes
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                    onClick={handleDeleteUser}
                    disabled={
                      selectedUser.role === 'ADMIN' ||
                      isUpdatingAccount ||
                      isDeletingUser
                    }
                  >
                    {isDeletingUser ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                    Delete User
                  </Button>
                </div>

                {selectedUser.role === 'ADMIN' ? (
                  <div className="mt-4 flex items-start gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-700">
                    <Shield className="mt-0.5 h-4 w-4 shrink-0" />
                    Admin protection is active: role changes and deletion are disabled.
                  </div>
                ) : null}
              </section>

              <section className="rounded-2xl border border-dashed border-border/70 bg-white/70 p-5">
                <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                  <Lock className="h-4 w-4" />
                  Future actions
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {['Disable User', 'Activate User'].map((action) => (
                    <Button
                      key={action}
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled
                    >
                      <Lock className="h-3.5 w-3.5" />
                      {action}
                    </Button>
                  ))}
                </div>
              </section>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function RoleBadge({ role }: { role: UserRecord['role'] }) {
  return (
    <Badge
      variant="outline"
      className={`shrink-0 text-xs ${roleBadgeVariants[role]}`}
    >
      {roleLabels[role]}
    </Badge>
  );
}

function UserDetailBlock({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-secondary/20 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <div className="mt-2 text-sm font-medium text-foreground">{value}</div>
    </div>
  );
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function formatUserDate(value: string) {
  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return 'Unknown';
  }

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
  }).format(parsedDate);
}
