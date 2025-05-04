// src/app/dashboard/page.tsx

'use client';

import { useState, useEffect, useCallback } from 'react';
import { format, parseISO } from 'date-fns';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast'; // Import useToast
import { Loader2, AlertTriangle, CircleDollarSign, PiggyBank, Clock, Users, ListChecks, PlusCircle, FileText, TrendingUp, TrendingDown, ArrowRight, BellRing, Send } from 'lucide-react'; // Added Send icon
import { getAuthHeaders } from '@/lib/auth';
import { cn } from '@/lib/utils';

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

// Interface for minimal overdue loan data for the dashboard snippet
interface OverdueLoanSnippet {
    _id: string;
    customer: { // Assuming customer is populated with at least name
        _id: string;
        name: string;
    };
    description: string;
    balance: number;
    dueDate: string; // ISO String
}


export default function DashboardPage() {
  const [summary, setSummary] = useState<ShopkeeperSummary | null>(null);
  const [overdueLoans, setOverdueLoans] = useState<OverdueLoanSnippet[]>([]); // State for overdue loans snippet
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingOverdue, setLoadingOverdue] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSendingReminders, setIsSendingReminders] = useState(false); // State for reminder button
  const { toast } = useToast(); // Initialize useToast

  // Fetch summary data function
  const fetchSummary = useCallback(async () => {
     if (!API_URL) {
         setError("API URL is not configured. Please check environment variables.");
         setLoadingSummary(false);
         return;
     }
    setLoadingSummary(true);
    setError(null); // Clear previous errors
    try {
      const response = await fetch(`${API_URL}/summary`, {
        headers: getAuthHeaders(), // Include auth token
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({message: 'Failed to parse summary error response'}));
        throw new Error(errorData.message || `Failed to fetch summary (${response.status})`);
      }
      const data: ShopkeeperSummary = await response.json();
      setSummary(data);
    } catch (err: any) {
      console.error("Fetch Summary Error:", err);
      // Set error only if it's not already set by overdue fetch
      if(!error) setError(err.message || 'An unknown error occurred while fetching the summary.');
    } finally {
      setLoadingSummary(false);
    }
  }, [error]); // Add error to dependency array to avoid overwriting

  // Fetch overdue loans snippet function
   const fetchOverdueLoansSnippet = useCallback(async () => {
     if (!API_URL) {
         setError("API URL is not configured.");
         setLoadingOverdue(false);
         return;
     }
     setLoadingOverdue(true);
     // setError(null); // Don't clear error here, let summary fetch handle it initially
     try {
       // Fetch only a few overdue loans, sorted by due date (oldest first)
       const response = await fetch(`${API_URL}/loans/overdue?limit=5&sort=dueDate`, { // Example: limit to 5, sort by due date
         headers: getAuthHeaders(),
       });
       if (!response.ok) {
         const errorData = await response.json().catch(() => ({message: 'Failed to parse overdue loans error response'}));
         throw new Error(errorData.message || `Failed to fetch overdue loans snippet (${response.status})`);
       }
       const data: OverdueLoanSnippet[] = await response.json();
       setOverdueLoans(data);
     } catch (err: any) {
       console.error("Fetch Overdue Loans Snippet Error:", err);
       // Set error only if it's not already set by summary fetch
       if(!error) setError(err.message || 'An unknown error occurred while fetching overdue loans.');
     } finally {
       setLoadingOverdue(false);
     }
   }, [error]); // Add error to dependency array


  // Fetch data on component mount
  useEffect(() => {
    fetchSummary();
    fetchOverdueLoansSnippet();
  }, [fetchSummary, fetchOverdueLoansSnippet]); // fetch functions are stable due to useCallback

  // --- Reminder Sending Logic ---
  const handleSendReminders = async (type: 'due' | 'overdue') => {
    if (!API_URL) {
        toast({
            variant: "destructive",
            title: "Configuration Error",
            description: "API URL is not configured.",
        });
        return;
    }
    setIsSendingReminders(true);
    try {
        const response = await fetch(`${API_URL}/reminders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify({ type }), // Send 'due' or 'overdue'
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || `Failed to send ${type} reminders.`);
        }

        toast({
            title: "Reminders Processed",
            description: result.message || `Successfully processed ${type} reminders. Sent: ${result.sentCount}, Failed: ${result.failedCount}, Skipped: ${result.skippedCount}`,
            duration: 5000, // Show toast longer
        });

    } catch (err: any) {
        console.error(`Error sending ${type} reminders:`, err);
        toast({
            variant: "destructive",
            title: `Error Sending ${type.charAt(0).toUpperCase() + type.slice(1)} Reminders`,
            description: err.message || "An unknown error occurred.",
        });
    } finally {
        setIsSendingReminders(false);
    }
};


  // Helper to format currency
  const formatCurrency = (amount: number | null | undefined): string => {
    if (amount === null || amount === undefined) return '₹ --.--'; // More distinct placeholder
    return `₹${Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; // Use localeString for Indian format
  };

  const isLoading = loadingSummary || loadingOverdue;

  return (
    <div className="container mx-auto py-6 px-4 md:px-6 space-y-8">
      {/* Dashboard Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Welcome back! Here's a quick overview of your business.</p>
        </div>
         {/* Quick Action Buttons */}
        <div className="flex gap-2 flex-wrap">
           <Link href="/dashboard/customers#add" passHref>
             <Button> <Users className="mr-2 h-4 w-4" /> Add Customer </Button>
           </Link>
           <Link href="/dashboard/loans#add" passHref>
             <Button variant="secondary"> <PlusCircle className="mr-2 h-4 w-4" /> Add Loan </Button>
           </Link>
        </div>
      </div>

      {/* Error Alert - Shows if either fetch fails */}
       {error && !isLoading && (
           <Alert variant="destructive">
               <AlertTriangle className="h-4 w-4" />
               <AlertTitle>Error Loading Dashboard</AlertTitle>
               <AlertDescription>
                   {error}
                   <Button variant="link" onClick={() => { fetchSummary(); fetchOverdueLoansSnippet(); }} className="p-0 h-auto ml-2">Retry All</Button>
               </AlertDescription>
           </Alert>
       )}

      {/* Summary Cards Section */}
      <Card className="border border-border shadow-sm rounded-lg">
        <CardHeader className="border-b">
          <CardTitle>Financial Snapshot</CardTitle>
          <CardDescription>Key metrics at a glance.</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
            {/* Loading State */}
            {loadingSummary && ( // Show loading only for summary section
                 <div className="flex justify-center items-center py-16 text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    <span className="ml-3 text-lg">Loading summary...</span>
                </div>
            )}
            {/* Summary Data Grid */}
            {summary && !loadingSummary && !error && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                 <MetricCard
                     title="Outstanding Balance"
                     value={formatCurrency(summary.totalOutstanding)}
                     description={`${summary.activeLoanCount ?? '--'} active loan(s)`}
                     icon={ListChecks}
                     iconColor="text-orange-500"
                     valueColor="text-orange-600"
                 />
                 <MetricCard
                     title="Overdue Amount"
                     value={formatCurrency(summary.totalOverdueAmount)}
                     description={`${summary.overdueLoanCount ?? '--'} overdue loan(s)`}
                     icon={AlertTriangle}
                     iconColor="text-destructive"
                     valueColor="text-destructive"
                 />
                 <MetricCard
                     title="Total Collected"
                     value={formatCurrency(summary.totalCollected)}
                     description="Total amount repaid"
                     icon={PiggyBank}
                     iconColor="text-green-600"
                     valueColor="text-green-600"
                 />
                 <MetricCard
                     title="Total Customers"
                     value={String(summary.totalCustomers ?? '--')}
                     description="Registered customers"
                     icon={Users}
                     iconColor="text-muted-foreground"
                 />
            </div>
            )}
             {/* Message if summary is empty and not loading */}
             {!summary && !loadingSummary && !error && (
                <div className="text-center py-16 text-muted-foreground">
                    No summary data available yet. Start by adding customers and loans.
                </div>
             )}
        </CardContent>
      </Card>

        {/* Quick Navigation Links */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
           <QuickLinkCard href="/dashboard/customers" title="Customers" description="View, add, or edit profiles." icon={Users} />
           <QuickLinkCard href="/dashboard/loans" title="Loans" description="Track credit sales & payments." icon={ListChecks} />
           <QuickLinkCard href="/dashboard/summary" title="Full Summary" description="See detailed statistics." icon={FileText} />
        </div>

         {/* Overdue Loan Snippet Card */}
         <Card className="border border-border shadow-sm rounded-lg">
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b pb-4 gap-2">
               <div className="flex-1">
                 <CardTitle className="text-lg flex items-center gap-2"><BellRing className="h-5 w-5 text-destructive"/> Overdue Alerts</CardTitle>
                 <CardDescription>Top loans requiring attention.</CardDescription>
               </div>
               <div className="flex items-center gap-2 flex-wrap">
                   {summary && summary.overdueLoanCount > 0 && (
                       <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleSendReminders('overdue')}
                            disabled={isSendingReminders}
                        >
                            {isSendingReminders ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Send className="mr-2 h-4 w-4" />}
                            Send Overdue Reminders ({summary.overdueLoanCount})
                       </Button>
                   )}
                   {summary && summary.overdueLoanCount > 5 && ( // Show "View All" if more than 5 overdue
                        <Link href="/dashboard/loans?status=overdue" passHref>
                            <Button variant="outline" size="sm">View All Overdue</Button>
                        </Link>
                   )}
                </div>
            </CardHeader>
            <CardContent className="pt-4 px-0">
               {loadingOverdue && (
                 <div className="flex justify-center items-center py-10 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <span className="ml-2">Loading overdue loans...</span>
                </div>
               )}
               {!loadingOverdue && overdueLoans.length > 0 && (
                <ul className="divide-y divide-border">
                  {overdueLoans.map((loan) => (
                      <li key={loan._id} className="px-6 py-3 hover:bg-muted/50 transition-colors">
                         <Link href={`/dashboard/loans/${loan._id}`} className="flex justify-between items-center gap-4">
                            <div className="flex-1 min-w-0">
                               <p className="font-medium truncate">{loan.customer?.name || 'Unknown Customer'}</p>
                               <p className="text-sm text-muted-foreground truncate">{loan.description}</p>
                            </div>
                            <div className="text-right flex-shrink-0">
                               <p className="font-semibold text-destructive">{formatCurrency(loan.balance)}</p>
                               <p className="text-xs text-muted-foreground">Due: {format(parseISO(loan.dueDate), 'dd/MM/yyyy')}</p>
                            </div>
                         </Link>
                      </li>
                  ))}
                </ul>
              )}
              {/* Show message if loading is done and no overdue loans found */}
              {!loadingOverdue && overdueLoans.length === 0 && (
                <p className="text-muted-foreground text-sm text-center py-10 px-6">No overdue loans needing immediate attention. Great job!</p>
              )}
           </CardContent>
         </Card>

       </div>
  );
}


// --- Reusable Helper Components ---

interface MetricCardProps {
    title: string;
    value: string;
    description: string;
    icon: React.ElementType;
    iconColor?: string;
    valueColor?: string;
}

function MetricCard({ title, value, description, icon: Icon, iconColor = "text-primary", valueColor = "text-foreground" }: MetricCardProps) {
    return (
        <div className="p-4 border rounded-lg bg-card shadow-sm hover:shadow-md transition-shadow">
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

interface QuickLinkCardProps {
    href: string;
    title: string;
    description: string;
    icon: React.ElementType;
}

function QuickLinkCard({ href, title, description, icon: Icon }: QuickLinkCardProps) {
    return (
       <Card className="group hover:bg-muted/50 hover:border-primary/50 transition-colors border rounded-lg shadow-sm">
         <Link href={href} className="block h-full p-5">
           <div className="flex items-center justify-between mb-2">
               <CardTitle className="flex items-center gap-2 text-lg"><Icon className="h-5 w-5 text-primary"/> {title}</CardTitle>
               <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
           </div>
           <CardDescription className="text-sm">{description}</CardDescription>
         </Link>
       </Card>
    );
}