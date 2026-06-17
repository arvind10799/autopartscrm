import { NextResponse } from 'next/server';
import { clearAuthCookies } from '@/features/auth/lib/auth-session';

export async function POST() {
  const response = NextResponse.json({
    success: true,
    data: null,
    message: 'Logged out successfully.',
  });

  clearAuthCookies(response);
  response.headers.set('Cache-Control', 'no-store');

  return response;
}
