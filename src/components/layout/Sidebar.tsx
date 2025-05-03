
'use client'; // Need client-side hook for active link styling

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Users, BarChart2, FileText, CreditCard } from 'lucide-react'; // Adjusted icons
import { cn } from '@/lib/utils';

interface SidebarProps {
    isMobile?: boolean;
}

// Define navigation items with stricter typing
interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType; // Use React.ElementType for component icons
  matchSegments?: number; // Optional: How many path segments to match for active state (e.g., /dashboard/loans/*)
}


const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: Home, matchSegments: 1 },
  { href: '/dashboard/customers', label: 'Customers', icon: Users, matchSegments: 2 },
  { href: '/dashboard/loans', label: 'Loans', icon: CreditCard, matchSegments: 2 },
  { href: '/dashboard/summary', label: 'Summary', icon: BarChart2, matchSegments: 2 },
  // { href: '/dashboard/settings', label: 'Settings', icon: Settings }, // Future
];

export default function Sidebar({ isMobile = false }: SidebarProps) {
  const pathname = usePathname();

  // Function to determine if a link is active based on path segments
   const isActive = (href: string, matchSegments = 0) => {
        if (matchSegments === 0) {
            return pathname === href; // Exact match
        }
        // Match based on segments: /dashboard/loans should match /dashboard/loans/[id]
        const pathSegments = pathname.split('/').filter(Boolean);
        const hrefSegments = href.split('/').filter(Boolean);

        if (pathSegments.length < matchSegments || hrefSegments.length !== matchSegments) {
            return false;
        }

        return hrefSegments.every((segment, index) => segment === pathSegments[index]);
    };


  return (
    <aside className={cn(
        "h-screen bg-card border-r flex flex-col",
        isMobile ? "w-full" : "hidden md:flex md:w-64 flex-shrink-0" // Use flex-shrink-0 on desktop
    )}>
      {/* Header */}
      <div className="flex h-16 items-center border-b px-4 lg:px-6 flex-shrink-0">
        <Link href="/dashboard" className="flex items-center gap-2 font-semibold text-lg">
          <FileText className="h-6 w-6 text-primary" />
          <span>CrediKhaata</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-4 space-y-1">
        {navItems.map((item) => {
           const active = isActive(item.href, item.matchSegments);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-150 ease-in-out",
                active
                  ? "bg-primary/10 text-primary" // Active link style
                  : "text-muted-foreground hover:bg-primary/5 hover:text-primary" // Inactive link style
              )}
            >
              <item.icon className={cn("h-4 w-4", active ? "text-primary" : "")} />
              {item.label}
            </Link>
          );
        })}
      </nav>

        {/* Optional Footer */}
        {/* <div className="mt-auto p-4 border-t">
           <p className="text-xs text-muted-foreground">&copy; {new Date().getFullYear()} CrediKhaata</p>
       </div> */}
    </aside>
  );
}
