
'use client'; // This layout relies on client-side hooks for auth and routing

import { ReactNode, useEffect, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import { isAuthenticated, isTokenExpired, logout } from '@/lib/auth'; // Import logout
import { Loader2 } from 'lucide-react';

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams(); // Get search params
  const [isAuthChecked, setIsAuthChecked] = useState(false); // Track if initial auth check is done
  const [isValidSession, setIsValidSession] = useState(false); // Track current auth status

  useEffect(() => {
    // console.log("Dashboard Layout Effect: Checking auth...");

    const checkAuth = () => {
      const authenticated = isAuthenticated(); // Checks token presence AND expiry

      if (authenticated) {
        // console.log("Dashboard Layout Effect: User is authenticated.");
        setIsValidSession(true);
      } else {
        // console.log("Dashboard Layout Effect: User is NOT authenticated.");
        setIsValidSession(false);
        const tokenExistsButExpired = isTokenExpired() && (localStorage.getItem('credikhaata_token') || document.cookie.includes('credikhaata_token'));

        // Construct redirect URL
        const loginUrl = new URL('/login', window.location.origin);
        // Preserve the intended destination *unless* it was already /login or /register
        if (pathname !== '/login' && pathname !== '/register') {
            loginUrl.searchParams.set('redirect', pathname + searchParams.toString()); // Include current search params too
        }
        if (tokenExistsButExpired) {
            loginUrl.searchParams.set('sessionExpired', 'true');
            // Force logout to clear any residual invalid tokens
            logout();
             console.log("Dashboard Layout Effect: Redirecting to login (session expired).");
        } else {
             console.log("Dashboard Layout Effect: Redirecting to login (not authenticated).");
        }

        // Use router.replace for redirection - avoids adding the redirect source to history
        router.replace(loginUrl.toString());
      }
      setIsAuthChecked(true); // Mark auth check as complete AFTER potentially redirecting
    };

    checkAuth();

    // Optional: Add interval check for token expiry during long sessions?
    // Be mindful of performance implications.
    // const intervalId = setInterval(() => {
    //   if (!isAuthenticated()) { // Re-check using the combined function
    //      console.log("Dashboard Layout Effect: Session expired during interval check. Re-running auth check.");
    //     checkAuth(); // Re-run check and potential redirect
    //   }
    // }, 5 * 60 * 1000); // Check every 5 minutes

    // return () => clearInterval(intervalId); // Cleanup interval on unmount

  }, [pathname, router, searchParams]); // Rerun check if path or router changes

  // --- Render Logic ---

  // 1. Show loading state ONLY while the initial auth check is pending.
   if (!isAuthChecked) {
     return (
       <div className="flex items-center justify-center min-h-screen bg-background text-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-primary mr-3" />
          <span className="text-lg">Verifying session...</span>
       </div>
     );
   }

   // 2. If auth check is done BUT the session is NOT valid, render null.
   // This prevents the dashboard layout flashing briefly before the redirect in useEffect happens.
   if (isAuthChecked && !isValidSession) {
       // console.log("Dashboard Layout Effect: Auth checked, session invalid. Rendering null.");
       return null; // Or a minimal "Redirecting..." message
   }

  // 3. If auth check is done AND the session IS valid, render the dashboard layout.
  return (
      <div className="flex h-screen bg-background text-foreground overflow-hidden">
        {/* Sidebar - adjust props if needed */}
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header - adjust props if needed */}
          <Header />
          {/* Main Content Area - ensure it scrolls independently */}
          <main className="flex-1 overflow-x-hidden overflow-y-auto bg-muted/30 p-4 md:p-6 lg:p-8">
            {children}
          </main>
        </div>
      </div>
  );
}
