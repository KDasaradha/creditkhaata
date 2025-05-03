
// src/app/(auth)/layout.tsx
import { ReactNode } from 'react';

interface AuthLayoutProps {
  children: ReactNode;
}

// This layout applies to routes within the (auth) group, like /login and /register
export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    // Use a subtle gradient and ensure content is centered vertically and horizontally
    <main className="flex items-center justify-center min-h-screen bg-gradient-to-br from-background via-muted/50 to-background p-4 sm:p-6">
        <div className="w-full max-w-md"> {/* Constrain width for better form presentation */}
            {children}
        </div>
      {/* No Sidebar or Header here */}
    </main>
  );
}

    