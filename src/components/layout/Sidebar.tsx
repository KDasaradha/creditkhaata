
'use client'; // Need client-side hook for active link styling

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Users, BarChart2, FileText, CreditCard, Settings } from 'lucide-react'; // Adjusted icons
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
  { href: '/dashboard/loans', label: 'Loans', icon: CreditCard, matchSegments: 2 }, // Match /dashboard/loans/*
  { href: '/dashboard/summary', label: 'Summary', icon: BarChart2, matchSegments: 2 }, // Match /dashboard/summary/*
  // { href: '/dashboard/settings', label: 'Settings', icon: Settings, matchSegments: 2 }, // Future placeholder
];

export default function Sidebar({ isMobile = false, onNavigate }: SidebarProps) {
  const pathname = usePathname();

  // Function to determine if a link is active
   const isActive = (item: NavItem): boolean => {
        if (item.exact) {
            return pathname === item.href;
        }
        if (item.matchSegments && item.matchSegments > 0) {
             // Match based on segments: e.g., /dashboard/loans should match /dashboard/loans/[id]
             const pathSegments = pathname.split('/').filter(Boolean); // Remove empty strings
             const hrefSegments = item.href.split('/').filter(Boolean);

              // Ensure we have enough segments in the current path to compare
              if (pathSegments.length < item.matchSegments) {
                  return false;
              }
              // Check if the required number of leading segments match
             return hrefSegments.every((segment, index) => segment === pathSegments[index]);
        }
        // Default fallback: Check if the current path starts with the item's href
        return pathname.startsWith(item.href);
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
        isMobile ? "w-full" : "hidden md:flex md:w-64 flex-shrink-0" // Control visibility based on prop
    )}>
      {/* Sidebar Header */}
      <div className="flex h-16 items-center border-b px-4 lg:px-6 flex-shrink-0">
        {/* App Logo/Name Link */}
        <Link href="/dashboard" className="flex items-center gap-2 font-semibold text-lg text-primary" onClick={handleLinkClick}>
          <FileText className="h-6 w-6" /> {/* Or your logo */}
          <span>CrediKhaata</span>
        </Link>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto p-4 space-y-1">
        {navItems.map((item) => {
           const active = isActive(item);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={handleLinkClick} // Close sheet on navigation
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors duration-150 ease-in-out group", // Added group for potential icon styling on hover
                active
                  ? "bg-primary/10 text-primary" // Active link style
                  : "text-muted-foreground hover:bg-muted hover:text-foreground" // Inactive link style
              )}
              aria-current={active ? 'page' : undefined} // Accessibility: indicate current page
            >
              <item.icon className={cn(
                  "h-5 w-5 flex-shrink-0", // Ensure icons don't shrink
                  active ? "text-primary" : "text-muted-foreground group-hover:text-foreground" // Icon color matches text
                  )} />
              {item.label}
            </Link>
          );
        })}
      </nav>

        {/* Optional Footer section in Sidebar */}
        {/* <div className="mt-auto p-4 border-t">
           <p className="text-xs text-muted-foreground">&copy; {new Date().getFullYear()} Your Company</p>
       </div> */}
    </aside>
  );
}
