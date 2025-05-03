import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { cn } from '@/lib/utils';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'CrediKhaata - Loan Tracker',
  description: 'Simple loan tracking for small businesses.',
  // Add more metadata like icons, open graph, etc.
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn(
          "min-h-screen bg-background font-sans antialiased",
          inter.className // Apply the Inter font
        )}>
        {children}
      </body>
    </html>
  );
}
