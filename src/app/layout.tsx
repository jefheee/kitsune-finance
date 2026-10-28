import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import AppShell from '@/components/layout/AppShell';
import { ThemeProvider } from '@/components/theme-provider';
import { FinanceDataProvider } from '@/context/FinanceDataContext';
import ServiceWorkerRegistrar from '@/components/ServiceWorkerRegistrar';
import OnboardingModal from '@/components/OnboardingModal';

const fontSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-plus-jakarta',
  display: 'swap',
  weight: ['400', '500', '600', '700', '800'],
});

const fontMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Kitsune Finance',
  description: 'AI-driven wealth management in a clean, high-performance interface.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Kitsune',
  },
  icons: {
    icon: '/assets/logo/logo_sem_fundo.png',
    apple: '/assets/logo/logo.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#09090b',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${fontSans.variable} ${fontMono.variable}`} suppressHydrationWarning>
      <head>
        <meta name="darkreader-lock" />
        <meta name="color-scheme" content="dark light" />
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="manifest" href="/manifest.json" />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-[#09090b] text-zinc-100 antialiased" suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <FinanceDataProvider>
            <ServiceWorkerRegistrar />
            <OnboardingModal />
            <AppShell>{children}</AppShell>
          </FinanceDataProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
