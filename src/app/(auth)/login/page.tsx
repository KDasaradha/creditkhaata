
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { usePathname } from 'next/navigation'; import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { LogIn, AlertTriangle, PartyPopper, Loader2, Mail, Lock } from 'lucide-react'; // Added icons
import Link from 'next/link';
// Use client-side specific auth functions
import { login, isAuthenticated, getTokenClientSide, isTokenExpiredClientSide } from '@/lib/auth';
import { cn } from '@/lib/utils';


const LoginPage: React.FC = () => {

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  useEffect(() => {
    // Check authentication status using client-side functions
    if (isAuthenticated()) {
        // Determine redirect path from query or default
        const redirectPath = searchParams.get('redirect') || sessionStorage.getItem('loginRedirect') || '/dashboard';
        sessionStorage.removeItem('loginRedirect'); // Clean up storage
        console.log(`Already authenticated, redirecting to: ${redirectPath}`);
        router.replace(redirectPath); // Use replace to avoid login page in history
        return; // Stop further execution
    }

    // Handle messages from query parameters
    const registered = searchParams.get('registered');
    const sessionExpired = searchParams.get('sessionExpired');
    const redirectParam = searchParams.get('redirect'); // Get potential redirect path

     if (registered === 'true') {
       setSuccessMessage('Registration successful! Please log in.');
       // Clean the URL parameter, preserving others
       const newParams = new URLSearchParams(searchParams.toString());
       newParams.delete('registered');
       router.replace(`${pathname}?${newParams.toString()}`, { scroll: false });
     }
     if (sessionExpired === 'true') {
         setError('Your session has expired. Please log in again.');
         // Clean the URL parameter, preserving others
         const newParams = new URLSearchParams(searchParams.toString());
         newParams.delete('sessionExpired');
         router.replace(`${pathname}?${newParams.toString()}`, { scroll: false });
     }

     // Store redirect path from query param for use after successful login
     if (redirectParam) {
         sessionStorage.setItem('loginRedirect', redirectParam);
          // Clean the redirect param from URL if session wasn't expired or just registered
          if (sessionExpired !== 'true' && registered !== 'true') {
              const newParams = new URLSearchParams(searchParams.toString());
              newParams.delete('redirect');
              router.replace(`${pathname}?${newParams.toString()}`, { scroll: false });
          }
     }
  // Disable exhaustive-deps because we only want this logic on initial mount/param change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, searchParams]); // Re-run if router or searchParams change


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Login form submitted');
    setError(null);
    setSuccessMessage(null);
    setLoading(true);

    if (!email || !password) {
        console.log('Validation failed: Email or password missing');
        setError('Please enter both email and password.');
        setLoading(false);
        return;
    }

    try {
      console.log('Calling login function...');
      // Use the client-side login function which handles API call and localStorage
      const success = await login(email, password);
      console.log('Login function returned:', success);

      if (success) {
        // On successful login, check for stored redirect path or default to dashboard
        const redirectPath = sessionStorage.getItem('loginRedirect') || '/dashboard';
        sessionStorage.removeItem('loginRedirect'); // Clean up storage
        console.log(`Login successful (UI), redirecting to: ${redirectPath}`);
        // Use replace for better history management after login
        router.replace(redirectPath);
      } else {
        // login function might throw errors handled below, or return false implicitly
        console.log('Login function returned false, setting error.');
        setError('Invalid email or password.');
      }
    } catch (err: any) {
      console.error('Login failed in handleSubmit catch block:', err);
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      console.log('Login form submission finished.');
      setLoading(false);
    }
  };

  return (
    <Card className="w-full shadow-xl border-t-4 border-primary rounded-lg overflow-hidden animate-in fade-in duration-500">
        <CardHeader className="text-center pt-8 pb-4 bg-card">
        <LogIn className="mx-auto h-12 w-12 text-primary mb-3" />
        <CardTitle className="text-2xl font-bold">CrediKhaata Login</CardTitle>
        <CardDescription>Access your shopkeeper dashboard</CardDescription>
        </CardHeader>
        <CardContent className="px-6 py-6 space-y-6">
            {/* Success Message */}
            {successMessage && (
                <Alert variant="default" className="bg-green-50 border-green-300 dark:bg-green-900/30 dark:border-green-700/50">
                    <PartyPopper className="h-5 w-5 text-green-600 dark:text-green-400" />
                    <AlertTitle className="font-semibold text-green-700 dark:text-green-300">Success!</AlertTitle>
                    <AlertDescription className="text-green-600 dark:text-green-400">
                        {successMessage}
                    </AlertDescription>
                </Alert>
            )}

            {/* Error Message */}
            {error && (
                <Alert variant="destructive">
                <AlertTriangle className="h-5 w-5" />
                <AlertTitle className="font-semibold">Login Failed</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-1.5 relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground peer-focus:text-primary" />
                  {/* Floating Label Implementation */}
                  <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={loading}
                      autoComplete="email"
                      className="pl-10 h-11 text-base peer pt-3 block w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" // Added necessary classes for floating label
                      placeholder=" " // Required for floating label effect
                  />
                   <Label
                      htmlFor="email"
                      className={cn(
                          "absolute left-10 top-1/2 transform -translate-y-1/2 text-base text-muted-foreground transition-all duration-200 ease-in-out",
                          "peer-placeholder-shown:top-1/2 peer-placeholder-shown:text-base",
                          "peer-focus:-top-2.5 peer-focus:left-8 peer-focus:text-xs peer-focus:bg-background peer-focus:px-1",
                          email && "-top-2.5 left-8 text-xs bg-background px-1" // State when input has value
                      )}
                   >
                      Email
                   </Label>
                </div>
                <div className="space-y-1.5 relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground peer-focus:text-primary" />
                     {/* Floating Label Implementation */}
                    <Input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={6}
                        disabled={loading}
                        autoComplete="current-password"
                        className="pl-10 h-11 text-base peer pt-3 block w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" // Added necessary classes for floating label
                        placeholder=" " // Required for floating label effect
                    />
                     <Label
                        htmlFor="password"
                        className={cn(
                          "absolute left-10 top-1/2 transform -translate-y-1/2 text-base text-muted-foreground transition-all duration-200 ease-in-out",
                          "peer-placeholder-shown:top-1/2 peer-placeholder-shown:text-base",
                          "peer-focus:-top-2.5 peer-focus:left-8 peer-focus:text-xs peer-focus:bg-background peer-focus:px-1",
                          password && "-top-2.5 left-8 text-xs bg-background px-1" // State when input has value
                        )}
                     >
                       Password
                     </Label>
                </div>
                <Button type="submit" className="w-full h-11 text-base font-semibold" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-5 w-5 animate-spin" /> }
                  {loading ? 'Logging in...' : 'Login'}
                </Button>
            </form>
        </CardContent>
        <CardFooter className="flex flex-col items-center text-sm bg-muted/50 py-5 border-t">
            <p className="text-muted-foreground">{"Don't have an account?"}</p>
            <Link href="/register" className="font-semibold text-primary hover:underline hover:text-primary/80 transition-colors mt-1">
                Register here
            </Link>
        </CardFooter>
    </Card>
  );
};

export default LoginPage;
