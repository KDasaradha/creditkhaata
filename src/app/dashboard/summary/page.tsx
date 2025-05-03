
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle, CircleDollarSign, PiggyBank, Clock, Users, ListChecks, TrendingUp, TrendingDown, Percent, CalendarCheck2 } from 'lucide-react'; // Added more icons
import { getAuthHeaders } from '@/lib/auth';
// Import chart components if/when needed
// import { BarChart, LineChart ... } from '@/components/ui/charts'; // Assuming shadcn charts or similar

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

export default function SummaryPage() {
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

  // Calculate collection rate if possible
  const calculateCollectionRate = (): string => {
    if (!summary || summary.totalLoaned <= 0) {
        return 'N/A';
    }
    const rate = (summary.totalCollected / summary.totalLoaned) * 100;
    return `${rate.toFixed(1)}%`;
  };

  return (
    <div className="container mx-auto py-6 px-4 md:px-6 space-y-6">
      {/* Page Header */}
      <div className="mb-6 border-b pb-4">
        <h1 className="text-2xl font-bold tracking-tight">Business Summary</h1>
        <p className="text-muted-foreground mt-1">A detailed overview of your loan activities and performance.</p>
      </div>

       {/* Loading State */}
       {loading && (
           <div className="flex justify-center items-center py-20 text-muted-foreground">
              <Loader2 className="mr-3 h-6 w-6 animate-spin text-primary" />
              <span className="text-lg">Loading summary data...</span>
          </div>
       )}

        {/* Error State */}
         {error && !loading && (
            <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Error Fetching Summary</AlertTitle>
                <AlertDescription>
                    {error} <Button variant="link" onClick={fetchSummary} className="p-0 h-auto ml-2">Retry</Button>
                </AlertDescription>
            </Alert>
        )}


       {/* Main Summary Card Grid (only show if data is loaded and no error) */}
        {summary && !loading && !error && (
          <>
            <Card className="shadow-md rounded-lg border border-border">
              <CardHeader className="border-b">
                <CardTitle className="text-lg font-semibold">Key Financial Metrics</CardTitle>
                {/* <CardDescription>Overview of financial and customer data.</CardDescription> */}
              </CardHeader>
              <CardContent className="pt-6">
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {/* Total Loaned */}
                      <Card className="hover:shadow-lg transition-shadow border">
                          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                              <CardTitle className="text-sm font-medium">Total Loaned</CardTitle>
                              <TrendingUp className="h-4 w-4 text-blue-500" />
                          </CardHeader>
                          <CardContent>
                              <div className="text-2xl font-bold">{formatCurrency(summary.totalLoaned)}</div>
                              <p className="text-xs text-muted-foreground">Total credit extended</p>
                          </CardContent>
                      </Card>

                      {/* Total Collected */}
                      <Card className="hover:shadow-lg transition-shadow border">
                          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                              <CardTitle className="text-sm font-medium">Total Collected</CardTitle>
                              <PiggyBank className="h-4 w-4 text-green-600" />
                          </CardHeader>
                          <CardContent>
                              <div className="text-2xl font-bold text-green-600">{formatCurrency(summary.totalCollected)}</div>
                              <p className="text-xs text-muted-foreground">Total repayments received</p>
                          </CardContent>
                      </Card>

                      {/* Total Outstanding */}
                      <Card className="hover:shadow-lg transition-shadow border">
                          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                              <CardTitle className="text-sm font-medium">Outstanding Balance</CardTitle>
                              <ListChecks className="h-4 w-4 text-orange-500" />
                          </CardHeader>
                          <CardContent>
                              <div className="text-2xl font-bold text-orange-600">{formatCurrency(summary.totalOutstanding)}</div>
                              <p className="text-xs text-muted-foreground">Amount yet to be collected</p>
                          </CardContent>
                      </Card>

                      {/* Collection Rate */}
                      <Card className="hover:shadow-lg transition-shadow border">
                          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                              <CardTitle className="text-sm font-medium">Collection Rate</CardTitle>
                              <Percent className="h-4 w-4 text-indigo-500" />
                          </CardHeader>
                          <CardContent>
                              <div className="text-2xl font-bold text-indigo-600">
                                  {calculateCollectionRate()}
                              </div>
                              <p className="text-xs text-muted-foreground">Collected / Loaned</p>
                          </CardContent>
                      </Card>

                  </div>
              </CardContent>
            </Card>

            <Card className="shadow-md rounded-lg border border-border">
               <CardHeader className="border-b">
                  <CardTitle className="text-lg font-semibold">Loan & Customer Status</CardTitle>
               </CardHeader>
               <CardContent className="pt-6">
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                       {/* Total Overdue Amount */}
                       <Card className="hover:shadow-lg transition-shadow border-l-4 border-destructive">
                          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                              <CardTitle className="text-sm font-medium">Overdue Amount</CardTitle>
                              <AlertTriangle className="h-4 w-4 text-destructive" />
                          </CardHeader>
                          <CardContent>
                              <div className="text-2xl font-bold text-destructive">{formatCurrency(summary.totalOverdueAmount)}</div>
                              <p className="text-xs text-muted-foreground">{summary.overdueLoanCount ?? '--'} overdue loan(s)</p>
                          </CardContent>
                      </Card>

                       {/* Active Loans */}
                       <Card className="hover:shadow-lg transition-shadow border">
                          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                              <CardTitle className="text-sm font-medium">Active Loans</CardTitle>
                              <ListChecks className="h-4 w-4 text-primary" />
                          </CardHeader>
                          <CardContent>
                              <div className="text-2xl font-bold">{summary.activeLoanCount ?? '--'}</div>
                              <p className="text-xs text-muted-foreground">Pending or overdue loans</p>
                          </CardContent>
                       </Card>

                        {/* Average Repayment Time */}
                       <Card className="hover:shadow-lg transition-shadow border">
                          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                              <CardTitle className="text-sm font-medium">Avg. Repayment Time</CardTitle>
                              <CalendarCheck2 className="h-4 w-4 text-teal-600" />
                          </CardHeader>
                          <CardContent>
                              <div className="text-2xl font-bold text-teal-700">
                                  {summary.averageRepaymentTimeDays !== null
                                      ? `${summary.averageRepaymentTimeDays} days`
                                      : <span className="text-muted-foreground">N/A</span>
                                  }
                              </div>
                              <p className="text-xs text-muted-foreground">For fully paid loans</p>
                          </CardContent>
                      </Card>

                       {/* Total Customers */}
                       <Card className="hover:shadow-lg transition-shadow border">
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
               </CardContent>
            </Card>

             {/* Placeholder for Charts */}
              <Card className="shadow-md rounded-lg border border-border">
               <CardHeader>
                   <CardTitle className="text-lg font-semibold">Visualizations</CardTitle>
                   <CardDescription>Charts showing trends over time (coming soon).</CardDescription>
               </CardHeader>
               <CardContent className="flex items-center justify-center min-h-[200px] text-muted-foreground bg-muted/20 rounded-b-lg">
                   {/* Chart components would go here */}
                   <p>
                     <p>
                      Bar chart will be here.
                    </p>
                   </p>
                   {/* Example: <BarChart data={chartData} ... /> */}
               </CardContent>
             </Card>
          </>
        )}

         {/* Message if no summary data and not loading */}
         {!summary && !loading && !error && (
            <Card className="shadow-md rounded-lg border border-border p-10 text-center">
                 <Info className="mx-auto h-10 w-10 text-muted-foreground mb-4" />
                 <p className="text-muted-foreground">No summary data available yet.</p>
                 <p className="text-sm text-muted-foreground mt-2">Start by adding customers and recording loans to see your business summary.</p>
            </Card>
         )}
    </div>
  );
}
