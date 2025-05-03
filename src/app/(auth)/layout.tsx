// src/app/(auth)/layout.tsx
import { ReactNode } from 'react';

interface AuthLayoutProps {
  children: ReactNode;
}

// This layout applies to routes within the (auth) group, like /login and /register
export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    // Basic layout container for auth pages, centers content
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-background to-secondary/10 p-4">
      {children}
      {/* No Sidebar or Header here */}
    </div>
  );
}
