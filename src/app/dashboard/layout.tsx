
'use client'; // This layout relies on client-side hooks for auth and routing

import { ReactNode, useEffect, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
// Use client-side specific functions
import { isAuthenticated, isTokenExpiredClientSide, logout, getTokenClientSide } from '@/lib/auth';
import { Loader2 } from 'lucide-react';

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isAuthChecked, setIsAuthChecked] = useState(false); // Track initial check
  const [isValidSession, setIsValidSession] = useState(false); // Track current status

  useEffect(() => {
    // console.log("Dashboard Layout Effect: Checking auth...");

    const checkAuth = () => {
      const authenticated = isAuthenticated(); // Uses client-side check (localStorage, expiry)

      if (authenticated) {
        // console.log("Dashboard Layout Effect: User is authenticated.");
        setIsValidSession(true);
      } else {
        console.log("Dashboard Layout Effect: User is NOT authenticated.");
        setIsValidSession(false);

        // Check if a token exists in localStorage but is expired
        const tokenExistsButExpired = !!getTokenClientSide() && isTokenExpiredClientSide();

        // Construct redirect URL
        const loginUrl = new URL('/login', window.location.origin);
        // Preserve the intended destination unless it was already /login or /register
        if (pathname !== '/login' && pathname !== '/register') {
            const redirectPath = pathname + searchParams.toString();
            loginUrl.searchParams.set('redirect', redirectPath);
            sessionStorage.setItem('loginRedirect', redirectPath); // Also store in session storage just in case
        }

        // Add sessionExpired flag if token was present but invalid/expired
        if (tokenExistsButExpired) {
            loginUrl.searchParams.set('sessionExpired', 'true');
             console.log("Dashboard Layout Effect: Redirecting to login (session expired).");
            // Trigger logout to ensure cleanup and redirection happens correctly
            // The logout function now handles the router.replace call
            logout(router, true); // Pass router instance and expiry flag
            return; // Exit early as logout handles redirection
        } else {
             console.log("Dashboard Layout Effect: Redirecting to login (not authenticated).");
        }

        // Use router.replace for redirection - avoids adding the redirect source to history
        // Only redirect explicitly if logout wasn't called (e.g., no token at all)
        router.replace(loginUrl.toString());
      }
      setIsAuthChecked(true); // Mark auth check as complete AFTER potentially redirecting
    };

    checkAuth();

    // Optional: Interval check - Consider removing if middleware handles this robustly
    // const intervalId = setInterval(() => {
    //   if (!isAuthenticated()) {
    //      console.log("Dashboard Layout Effect: Session expired during interval check.");
    //      // Call logout which handles redirection
    //      logout(router, true); // Pass router instance and expiry flag
    //   }
    // }, 5 * 60 * 1000); // Check every 5 minutes

    // return () => clearInterval(intervalId); // Cleanup interval

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
   // Prevents dashboard flashing before redirect.
   if (isAuthChecked && !isValidSession) {
       // console.log("Dashboard Layout Effect: Auth checked, session invalid. Rendering null.");
       return null; // Or a minimal "Redirecting..." message
   }

  // 3. If auth check is done AND the session IS valid, render the dashboard.
  return (
      <div className="flex h-screen bg-background text-foreground overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-x-hidden overflow-y-auto bg-muted/30 p-4 md:p-6 lg:p-8">
            {children}
          </main>
        </div>
      </div>
  );
}
