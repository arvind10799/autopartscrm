import type { Metadata, Viewport } from 'next';
import type { CSSProperties } from 'react';
import { PwaServiceWorkerRegistration } from '@/components/pwa/PwaServiceWorkerRegistration';
import { APP_DESCRIPTION } from '@/lib/constants/app';
import { clientEnv } from '@/lib/config/env.client';
import { ThemeInitScript } from '@/lib/theme/theme-init-script';
import { Providers } from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'Mee AUTO PARTS CRM',
  description: APP_DESCRIPTION,
  metadataBase: new URL(clientEnv.NEXT_PUBLIC_APP_URL),
  applicationName: 'Mee AUTO PARTS CRM',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Mee AUTO PARTS CRM',
  },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
};

export const viewport: Viewport = {
  themeColor: '#ff5a00',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeInitScript />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
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
        suppressHydrationWarning
      >
        <PwaServiceWorkerRegistration />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
