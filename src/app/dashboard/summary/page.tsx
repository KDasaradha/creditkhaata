
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button'; // Import Button
import { Loader2, AlertTriangle, CircleDollarSign, PiggyBank, Clock, Users, ListChecks, TrendingUp, TrendingDown, Percent } from 'lucide-react';
import { getAuthHeaders } from '@/lib/auth';
// Import chart components if using (e.g., from shadcn/ui/charts)
// import { BarChart, LineChart ... } from '@/components/ui/charts';

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

export default function SummaryPage() {
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
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Business Summary</h1>
        <p className="text-muted-foreground">A detailed overview of your loan activities and performance.</p>
      </div>

       {/* Main Summary Card Grid */}
      <Card className="shadow-md rounded-lg">
        <CardHeader className="border-b">
          <CardTitle className="text-lg">Key Metrics</CardTitle>
          {/* <CardDescription>Overview of financial and customer data.</CardDescription> */}
        </CardHeader>
        <CardContent className="pt-6">
            {loading && (
                 <div className="flex justify-center items-center py-10 text-muted-foreground">
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    <span>Loading summary...</span>
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
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {/* Total Loaned */}
                <Card className="hover:shadow-lg transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Loaned</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(summary.totalLoaned)}</div>
                        <p className="text-xs text-muted-foreground">Total credit extended</p>
                    </CardContent>
                </Card>

                 {/* Total Collected */}
                 <Card className="hover:shadow-lg transition-shadow">
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
                 <Card className="hover:shadow-lg transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Outstanding Balance</CardTitle>
                         <ListChecks className="h-4 w-4 text-orange-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-orange-600">{formatCurrency(summary.totalOutstanding)}</div>
                        <p className="text-xs text-muted-foreground">Amount yet to be collected</p>
                    </CardContent>
                 </Card>


                {/* Total Overdue Amount */}
                 <Card className="hover:shadow-lg transition-shadow border-l-4 border-destructive">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Overdue Amount</CardTitle>
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-destructive">{formatCurrency(summary.totalOverdueAmount)}</div>
                        <p className="text-xs text-muted-foreground">{summary.overdueLoanCount} overdue loan(s)</p>
                    </CardContent>
                </Card>

                 {/* Active Loans */}
                 <Card className="hover:shadow-lg transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active Loans</CardTitle>
                         <ListChecks className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{summary.activeLoanCount}</div>
                        <p className="text-xs text-muted-foreground">Pending or overdue loans</p>
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

                 {/* Average Repayment Time */}
                 <Card className="hover:shadow-lg transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Avg. Repayment Time</CardTitle>
                        <Clock className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {summary.averageRepaymentTimeDays !== null
                                ? `${summary.averageRepaymentTimeDays} days`
                                : <span className="text-muted-foreground">N/A</span>
                            }
                        </div>
                        <p className="text-xs text-muted-foreground">For fully paid loans</p>
                    </CardContent>
                </Card>

                 {/* Potential Placeholder for Collection Rate */}
                  <Card className="hover:shadow-lg transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Collection Rate</CardTitle>
                        <Percent className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                             {summary.totalLoaned > 0
                                ? `${((summary.totalCollected / summary.totalLoaned) * 100).toFixed(1)}%`
                                : <span className="text-muted-foreground">N/A</span>
                              }
                        </div>
                        <p className="text-xs text-muted-foreground">Collected / Loaned</p>
                    </CardContent>
                </Card>


            </div>
            )}
        </CardContent>
      </Card>

       {/* Placeholder for Charts */}
        <Card className="shadow-md rounded-lg">
         <CardHeader>
             <CardTitle className="text-lg">Visualizations</CardTitle>
             <CardDescription>Charts showing trends over time (coming soon).</CardDescription>
         </CardHeader>
         <CardContent className="flex items-center justify-center min-h-[200px] text-muted-foreground">
             {/* Chart components would go here */}
             <p>Chart area placeholder.</p>
             {/* Example: <BarChart data={chartData} ... /> */}
         </CardContent>
       </Card>
    </div>
  );
}
