
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Menu, LogOut, UserCircle, Sun, Moon } from 'lucide-react';
import Sidebar from './Sidebar';
import { getDecodedToken, logout, isTokenExpired, getToken } from '@/lib/auth'; // Import necessary auth functions
import { useRouter } from 'next/navigation';
// Uncomment if using next-themes
// import { useTheme } from 'next-themes';

interface DecodedToken {
  id: string; // From JWT payload
  email: string; // From JWT payload
}

export default function Header() {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false); // Control mobile sheet visibility
  const router = useRouter();
  // Uncomment if using next-themes
  // const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false); // State to track component mount for theme toggle

  useEffect(() => {
     setMounted(true); // Component has mounted

     // Check token validity and extract user email
     if (typeof window !== 'undefined') {
         if (!getToken() || isTokenExpired()) {
             // If token is missing or expired on initial load, trigger logout logic
             console.log("Header Effect: Token missing or expired on load.");
             // handleLogout(true); // Let DashboardLayout handle initial redirect
             setUserEmail(null); // Ensure email is cleared
         } else {
             try {
                const decoded = getDecodedToken(); // Decodes token from cookie/localStorage
                if (decoded && decoded.email) {
                  setUserEmail(decoded.email);
                //   console.log("Header Effect: User email set -", decoded.email);
                } else {
                    console.warn("Header Effect: Token decoded but email missing.");
                    setUserEmail(null);
                     // Optionally trigger logout if payload is invalid
                     // handleLogout(false);
                }
             } catch (error) {
                 console.error("Header Effect: Failed to decode token:", error);
                 setUserEmail(null);
                 // Optionally trigger logout on decode error
                 // handleLogout(false);
             }
         }
     }
  }, []); // Run only once on mount

   const handleLogout = (sessionExpired = false) => {
    console.log(`Header: Initiating logout (sessionExpired: ${sessionExpired})`);
    logout(); // Clears token from cookie and localStorage
    // Redirect to login page. The middleware and DashboardLayout should also handle this,
    // but explicit redirect here ensures it happens immediately on user action.
    const redirectUrl = sessionExpired ? '/login?sessionExpired=true' : '/login';
    router.push(redirectUrl);
    // Optional: Force a full page refresh if state issues persist after logout
    // window.location.href = redirectUrl;
  };

  // Prevent theme toggle flicker on mount
  // if (!mounted) {
  //   return null; // Or a placeholder
  // }


  return (
    <header className="flex h-16 items-center justify-between border-b bg-card px-4 md:px-6 sticky top-0 z-30 flex-shrink-0 print:hidden">
      {/* Mobile Menu Button */}
      <div className="md:hidden">
        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" aria-label="Toggle navigation menu">
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-full max-w-xs p-0" >
            {/* Pass isMobile and a function to close the sheet */}
             {/* The Link components within Sidebar should handle closing */}
             <Sidebar isMobile={true} onNavigate={() => setIsSheetOpen(false)} />
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop: Placeholder or App Name/Title - kept minimal */}
       <div className="hidden md:flex items-center gap-4">
           {/* Could add Breadcrumbs or dynamic page title here later */}
       </div>


      {/* Right Side: User Info and Actions */}
      <div className="flex items-center gap-3 md:gap-4">
         {/* Display User Email */}
         {userEmail && (
            <div className="flex items-center gap-2 text-sm" title={userEmail}>
                 <UserCircle className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                 <span className="hidden sm:inline max-w-[150px] truncate text-muted-foreground font-medium">{userEmail}</span>
            </div>
         )}

          {/* Optional: Theme Toggle Example */}
          {/*
          <Button
             variant="outline"
             size="icon"
             onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
             aria-label="Toggle theme"
           >
             {theme === 'dark' ?
                <Sun className="h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              : <Moon className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              }
           </Button>
           */}

        {/* Logout Button */}
        <Button variant="outline" size="sm" onClick={() => handleLogout(false)}>
          <LogOut className="mr-1.5 h-4 w-4" />
          Logout
        </Button>
      </div>
    </header>
  );
}
