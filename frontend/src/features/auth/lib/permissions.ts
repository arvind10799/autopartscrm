import {
  matchNavigationItem,
  navigationConfig,
  type NavigationItemConfig,
} from '@/lib/config/navigation';
import type { UserRole } from '../types/auth.types';

export function getDefaultRouteForRole(role: UserRole): string {
  const matchedRoute = navigationConfig.find((route) =>
    route.defaultFor?.includes(role),
  );

  return matchedRoute?.href ?? '/dashboard';
}

export function hasRouteAccess(pathname: string, role: UserRole): boolean {
  const matchedRoute = matchNavigationItem(pathname);

  if (!matchedRoute) {
    return true;
  }

  return matchedRoute.roles.includes(role);
}

export function getNavigationForRole(role: UserRole): NavigationItemConfig[] {
  return navigationConfig.filter((item) => item.roles.includes(role));
}

export function isProtectedPath(pathname: string): boolean {
  return matchNavigationItem(pathname) !== null;
}

export function resolveAuthorizedRedirectPath(
  requestedPath: string | null,
  role: UserRole,
): string {
  const normalizedPath = normalizeRedirectPath(requestedPath);

  if (!normalizedPath || !isProtectedPath(normalizedPath)) {
    return getDefaultRouteForRole(role);
  }

  return hasRouteAccess(normalizedPath, role)
    ? normalizedPath
    : getDefaultRouteForRole(role);
}

function normalizeRedirectPath(requestedPath: string | null): string | null {
  if (!requestedPath) {
    return null;
  }

  const trimmedPath = requestedPath.trim();

  if (
    !trimmedPath.startsWith('/') ||
    trimmedPath.startsWith('//') ||
    trimmedPath === '/login' ||
    trimmedPath === '/forbidden'
  ) {
    return null;
  }

  try {
    const normalizedUrl = new URL(trimmedPath, 'http://localhost');

    return `${normalizedUrl.pathname}${normalizedUrl.search}`;
  } catch {
    return null;
  }
}
