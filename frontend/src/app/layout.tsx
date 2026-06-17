import type { Metadata } from 'next';
import type { CSSProperties } from 'react';
import { APP_DESCRIPTION } from '@/lib/constants/app';
import { clientEnv } from '@/lib/config/env.client';
import { Providers } from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: clientEnv.NEXT_PUBLIC_APP_NAME,
  description: APP_DESCRIPTION,
  metadataBase: new URL(clientEnv.NEXT_PUBLIC_APP_URL),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        style={
          {
            '--font-body':
              '"Segoe UI", "Helvetica Neue", Arial, sans-serif',
            '--font-heading':
              '"Aptos", "Segoe UI", "Helvetica Neue", Arial, sans-serif',
          } as CSSProperties
        }
        className="font-[var(--font-body)]"
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
