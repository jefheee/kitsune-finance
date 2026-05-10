import type { Metadata, Viewport } from 'next';
import './globals.css';

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
    <html lang="pt-BR">
      <body className="antialiased">{children}</body>
    </html>
  );
}
