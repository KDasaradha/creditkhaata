
'use client'; // This layout relies on client-side hooks for auth and routing

import { ReactNode, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import { isAuthenticated, isTokenExpired } from '@/lib/auth';
import { Loader2 } from 'lucide-react'; // For loading indicator

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthChecked, setIsAuthChecked] = useState(false); // Track if auth check is done
  const [isValidSession, setIsValidSession] = useState(false); // Track auth status

  useEffect(() => {
    const checkAuth = () => {
      const authenticated = isAuthenticated(); // Checks token presence and expiry
      setIsValidSession(authenticated);
      setIsAuthChecked(true); // Mark auth check as complete

      if (!authenticated) {
        // Determine if the token is just expired or completely missing
        const sessionExpired = isTokenExpired() && localStorage.getItem('credikhaata_token'); // Check if token exists but expired
        const redirectUrl = sessionExpired ? `/login?sessionExpired=true&redirect=${pathname}` : `/login?redirect=${pathname}`;
        router.replace(redirectUrl); // Use replace to avoid adding login to history when redirected
      }
    };

    checkAuth();

    // Optional: Add an interval to re-check token expiry periodically?
    // const intervalId = setInterval(() => {
    //   if (isTokenExpired()) {
    //     checkAuth(); // Re-run check and redirect if expired
    //   }
    // }, 60 * 1000); // Check every minute

    // return () => clearInterval(intervalId);

  }, [router, pathname]); // Rerun check if path changes (might be overkill)

  // Show loading state while checking authentication
   if (!isAuthChecked) {
     return (
       <div className="flex items-center justify-center min-h-screen bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
          <span>Verifying session...</span>
       </div>
     );
   }

   // If authentication check is done but the session is not valid, render null
   // This prevents flashing the layout briefly before redirect happens
   if (!isValidSession) {
       return null; // Or a minimal message indicating redirection
   }

  // Render the main dashboard layout if authenticated
  return (
      <div className="flex h-screen bg-background text-foreground overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header />
          {/* Ensure main content area scrolls independently */}
          <main className="flex-1 overflow-x-hidden overflow-y-auto bg-secondary/5 p-4 md:p-6 lg:p-8">
            {children}
          </main>
        </div>
      </div>
  );
}
