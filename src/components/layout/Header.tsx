
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Menu, LogOut, UserCircle, Sun, Moon } from 'lucide-react';
import Sidebar from './Sidebar';
import { getDecodedToken, logout, isTokenExpired } from '@/lib/auth';
import { useRouter } from 'next/navigation';
// import { useTheme } from 'next-themes'; // Optional: If implementing theme toggle

interface DecodedToken {
  email: string;
}

export default function Header() {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false); // Control mobile sheet visibility
  const router = useRouter();
  // const { theme, setTheme } = useTheme(); // Optional: for theme toggle

  useEffect(() => {
     if (typeof window !== 'undefined') {
        if (isTokenExpired()) {
            // If token is expired on load, log out immediately
            handleLogout(true); // Pass flag to indicate session expired
            return;
        }
        const decoded = getDecodedToken();
        if (decoded) {
          setUserEmail(decoded.email);
        } else {
            // Token might be missing or invalid, trigger logout/redirect
             handleLogout(false); // Normal logout if no token found
        }
     }
  }, []); // Run only once on mount

   const handleLogout = (sessionExpired = false) => {
    logout();
    const redirectUrl = sessionExpired ? '/login?sessionExpired=true' : '/login';
    router.push(redirectUrl);
    // router.refresh(); // refresh might not be needed if push redirects fully
  };


  return (
    <header className="flex h-16 items-center justify-between border-b bg-card px-4 md:px-6 sticky top-0 z-30 flex-shrink-0">
      {/* Mobile Menu Button */}
      <div className="md:hidden">
        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon">
              <Menu className="h-6 w-6" />
               <span className="sr-only">Toggle navigation menu</span>
            </Button>
          </SheetTrigger>
          {/* Use portal={false} to avoid potential hydration issues if sidebar needs client logic */}
          <SheetContent side="left" className="w-full max-w-xs p-0" >
            {/* Pass isMobile and a function to close the sheet on navigation */}
             {/* <Sidebar isMobile={true} onNavigate={() => setIsSheetOpen(false)} /> */}
             <Sidebar isMobile={true} />
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop: Placeholder or App Name/Title */}
       <div className="hidden md:flex items-center gap-4">
           {/* Can add breadcrumbs or page title here */}
            {/* <h1 className="text-lg font-medium text-muted-foreground">Dashboard</h1> */}
       </div>


      {/* Right Side: User Info and Actions */}
      <div className="flex items-center gap-3 md:gap-4">
         {userEmail && (
            <div className="flex items-center gap-2 text-sm" title={userEmail}>
                 <UserCircle className="h-5 w-5 text-muted-foreground" />
                 <span className="hidden sm:inline max-w-[150px] truncate text-muted-foreground">{userEmail}</span>
            </div>
         )}

          {/* Optional: Theme Toggle */}
          {/* <Button
             variant="outline"
             size="icon"
             onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
             >
             {theme === 'dark' ? <Sun className="h-[1.2rem] w-[1.2rem]" /> : <Moon className="h-[1.2rem] w-[1.2rem]" />}
             <span className="sr-only">Toggle theme</span>
           </Button> */}

        <Button variant="outline" size="sm" onClick={() => handleLogout()}>
          <LogOut className="mr-1.5 h-4 w-4" />
          Logout
        </Button>
      </div>
    </header>
  );
}
