
'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle, CircleDollarSign, PiggyBank, Clock, Users, ListChecks, PlusCircle, FileText } from 'lucide-react';
import { getAuthHeaders } from '@/lib/auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

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

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/summary`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        const errorData = await response.json();
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
  }, []);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const formatCurrency = (amount: number): string => {
    return `₹${amount.toFixed(2)}`;
  };

  return (
    <div className="container mx-auto py-6 px-4 md:px-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back! Here's a quick overview of your business.</p>
        </div>
        <div className="flex gap-2">
           <Link href="/dashboard/customers#add">
             <Button>
                 <Users className="mr-2 h-4 w-4" /> Add Customer
             </Button>
           </Link>
           <Link href="/dashboard/loans#add">
             <Button variant="secondary">
                 <PlusCircle className="mr-2 h-4 w-4" /> Add Loan
             </Button>
           </Link>
        </div>
      </div>

      {/* Summary Cards Section */}
      <Card className="border-accent border-l-4">
        <CardHeader>
          <CardTitle>Quick Summary</CardTitle>
          <CardDescription>Key metrics at a glance.</CardDescription>
        </CardHeader>
        <CardContent>
            {loading && (
                 <div className="flex justify-center items-center py-10">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <span className="ml-2">Loading summary...</span>
                </div>
            )}
             {error && (
                <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Error Fetching Summary</AlertTitle>
                    <AlertDescription>
                        {error} <Button variant="link" onClick={fetchSummary} className="p-0 h-auto">Retry</Button>
                    </AlertDescription>
                </Alert>
            )}
            {summary && !loading && !error && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {/* Total Outstanding */}
                 <Card className="hover:shadow-lg transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Outstanding Balance</CardTitle>
                         <ListChecks className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-orange-600">{formatCurrency(summary.totalOutstanding)}</div>
                        <p className="text-xs text-muted-foreground">{summary.activeLoanCount} active loan(s)</p>
                    </CardContent>
                </Card>

                 {/* Total Overdue */}
                 <Card className="hover:shadow-lg transition-shadow border-destructive border-opacity-50">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Overdue Amount</CardTitle>
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-destructive">{formatCurrency(summary.totalOverdueAmount)}</div>
                        <p className="text-xs text-muted-foreground">{summary.overdueLoanCount} overdue loan(s)</p>
                    </CardContent>
                </Card>

                 {/* Total Collected */}
                 <Card className="hover:shadow-lg transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Collected</CardTitle>
                        <PiggyBank className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">{formatCurrency(summary.totalCollected)}</div>
                        <p className="text-xs text-muted-foreground">Total amount repaid</p>
                    </CardContent>
                </Card>

                 {/* Total Customers */}
                 <Card className="hover:shadow-lg transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{summary.totalCustomers}</div>
                         <p className="text-xs text-muted-foreground">Registered customers</p>
                    </CardContent>
                 </Card>

                 {/* Other metrics if needed */}
                 {/* <Card> ... Total Loaned ... </Card> */}
                 {/* <Card> ... Avg Repayment Time ... </Card> */}
            </div>
            )}
        </CardContent>
      </Card>

        {/* Quick Actions / Navigation Links */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
           <Card className="hover:bg-secondary/10 transition-colors">
               <CardHeader>
                   <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5"/> Manage Customers</CardTitle>
               </CardHeader>
               <CardContent>
                   <CardDescription className="mb-3">View, add, or edit your customer profiles.</CardDescription>
                   <Link href="/dashboard/customers">
                       <Button variant="outline" size="sm">Go to Customers</Button>
                   </Link>
               </CardContent>
           </Card>
           <Card className="hover:bg-secondary/10 transition-colors">
               <CardHeader>
                   <CardTitle className="flex items-center gap-2"><ListChecks className="h-5 w-5"/> Manage Loans</CardTitle>
               </CardHeader>
               <CardContent>
                   <CardDescription className="mb-3">Track all active and past credit sales.</CardDescription>
                    <Link href="/dashboard/loans">
                       <Button variant="outline" size="sm">Go to Loans</Button>
                   </Link>
               </CardContent>
           </Card>
            <Card className="hover:bg-secondary/10 transition-colors">
               <CardHeader>
                   <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5"/> View Full Summary</CardTitle>
               </CardHeader>
               <CardContent>
                   <CardDescription className="mb-3">See detailed statistics about your business.</CardDescription>
                   <Link href="/dashboard/summary">
                       <Button variant="outline" size="sm">Go to Summary</Button>
                   </Link>
               </CardContent>
           </Card>
        </div>

         {/* Potential Area for Overdue Loan Snippet */}
         {/* Consider fetching a small list of top overdue loans here */}
         {/* <Card> <CardHeader> <CardTitle>Overdue Loans Alert</CardTitle> </CardHeader> <CardContent> ... List of few overdue loans ... </CardContent> </Card> */}

    </div>
  );
}
