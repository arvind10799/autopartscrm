import type { NextResponse } from 'next/server';
import { getAuthCookieMaxAgeSeconds } from '@/lib/config/env.server';
import type {
  AuthBackendSession,
  AuthUser,
  ClientSession,
  SessionCookieSnapshot,
  UserRole,
} from '../types/auth.types';

export const AUTH_COOKIE_NAMES = {
  accessToken: 'crm_access_token',
  role: 'crm_user_role',
  name: 'crm_user_name',
  email: 'crm_user_email',
  userId: 'crm_user_id',
} as const;

type CookieReader = {
  get(name: string): { value: string } | undefined;
};

function getCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: getAuthCookieMaxAgeSeconds(),
  };
}

export function applyAuthCookies(
  response: NextResponse,
  session: AuthBackendSession,
) {
  const options = getCookieOptions();

  response.cookies.set(AUTH_COOKIE_NAMES.accessToken, session.accessToken, options);
  response.cookies.set(AUTH_COOKIE_NAMES.role, session.user.role, options);
  response.cookies.set(AUTH_COOKIE_NAMES.name, session.user.name, options);
  response.cookies.set(AUTH_COOKIE_NAMES.email, session.user.email, options);
  response.cookies.set(AUTH_COOKIE_NAMES.userId, session.user.userId, options);
}

export function clearAuthCookies(response: NextResponse) {
  response.cookies.delete(AUTH_COOKIE_NAMES.accessToken);
  response.cookies.delete(AUTH_COOKIE_NAMES.role);
  response.cookies.delete(AUTH_COOKIE_NAMES.name);
  response.cookies.delete(AUTH_COOKIE_NAMES.email);
  response.cookies.delete(AUTH_COOKIE_NAMES.userId);
}

export function readSessionFromCookies(
  cookieStore: CookieReader,
): SessionCookieSnapshot {
  const roleValue = normalizeCookieValue(
    cookieStore.get(AUTH_COOKIE_NAMES.role)?.value,
  );
  const accessToken = normalizeCookieValue(
    cookieStore.get(AUTH_COOKIE_NAMES.accessToken)?.value,
  );
  const name = normalizeCookieValue(
    cookieStore.get(AUTH_COOKIE_NAMES.name)?.value,
  );
  const email = normalizeCookieValue(
    cookieStore.get(AUTH_COOKIE_NAMES.email)?.value,
  );
  const userId = normalizeCookieValue(
    cookieStore.get(AUTH_COOKIE_NAMES.userId)?.value,
  );

  if (!accessToken || !email || !userId || !isUserRole(roleValue ?? undefined)) {
    return {
      accessToken: null,
      role: null,
      name: null,
      email: null,
      userId: null,
    };
  }

  const role = roleValue as UserRole;

  return {
    accessToken,
    role,
    name,
    email,
    userId,
  };
}

function isUserRole(value: string | undefined): value is UserRole {
  return value === 'ADMIN' || value === 'SALES' || value === 'SHIPPING';
}

export function toClientSession(user: AuthUser): ClientSession {
  return {
    user,
  };
}

function normalizeCookieValue(value: string | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalizedValue = value.trim();

  return normalizedValue.length > 0 ? normalizedValue : null;
}
