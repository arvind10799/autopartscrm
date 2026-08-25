'use client';

import { usePathname } from 'next/navigation';
import { AppErrorBoundary } from '@/components/feedback/AppErrorBoundary';
import { ToastViewport } from '@/components/feedback/ToastViewport';
import { AuthBootstrap } from '@/features/auth/components/AuthBootstrap';
import { ThemeProvider } from '@/lib/theme/theme-provider';

export function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <ThemeProvider>
      <AppErrorBoundary resetKey={pathname}>
        <AuthBootstrap />
        {children}
        <ToastViewport />
      </AppErrorBoundary>
    </ThemeProvider>
  );
}
