
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"; // Added Avatar
import { Menu, LogOut, User, Sun, Moon } from 'lucide-react'; // Changed UserCircle to User
import Sidebar from './Sidebar';
// Import specific functions needed client-side
import { getDecodedTokenClientSide, isTokenExpiredClientSide, getTokenClientSide, logout } from '@/lib/auth';
import { useRouter } from 'next/navigation';
// Uncomment if using next-themes
// import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';

interface DecodedToken {
  id: string; // From JWT payload
  email: string; // From JWT payload
}

// Helper function to get initials from email
const getInitials = (email: string | null): string => {
  if (!email) return '?';
  const parts = email.split('@')[0];
  if (parts.length === 0) return '?';
  return parts[0].toUpperCase(); // Just the first letter
};

export default function Header() {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false); // Control mobile sheet visibility
  const router = useRouter();
  // Uncomment if using next-themes
  // const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false); // State to track component mount for theme toggle

  useEffect(() => {
     setMounted(true); // Component has mounted

     // Check token validity (from localStorage) and extract user email
     if (typeof window !== 'undefined') {
         if (!getTokenClientSide() || isTokenExpiredClientSide()) {
             // Let DashboardLayout handle initial redirect if needed
             setUserEmail(null); // Ensure email is cleared
         } else {
             try {
                // Use the client-side decoder
                const decoded = getDecodedTokenClientSide();
                if (decoded && decoded.email) {
                  setUserEmail(decoded.email);
                } else {
                    console.warn("Header Effect: Token decoded but email missing.");
                    setUserEmail(null);
                }
             } catch (error) {
                 console.error("Header Effect: Failed to decode token:", error);
                 setUserEmail(null);
             }
         }
     }
  }, []); // Run only once on mount

   /**
    * Handles the logout process by calling the logout utility function.
    * @param sessionExpired - Indicates if logout is forced due to session expiry.
    */
   const handleLogout = (sessionExpired = false) => {
    console.log(`Header: Calling logout utility (sessionExpired: ${sessionExpired})`);
    // Pass the router instance to the logout function for redirection
    logout(router, sessionExpired);
  };


  // Prevent theme toggle flicker on mount (if theme toggle is used)
  // if (!mounted) {
  //   return <header className="flex h-16 items-center border-b bg-card px-4 md:px-6 sticky top-0 z-30 flex-shrink-0"></header>; // Render placeholder to avoid layout shift
  // }

  const userInitials = getInitials(userEmail);

  return (
    <header className={cn(
        "flex h-16 items-center justify-between border-b bg-card px-4 md:px-6 sticky top-0 z-30 flex-shrink-0 print:hidden",
        // Add a subtle shadow to the header
        "shadow-sm"
     )}>
      {/* Mobile Menu Button & App Name */}
      <div className="flex items-center gap-4 md:hidden">
        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" aria-label="Toggle navigation menu">
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-full max-w-xs p-0" >
             <Sidebar isMobile={true} onNavigate={() => setIsSheetOpen(false)} />
          </SheetContent>
        </Sheet>
        {/* Show App Name on Mobile next to menu */}
         <span className="font-bold text-lg text-primary">CrediKhaata</span>
      </div>

      {/* Desktop: Placeholder or Breadcrumbs */}
       <div className="hidden md:flex items-center gap-4">
           {/* Placeholder for potential breadcrumbs or page title */}
           {/* <div className="h-6 w-36 bg-muted rounded animate-pulse"></div> */}
       </div>


      {/* Right Side: User Info and Actions */}
      <div className="flex items-center gap-4">
         {/* Display User Avatar/Email */}
         <div className="flex items-center gap-2 text-sm">
            <Avatar className="h-8 w-8">
                {/* Add AvatarImage if you have user profile pics */}
                {/* <AvatarImage src="user-avatar.jpg" alt={userEmail || 'User'} /> */}
                <AvatarFallback className="bg-primary/20 text-primary font-semibold">
                    {userInitials}
                </AvatarFallback>
            </Avatar>
             {userEmail && (
                 <span className="hidden lg:inline max-w-[180px] truncate text-muted-foreground font-medium">{userEmail}</span>
             )}
         </div>

          {/* Optional: Theme Toggle Example */}
          {/*
          <Button
             variant="ghost" // Use ghost for less emphasis
             size="icon"
             onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
             aria-label="Toggle theme"
             className="text-muted-foreground hover:text-foreground"
           >
             {theme === 'dark' ?
                <Sun className="h-5 w-5" />
              : <Moon className="h-5 w-5" />
              }
           </Button>
           */}

        {/* Logout Button - Calls handleLogout */}
        <Button variant="outline" size="sm" onClick={() => handleLogout(false)}>
          <LogOut className="mr-1.5 h-4 w-4" />
          Logout
        </Button>
      </div>
    </header>
  );
}
