
'use client'; // Need client-side hook for active link styling

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Users, ListChecks, BarChart3, Settings } from 'lucide-react'; // Adjusted icons (using ListChecks for Loans, BarChart3 for Summary)
import { cn } from '@/lib/utils';

interface SidebarProps {
    isMobile?: boolean;
    onNavigate?: () => void; // Optional callback when a link is clicked (for closing mobile sheet)
}

// Define navigation items with stricter typing
interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType; // Use React.ElementType for component icons
  matchSegments?: number; // Optional: How many path segments to match for active state
  exact?: boolean; // Optional: Require exact path match
}


const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: Home, exact: true }, // Match only /dashboard exactly
  { href: '/dashboard/customers', label: 'Customers', icon: Users, matchSegments: 2 }, // Match /dashboard/customers/*
  { href: '/dashboard/loans', label: 'Loans', icon: ListChecks, matchSegments: 2 }, // Match /dashboard/loans/*
  { href: '/dashboard/summary', label: 'Summary', icon: BarChart3, matchSegments: 2 }, // Match /dashboard/summary/*
  // { href: '/dashboard/settings', label: 'Settings', icon: Settings, matchSegments: 2 }, // Future placeholder
];

export default function Sidebar({ isMobile = false, onNavigate }: SidebarProps) {
  const pathname = usePathname();

  // Function to determine if a link is active
   const isActive = (item: NavItem): boolean => {
        if (item.exact) {
            return pathname === item.href;
        }
        // Use startsWith for broader matching within sections (e.g., /dashboard/loans/[id])
        return pathname.startsWith(item.href);

        // If more specific segment matching is needed:
        // if (item.matchSegments && item.matchSegments > 0) {
        //      const pathSegments = pathname.split('/').filter(Boolean);
        //      const hrefSegments = item.href.split('/').filter(Boolean);
        //      if (pathSegments.length < item.matchSegments) return false;
        //      return hrefSegments.every((segment, index) => segment === pathSegments[index]);
        // }
        // return pathname.startsWith(item.href);
    };

    // Handle link click, calling onNavigate if provided
    const handleLinkClick = () => {
        if (onNavigate) {
            onNavigate();
        }
    };


  return (
    <aside className={cn(
        "h-screen bg-card border-r flex flex-col print:hidden", // Hide sidebar when printing
        isMobile ? "w-full" : "hidden md:flex md:w-60 lg:w-64 flex-shrink-0" // Adjusted width slightly
    )}>
      {/* Sidebar Header */}
      <div className="flex h-16 items-center border-b px-4 lg:px-6 flex-shrink-0">
        {/* App Logo/Name Link */}
        <Link href="/dashboard" className="flex items-center gap-2 font-bold text-lg text-primary" onClick={handleLinkClick}>
          {/* Replace with a proper logo if available */}
          <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10.73 6.124A4.5 4.5 0 007.07 3.81a4.502 4.502 0 00-3.297 6.905 1 1 0 001.537-.841A2.501 2.501 0 017.07 7.81a2.5 2.5 0 011.768 4.268 1 1 0 10.84 1.536 4.502 4.502 0 001.052-7.49zm3.146 1.708a1 1 0 10-1.043 1.71 2.5 2.5 0 01-1.768 4.269 2.502 2.502 0 01-1.768-4.269 1 1 0 10-.84-1.535 4.502 4.502 0 00-1.05 7.49 4.5 4.5 0 006.912-3.301 1 1 0 00-.443-1.369z"/>
          </svg>
          <span className="tracking-tight">CrediKhaata</span>
        </Link>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto p-4 space-y-2">
        {navItems.map((item) => {
           const active = isActive(item);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={handleLinkClick} // Close sheet on navigation
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2.5 text-base font-medium transition-all duration-150 ease-in-out group", // Increased text size slightly
                active
                  ? "bg-primary/10 text-primary shadow-sm" // Active link style with subtle shadow
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground" // Inactive link style
              )}
              aria-current={active ? 'page' : undefined} // Accessibility: indicate current page
            >
              <item.icon className={cn(
                  "h-5 w-5 flex-shrink-0 transition-transform group-hover:scale-110", // Added hover scale effect
                  active ? "text-primary" : "text-muted-foreground group-hover:text-foreground" // Icon color matches text
                  )} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

        {/* Optional Footer section in Sidebar */}
        <div className="mt-auto p-4 border-t">
           <p className="text-xs text-muted-foreground">&copy; {new Date().getFullYear()} CrediKhaata</p>
       </div>
    </aside>
  );
}

    