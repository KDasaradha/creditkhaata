
import type { Metadata } from 'next';
import { Inter } from 'next/font/google'; // Correct import
import './globals.css';
import { cn } from '@/lib/utils';
import { Toaster } from "@/components/ui/toaster"; // Import Toaster if using Shadcn toasts

// Configure Inter font
const inter = Inter({
    subsets: ['latin'],
    variable: '--font-sans', // Add CSS variable for easier access in Tailwind
});

export const metadata: Metadata = {
  title: 'CrediKhaata - Loan Tracker',
  description: 'Simple loan tracking for small businesses.',
  // Add more metadata like icons, open graph, etc.
   icons: {
     // Add a placeholder or actual icon path later
     // icon: "/favicon.ico",
   },
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
          inter.variable // Apply the font variable
        )}>
        {children}
         <Toaster /> {/* Add Toaster component for Shadcn toasts */}
      </body>
    </html>
  );
}

    