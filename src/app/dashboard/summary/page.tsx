
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle, CircleDollarSign, PiggyBank, Clock, Users, ListChecks, TrendingUp, TrendingDown, Percent, CalendarCheck2, Info, BarChartIcon } from 'lucide-react'; // Assume BarChartIcon is custom or placeholder
import { getAuthHeaders } from '@/lib/auth';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

// Import chart components placeholder
// import { ResponsiveContainer, BarChart, XAxis, YAxis, Tooltip, Legend, Bar } from 'recharts'; // Example using recharts

// Use NEXT_PUBLIC_ prefix for client-side environment variables
const API_URL = process.env.NEXT_PUBLIC_API_URL;

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
     if (amount === null || amount === undefined) return '₹ --.--';
     return `₹${Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
   };

  // Calculate collection rate if possible
  const calculateCollectionRate = (): string => {
    if (!summary || summary.totalLoaned <= 0) {
        return 'N/A';
    }
    const rate = (summary.totalCollected / summary.totalLoaned) * 100;
    return `${rate.toFixed(1)}%`;
  };

  // --- Render Logic ---

   // Loading State
   if (loading) {
     return (
       <div className="container mx-auto py-6 px-4 md:px-6 space-y-8">
          <div className="mb-6 border-b pb-4">
              <h1 className="text-3xl font-bold tracking-tight text-foreground">Business Summary</h1>
              <p className="text-muted-foreground mt-1">A detailed overview of your loan activities and performance.</p>
          </div>
           <div className="flex flex-col justify-center items-center py-20 text-muted-foreground bg-muted/30 rounded-lg border">
              <Loader2 className="mr-3 h-8 w-8 animate-spin text-primary" />
              <span className="text-lg mt-4">Loading summary data...</span>
          </div>
       </div>
     );
   }

    // Error State
    if (error) {
      return (
          <div className="container mx-auto py-6 px-4 md:px-6 space-y-8">
             <div className="mb-6 border-b pb-4">
                 <h1 className="text-3xl font-bold tracking-tight text-foreground">Business Summary</h1>
                 <p className="text-muted-foreground mt-1">A detailed overview of your loan activities and performance.</p>
             </div>
             <Alert variant="destructive">
                 <AlertTriangle className="h-4 w-4" />
                 <AlertTitle>Error Fetching Summary</AlertTitle>
                 <AlertDescription>
                     {error} <Button variant="link" onClick={fetchSummary} className="p-0 h-auto ml-2">Retry</Button>
                 </AlertDescription>
             </Alert>
          </div>
      );
    }

   // No Data State
   if (!summary) {
        return (
           <div className="container mx-auto py-6 px-4 md:px-6 space-y-8">
                 <div className="mb-6 border-b pb-4">
                     <h1 className="text-3xl font-bold tracking-tight text-foreground">Business Summary</h1>
                     <p className="text-muted-foreground mt-1">A detailed overview of your loan activities and performance.</p>
                 </div>
                 <Card className="shadow-md rounded-lg border border-border p-10 text-center">
                      <Info className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
                      <p className="text-xl font-semibold text-foreground">No Summary Data Available</p>
                      <p className="text-muted-foreground mt-2">Start by adding customers and recording loans to see your business summary.</p>
                 </Card>
            </div>
        );
   }


  // --- Main Summary Display ---
  return (
    <div className="container mx-auto py-6 px-4 md:px-6 space-y-8">
      {/* Page Header */}
      <div className="mb-6 border-b pb-4">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Business Summary</h1>
        <p className="text-muted-foreground mt-1">A detailed overview of your loan activities and performance.</p>
      </div>

       {/* Main Summary Card Grid */}
      <div className="space-y-8">
          {/* Key Financial Metrics */}
          <Card className="shadow-md rounded-lg border border-border overflow-hidden">
            <CardHeader className="bg-muted/30 border-b">
              <CardTitle className="text-lg font-semibold">Key Financial Metrics</CardTitle>
              {/* <CardDescription>Overview of your lending and collection.</CardDescription> */}
            </CardHeader>
            <CardContent className="pt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <MetricCard
                    title="Total Loaned"
                    value={formatCurrency(summary.totalLoaned)}
                    description="Total credit extended"
                    icon={TrendingUp}
                    iconColor="text-blue-500"
                />
                 <MetricCard
                     title="Total Collected"
                     value={formatCurrency(summary.totalCollected)}
                     description="Total repayments received"
                     icon={PiggyBank}
                     iconColor="text-green-600"
                     valueColor="text-green-600"
                 />
                <MetricCard
                    title="Outstanding Balance"
                    value={formatCurrency(summary.totalOutstanding)}
                    description="Amount yet to be collected"
                    icon={ListChecks}
                    iconColor="text-orange-500"
                    valueColor="text-orange-600"
                />
                <MetricCard
                    title="Collection Rate"
                    value={calculateCollectionRate()}
                    description="Collected / Loaned"
                    icon={Percent}
                    iconColor="text-indigo-500"
                    valueColor="text-indigo-600"
                />
            </CardContent>
          </Card>

          {/* Loan & Customer Status */}
          <Card className="shadow-md rounded-lg border border-border overflow-hidden">
             <CardHeader className="bg-muted/30 border-b">
                <CardTitle className="text-lg font-semibold">Loan & Customer Status</CardTitle>
                {/* <CardDescription>Current state of your loans and customers.</CardDescription> */}
             </CardHeader>
             <CardContent className="pt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                 <MetricCard
                     title="Overdue Amount"
                     value={formatCurrency(summary.totalOverdueAmount)}
                     description={`${summary.overdueLoanCount ?? '--'} overdue loan(s)`}
                     icon={AlertTriangle}
                     iconColor="text-destructive"
                     valueColor="text-destructive"
                     borderClass="border-l-4 border-destructive"
                 />
                 <MetricCard
                     title="Active Loans"
                     value={String(summary.activeLoanCount ?? '--')}
                     description="Pending or overdue loans"
                     icon={ListChecks}
                     iconColor="text-primary"
                 />
                  <MetricCard
                      title="Avg. Repayment Time"
                      value={summary.averageRepaymentTimeDays !== null ? `${summary.averageRepaymentTimeDays} days` : 'N/A'}
                      description="For fully paid loans"
                      icon={CalendarCheck2}
                      iconColor="text-teal-600"
                      valueColor="text-teal-700"
                  />
                 <MetricCard
                     title="Total Customers"
                     value={String(summary.totalCustomers ?? '--')}
                     description="Registered customers"
                     icon={Users}
                     iconColor="text-muted-foreground"
                 />
             </CardContent>
          </Card>

           {/* Placeholder for Charts */}
            <Card className="shadow-md rounded-lg border border-border">
             <CardHeader className="border-b">
                 <CardTitle className="text-xl font-semibold">Visualizations</CardTitle>
                 <CardDescription>Charts showing trends over time (coming soon).</CardDescription>
             </CardHeader>
             <CardContent className="flex flex-col items-center justify-center min-h-[250px] text-muted-foreground bg-muted/20 rounded-b-lg">
                 <BarChartIcon className="h-16 w-16 text-muted-foreground/40 mb-4"/>
                 <p className="text-lg font-medium">Charts Coming Soon</p>
                 <p className="text-sm mt-1">Visual trends of loans and collections will appear here.</p>
                 {/* Example using Recharts (requires installation and data prep) */}
                 {/* <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={chartData}>
                          <XAxis dataKey="name" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="loaned" fill="#8884d8" />
                          <Bar dataKey="collected" fill="#82ca9d" />
                      </BarChart>
                  </ResponsiveContainer> */}
             </CardContent>
           </Card>
        </div>
    </div>
  );
}


// Helper Component for Metric Cards (improves structure)
interface MetricCardProps {
    title: string;
    value: string;
    description: string;
    icon: React.ElementType;
    iconColor?: string;
    valueColor?: string;
    borderClass?: string;
    className?: string; // Allow passing additional classes
}

function MetricCard({ title, value, description, icon: Icon, iconColor = "text-primary", valueColor = "text-foreground", borderClass, className }: MetricCardProps) {
    return (
         <div className={cn("p-4 border rounded-lg bg-card", borderClass, className)}>
             <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                 <h3 className="text-sm font-medium text-muted-foreground tracking-tight">{title}</h3>
                 <Icon className={cn("h-5 w-5", iconColor)} />
             </div>
             <div>
                 <div className={cn("text-2xl font-bold", valueColor)}>{value}</div>
                 <p className="text-xs text-muted-foreground">{description}</p>
             </div>
         </div>
    );
}

// Placeholder Icon (Replace with actual chart icon if available)
// const BarChartIcon = (props: React.SVGProps<SVGSVGElement>) => (
//   <svg
//     xmlns="http://www.w3.org/2000/svg"
//     viewBox="0 0 24 24"
//     fill="none"
//     stroke="currentColor"
//     strokeWidth="2"
//     strokeLinecap="round"
//     strokeLinejoin="round"
//     {...props}
//   >
//     <line x1="12" y1="20" x2="12" y2="10" />
//     <line x1="18" y1="20" x2="18" y2="4" />
//     <line x1="6" y1="20" x2="6" y2="16" />
//   </svg>
// );
