
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; // Import Alert
import { LogIn, AlertTriangle, PartyPopper } from 'lucide-react'; // Icons
import Link from 'next/link';
import { login, isAuthenticated } from '@/lib/auth';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Redirect if already logged in
    if (isAuthenticated()) {
        router.replace('/dashboard'); // Use replace to avoid login page in history
        return;
    }

    const registered = searchParams.get('registered');
    const sessionExpired = searchParams.get('sessionExpired');
    const redirectPath = searchParams.get('redirect') || '/dashboard'; // Default redirect

     if (registered === 'true') {
       setSuccessMessage('Registration successful! Please log in.');
     }
     if (sessionExpired === 'true') {
         setError('Your session has expired. Please log in again.');
     }

     // Store redirect path for use after successful login
     sessionStorage.setItem('loginRedirect', redirectPath);

     // Clear query params from URL for cleaner address bar
     // router.replace('/login', { scroll: false }); // Causes flicker, maybe remove

  }, [router, searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null); // Clear success message on new attempt
    setLoading(true);

    if (!email || !password) {
        setError('Please enter both email and password.');
        setLoading(false);
        return;
    }

    try {
      const success = await login(email, password);
      if (success) {
        const redirectPath = sessionStorage.getItem('loginRedirect') || '/dashboard';
        sessionStorage.removeItem('loginRedirect'); // Clean up storage
        router.push(redirectPath); // Use push to navigate after successful login
        // router.refresh(); // Not always needed, layout effect should handle state change
      } else {
        // login function should ideally throw specific errors handled below
        setError('Invalid email or password.');
      }
    } catch (err: any) {
      console.error('Login failed:', err);
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-background to-secondary/10 p-4">
      <Card className="w-full max-w-md shadow-xl border-t-4 border-primary rounded-lg overflow-hidden">
        <CardHeader className="text-center pt-8 pb-4 bg-card">
          <LogIn className="mx-auto h-10 w-10 text-primary mb-3" />
          <CardTitle className="text-2xl font-bold">CrediKhaata Login</CardTitle>
          <CardDescription>Access your shopkeeper dashboard</CardDescription>
        </CardHeader>
        <CardContent className="px-6 py-6 space-y-4">
             {/* Success Message */}
           {successMessage && (
               <Alert variant="default" className="bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-700/50">
                  <PartyPopper className="h-4 w-4 text-green-600 dark:text-green-400" />
                 <AlertTitle className="text-green-700 dark:text-green-300">Success!</AlertTitle>
                 <AlertDescription className="text-green-600 dark:text-green-400">
                     {successMessage}
                 </AlertDescription>
               </Alert>
           )}

           {/* Error Message */}
           {error && (
             <Alert variant="destructive">
               <AlertTriangle className="h-4 w-4" />
               <AlertTitle>Login Failed</AlertTitle>
               <AlertDescription>{error}</AlertDescription>
             </Alert>
           )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="your.email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                autoComplete="email"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                disabled={loading}
                autoComplete="current-password"
              />
            </div>
            <Button type="submit" className="w-full h-10 text-base font-semibold" disabled={loading}>
              {loading ? 'Logging in...' : 'Login'}
            </Button>
          </form>
        </CardContent>
         <CardFooter className="flex flex-col items-center text-sm bg-muted/50 py-4">
            <p className="text-muted-foreground">{"Don't have an account?"}</p>
             <Link href="/register" className="font-medium text-primary hover:underline hover:text-primary/80 transition-colors">
                Register here
             </Link>
         </CardFooter>
      </Card>
    </div>
  );
}
