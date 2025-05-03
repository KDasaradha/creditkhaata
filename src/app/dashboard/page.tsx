
'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle, CircleDollarSign, PiggyBank, Clock, Users, ListChecks, PlusCircle, FileText, TrendingUp, TrendingDown } from 'lucide-react'; // Added trend icons
import { getAuthHeaders } from '@/lib/auth';

// Use NEXT_PUBLIC_ prefix for client-side environment variables
const API_URL = process.env.NEXT_PUBLIC_API_URL; // Corrected variable name

// Interface for the summary data expected from the API
interface ShopkeeperSummary {
  totalLoaned: number;
  totalCollected: number;
  totalOutstanding: number;
  totalOverdueAmount: number;
  overdueLoanCount: number;
  averageRepaymentTimeDays: number | null;
  totalCustomers: number;
  activeLoanCount: number;
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<ShopkeeperSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch summary data function
  const fetchSummary = useCallback(async () => {
     if (!API_URL) {
         setError("API URL is not configured.");
         setLoading(false);
         return;
     }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/summary`, {
        headers: getAuthHeaders(), // Include auth token
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({message: 'Failed to parse error response'}));
        throw new Error(errorData.message || `Failed to fetch summary (${response.status})`);
      }
      const data: ShopkeeperSummary = await response.json();
      setSummary(data);
    } catch (err: any) {
      console.error("Fetch Summary Error:", err);
      setError(err.message || 'An unknown error occurred while fetching the summary.');
    } finally {
      setLoading(false);
    }
  }, []); // Empty dependency array, relies only on API_URL

  // Fetch summary on component mount
  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]); // fetchSummary is stable

  // Helper to format currency
  const formatCurrency = (amount: number | null | undefined): string => {
    if (amount === null || amount === undefined) return '₹--';
    return `₹${Number(amount).toFixed(2)}`;
  };

  return (
    <div className="container mx-auto py-6 px-4 md:px-6 space-y-6">
      {/* Dashboard Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back! Here's a quick overview of your business.</p>
        </div>
         {/* Quick Action Buttons */}
        <div className="flex gap-2 flex-wrap">
           {/* Link to add customer page with #add hash */}
           <Link href="/dashboard/customers#add" passHref>
             <Button size="sm">
                 <Users className="mr-2 h-4 w-4" /> Add Customer
             </Button>
           </Link>
           {/* Link to add loan page with #add hash */}
           <Link href="/dashboard/loans#add" passHref>
             <Button variant="secondary" size="sm">
                 <PlusCircle className="mr-2 h-4 w-4" /> Add Loan
             </Button>
           </Link>
        </div>
      </div>

      {/* Error Alert */}
       {error && !loading && (
           <Alert variant="destructive">
               <AlertTriangle className="h-4 w-4" />
               <AlertTitle>Error Fetching Summary</AlertTitle>
               <AlertDescription>
                   {error}
                   <Button variant="link" onClick={fetchSummary} className="p-0 h-auto ml-2">Retry</Button>
               </AlertDescription>
           </Alert>
       )}

      {/* Summary Cards Section */}
      {/* Add a subtle border or background to the main summary card */}
      <Card className="border border-border shadow-sm rounded-lg">
        <CardHeader className="border-b">
          <CardTitle>Quick Summary</CardTitle>
          <CardDescription>Key metrics at a glance.</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
            {/* Loading State */}
            {loading && (
                 <div className="flex justify-center items-center py-10 text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    <span className="ml-3 text-lg">Loading summary...</span>
                </div>
            )}
            {/* Summary Data Grid */}
            {summary && !loading && !error && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {/* Outstanding Balance Card */}
                 <Card className="hover:shadow-md transition-shadow border">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Outstanding Balance</CardTitle>
                         <ListChecks className="h-4 w-4 text-orange-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-orange-600">{formatCurrency(summary.totalOutstanding)}</div>
                        <p className="text-xs text-muted-foreground">{summary.activeLoanCount ?? '--'} active loan(s)</p>
                    </CardContent>
                </Card>

                 {/* Overdue Amount Card */}
                 <Card className="hover:shadow-md transition-shadow border border-destructive/50">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Overdue Amount</CardTitle>
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-destructive">{formatCurrency(summary.totalOverdueAmount)}</div>
                        <p className="text-xs text-muted-foreground">{summary.overdueLoanCount ?? '--'} overdue loan(s)</p>
                    </CardContent>
                </Card>

                 {/* Total Collected Card */}
                 <Card className="hover:shadow-md transition-shadow border">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Collected</CardTitle>
                        <PiggyBank className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">{formatCurrency(summary.totalCollected)}</div>
                        <p className="text-xs text-muted-foreground">Total amount repaid</p>
                    </CardContent>
                </Card>

                 {/* Total Customers Card */}
                 <Card className="hover:shadow-md transition-shadow border">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{summary.totalCustomers ?? '--'}</div>
                         <p className="text-xs text-muted-foreground">Registered customers</p>
                    </CardContent>
                 </Card>

            </div>
            )}
             {/* Message if summary is empty and not loading */}
             {!summary && !loading && !error && (
                <div className="text-center py-10 text-muted-foreground">
                    No summary data available yet. Start by adding customers and loans.
                </div>
             )}
        </CardContent>
      </Card>

        {/* Quick Navigation Links */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {/* Manage Customers Card Link */}
           <Card className="hover:bg-muted/50 transition-colors border">
             <Link href="/dashboard/customers" className="block h-full">
               <CardHeader>
                   <CardTitle className="flex items-center gap-2 text-base"><Users className="h-5 w-5 text-primary"/> Manage Customers</CardTitle>
               </CardHeader>
               <CardContent>
                   <CardDescription className="text-sm">View, add, or edit your customer profiles.</CardDescription>
                   {/* <Button variant="link" size="sm" className="mt-2 p-0 h-auto">Go to Customers <ArrowRight className="ml-1 h-4 w-4"/></Button> */}
               </CardContent>
             </Link>
           </Card>
            {/* Manage Loans Card Link */}
           <Card className="hover:bg-muted/50 transition-colors border">
              <Link href="/dashboard/loans" className="block h-full">
               <CardHeader>
                   <CardTitle className="flex items-center gap-2 text-base"><ListChecks className="h-5 w-5 text-primary"/> Manage Loans</CardTitle>
               </CardHeader>
               <CardContent>
                   <CardDescription className="text-sm">Track all active and past credit sales and repayments.</CardDescription>
                    {/* <Button variant="link" size="sm" className="mt-2 p-0 h-auto">Go to Loans <ArrowRight className="ml-1 h-4 w-4"/></Button> */}
               </CardContent>
              </Link>
           </Card>
            {/* View Summary Card Link */}
            <Card className="hover:bg-muted/50 transition-colors border">
              <Link href="/dashboard/summary" className="block h-full">
               <CardHeader>
                   <CardTitle className="flex items-center gap-2 text-base"><FileText className="h-5 w-5 text-primary"/> View Full Summary</CardTitle>
               </CardHeader>
               <CardContent>
                   <CardDescription className="text-sm">See detailed statistics and performance metrics.</CardDescription>
                   {/* <Button variant="link" size="sm" className="mt-2 p-0 h-auto">Go to Summary <ArrowRight className="ml-1 h-4 w-4"/></Button> */}
               </CardContent>
               </Link>
           </Card>
        </div>

         {/* Potential Area for Overdue Loan Snippet or other insights */}
         {/* Consider fetching a small list of top overdue loans here */}
         {/* <Card> <CardHeader> <CardTitle>Overdue Loans Alert</CardTitle> </CardHeader> <CardContent> ... List of few overdue loans ... </CardContent> </Card> */}

    </div>
  );
}
