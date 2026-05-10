import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const fontSans = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
});

const fontMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Kitsune Finance — Gestão Patrimonial Inteligente',
  description:
    'Gerencie seu patrimônio com IA. Open Finance, investimentos, e insights financeiros em tempo real.',
  keywords: [
    'gestão patrimonial',
    'open finance',
    'investimentos',
    'finanças pessoais',
    'kitsune finance',
  ],
  openGraph: {
    title: 'Kitsune Finance',
    description: 'Gestão Patrimonial Inteligente via Open Finance',
    type: 'website',
    locale: 'pt_BR',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#050505',
  colorScheme: 'dark',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${fontSans.variable} ${fontMono.variable}`}>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
