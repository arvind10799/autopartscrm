import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { FORBIDDEN_ROUTE, LOGIN_ROUTE } from '@/features/auth/constants/auth-routes';
import { readSessionFromCookies } from '@/features/auth/lib/auth-session';
import {
  getDefaultRouteForRole,
  hasRouteAccess,
  isProtectedPath,
} from '@/features/auth/lib/permissions';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = readSessionFromCookies(request.cookies);

  if (pathname === '/') {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = session.role
      ? getDefaultRouteForRole(session.role)
      : LOGIN_ROUTE;

    return NextResponse.redirect(redirectUrl);
  }

  if (pathname === LOGIN_ROUTE) {
    if (!session.accessToken || !session.role) {
      return NextResponse.next();
    }

    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = getDefaultRouteForRole(session.role);

    return NextResponse.redirect(redirectUrl);
  }

  if (pathname === FORBIDDEN_ROUTE) {
    return NextResponse.next();
  }

  if (!isProtectedPath(pathname)) {
    return NextResponse.next();
  }

  if (!session.accessToken || !session.role) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = LOGIN_ROUTE;
    redirectUrl.searchParams.set(
      'next',
      `${pathname}${request.nextUrl.search}`,
    );

    return NextResponse.redirect(redirectUrl);
  }

  if (!hasRouteAccess(pathname, session.role)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = FORBIDDEN_ROUTE;
    redirectUrl.search = '';

    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
