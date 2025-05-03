
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { UserPlus, AlertTriangle, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { register, isAuthenticated } from '@/lib/auth'; // Use client-side auth functions

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

   useEffect(() => {
    // Redirect if already logged in
    if (isAuthenticated()) {
        console.log('Already authenticated, redirecting from register to dashboard.');
        router.replace('/dashboard');
    }
   }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);


    if (!email) {
        setError('Email is required.');
        setLoading(false);
        return;
    }
    if (password.length < 6) {
       setError('Password must be at least 6 characters long.');
       setLoading(false);
       return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
       setLoading(false);
      return;
    }


    try {
      const success = await register(email, password); // Uses client-side register function
       if (success) {
         console.log('Registration successful, redirecting to login.');
         // Redirect to login with a query parameter indicating success
         router.push('/login?registered=true');
       } else {
         // Specific errors should ideally be thrown by the register function and caught below
         setError('Registration failed. Please try again.');
       }
    } catch (err: any) {
      console.error('Registration failed:', err);
      // Use the error message from the thrown error if available
      setError(err.message || 'Registration failed. An unknown error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
     <Card className="w-full max-w-md shadow-xl border-t-4 border-primary rounded-lg overflow-hidden">
        <CardHeader className="text-center pt-8 pb-4 bg-card">
          <UserPlus className="mx-auto h-10 w-10 text-primary mb-3"/>
          <CardTitle className="text-2xl font-bold">Create Account</CardTitle>
          <CardDescription>Register for your CrediKhaata dashboard</CardDescription>
        </CardHeader>
        <CardContent className="px-6 py-6 space-y-4">
           {error && (
             <Alert variant="destructive">
               <AlertTriangle className="h-4 w-4" />
               <AlertTitle>Registration Failed</AlertTitle>
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
                placeholder="•••••••• (min. 6 characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                disabled={loading}
                autoComplete="new-password"
              />
            </div>
             <div className="space-y-1.5">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input
                id="confirm-password"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                disabled={loading}
                autoComplete="new-password"
              />
            </div>
            <Button type="submit" className="w-full h-10 text-base font-semibold" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {loading ? 'Registering...' : 'Register'}
            </Button>
          </form>
        </CardContent>
         <CardFooter className="flex flex-col items-center text-sm bg-muted/50 py-4">
             <p className="text-muted-foreground">Already have an account?</p>
              <Link href="/login" className="font-medium text-primary hover:underline hover:text-primary/80 transition-colors">
                 Login here
              </Link>
         </CardFooter>
      </Card>
  );
}
