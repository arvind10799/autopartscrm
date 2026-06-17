export const USER_ROLES = ['ADMIN', 'SALES', 'SHIPPING'] as const;

export type UserRole = (typeof USER_ROLES)[number];

export interface AuthUser {
  userId: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface AuthBackendSession {
  accessToken: string;
  tokenType: 'Bearer';
  user: AuthUser;
}

export interface ClientSession {
  user: AuthUser;
}

export interface SessionCookieSnapshot {
  accessToken: string | null;
  role: UserRole | null;
  name: string | null;
  email: string | null;
  userId: string | null;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface ApiEnvelope<T> {
  success: boolean;
  data: T | null;
  message: string;
}
