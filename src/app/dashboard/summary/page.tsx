
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle, PiggyBank, ListChecks, Users, Percent, CalendarCheck2, Info, BarChart3, TrendingUp } from 'lucide-react'; // Added PieChart icon
import { getAuthHeaders } from '@/lib/auth';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import {
  ResponsiveContainer,
  BarChart,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Bar,
  PieChart as RechartsPieChart, // Alias PieChart to avoid naming conflict
  Pie,
  Cell,
  TooltipProps, // Import TooltipProps for custom tooltip
} from 'recharts';
import { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent'; // Import types for custom tooltip


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

// Interface for Loan data needed for charts
interface LoanForChart {
    _id: string;
    status: 'pending' | 'paid' | 'overdue';
    amount: number;
    balance: number;
    issueDate: string; // ISO String
    dueDate: string; // ISO String
    category?: string;
}

// Interface for data structure used by charts
interface ChartDataPoint {
    name: string; // e.g., status name, month name
    value: number; // e.g., count, amount
}

export default function SummaryPage() {
  const [summary, setSummary] = useState<ShopkeeperSummary | null>(null);
  const [loanData, setLoanData] = useState<LoanForChart[]>([]); // State for loan data for charts
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- Data Fetching ---
  const fetchData = useCallback(async () => {
    if (!API_URL) {
        setError("API URL is not configured.");
        setLoading(false);
        return;
    }
    setLoading(true);
    setError(null);
    try {
        // Use Promise.all to fetch summary and loans concurrently
        const [summaryResponse, loansResponse] = await Promise.all([
            fetch(`${API_URL}/summary`, { headers: getAuthHeaders() }),
            fetch(`${API_URL}/loans`, { headers: getAuthHeaders() }) // Fetch all loans for chart data
        ]);

        // Process Summary Response
        if (!summaryResponse.ok) {
            const errorData = await summaryResponse.json().catch(() => ({ message: 'Failed to parse summary error' }));
            throw new Error(`Summary: ${errorData.message || `HTTP ${summaryResponse.status}`}`);
        }
        const summaryData: ShopkeeperSummary = await summaryResponse.json();
        setSummary(summaryData);

        // Process Loans Response
        if (!loansResponse.ok) {
             const errorData = await loansResponse.json().catch(() => ({ message: 'Failed to parse loans error' }));
             throw new Error(`Loans: ${errorData.message || `HTTP ${loansResponse.status}`}`);
        }
        const loansData: LoanForChart[] = await loansResponse.json();
        setLoanData(loansData);

    } catch (err: any) {
      console.error("Fetch Summary/Loans Error:", err);
      setError(err.message || 'An unknown error occurred while fetching data.');
    } finally {
      setLoading(false);
    }
  }, []); // Empty dependency array

  useEffect(() => {
    fetchData();
  }, [fetchData]); // fetchData is stable


  // --- Chart Data Preparation ---
  const getLoanStatusChartData = (): ChartDataPoint[] => {
    if (!loanData || loanData.length === 0) return [];
    const statusCounts = loanData.reduce((acc, loan) => {
        acc[loan.status] = (acc[loan.status] || 0) + 1;
        return acc;
    }, {} as Record<LoanForChart['status'], number>);

    return [
        { name: 'Pending', value: statusCounts.pending || 0 },
        { name: 'Paid', value: statusCounts.paid || 0 },
        { name: 'Overdue', value: statusCounts.overdue || 0 },
    ].filter(item => item.value > 0); // Only include statuses with loans
  };

   // Example: Prepare data for monthly loans/repayments (requires more complex backend or frontend aggregation)
   // const getMonthlyTrendData = () => {
   //     // This would typically involve grouping loans/repayments by month
   //     // For simplicity, using dummy data here. Replace with actual logic.
   //     return [
   //         { name: 'Jan', loaned: 4000, collected: 2400 },
   //         { name: 'Feb', loaned: 3000, collected: 1398 },
   //         // ... more months
   //     ];
   // };

  const loanStatusChartData = getLoanStatusChartData();
  // const monthlyTrendData = getMonthlyTrendData();


  // --- Helper Functions ---
   const formatCurrency = (amount: number | null | undefined): string => {
     if (amount === null || amount === undefined) return '₹ --.--';
     return `₹${Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`; // Simplified for charts
   };

  const calculateCollectionRate = (): string => {
    if (!summary || summary.totalLoaned <= 0) return 'N/A';
    const rate = (summary.totalCollected / summary.totalLoaned) * 100;
    return `${rate.toFixed(1)}%`;
  };

   // Colors for the Pie Chart slices
   const PIE_COLORS = {
       Pending: '#3b82f6', // blue-500
       Paid: '#16a34a', // green-600
       Overdue: '#dc2626', // red-600
   };

   // Custom Tooltip for Pie Chart
   const CustomPieTooltip = ({ active, payload }: TooltipProps<ValueType, NameType>) => {
      if (active && payload && payload.length) {
        const data = payload[0].payload; // Access the data of the hovered slice
        return (
          <div className="rounded-md border bg-popover p-2 text-popover-foreground shadow-sm text-sm">
            <p className="font-semibold">{`${data.name}: ${data.value}`}</p>
          </div>
        );
      }
      return null;
    };


  // --- Render Logic ---
   if (loading) {
     return ( // Consistent Loading State
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

    if (error) {
      return ( // Consistent Error State
          <div className="container mx-auto py-6 px-4 md:px-6 space-y-8">
             <div className="mb-6 border-b pb-4">
                 <h1 className="text-3xl font-bold tracking-tight text-foreground">Business Summary</h1>
                 <p className="text-muted-foreground mt-1">A detailed overview of your loan activities and performance.</p>
             </div>
             <Alert variant="destructive">
                 <AlertTriangle className="h-4 w-4" />
                 <AlertTitle>Error Fetching Data</AlertTitle>
                 <AlertDescription>
                     {error} <Button variant="link" onClick={fetchData} className="p-0 h-auto ml-2">Retry</Button>
                 </AlertDescription>
             </Alert>
          </div>
      );
    }

   if (!summary && loanData.length === 0) {
        return ( // Consistent No Data State
           <div className="container mx-auto py-6 px-4 md:px-6 space-y-8">
                 <div className="mb-6 border-b pb-4">
                     <h1 className="text-3xl font-bold tracking-tight text-foreground">Business Summary</h1>
                     <p className="text-muted-foreground mt-1">A detailed overview of your loan activities and performance.</p>
                 </div>
                 <Card className="shadow-md rounded-lg border border-border p-10 text-center">
                      <Info className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
                      <p className="text-xl font-semibold text-foreground">No Data Available</p>
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
          {summary && ( // Only render if summary data exists
              <Card className="shadow-md rounded-lg border border-border overflow-hidden">
                <CardHeader className="bg-muted/30 border-b">
                  <CardTitle className="text-lg font-semibold">Key Financial Metrics</CardTitle>
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
          )}


          {/* Loan & Customer Status */}
          {summary && ( // Only render if summary data exists
              <Card className="shadow-md rounded-lg border border-border overflow-hidden">
                 <CardHeader className="bg-muted/30 border-b">
                    <CardTitle className="text-lg font-semibold">Loan & Customer Status</CardTitle>
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
          )}

           {/* Visualizations Section */}
           <Card className="shadow-md rounded-lg border border-border">
             <CardHeader className="border-b">
                 <CardTitle className="text-xl font-semibold">Visualizations</CardTitle>
                 <CardDescription>Overview of loan statuses.</CardDescription>
             </CardHeader>
             <CardContent className="pt-6">
                {loanData.length === 0 ? (
                     <div className="flex flex-col items-center justify-center min-h-[250px] text-muted-foreground bg-muted/20 rounded-b-lg">
                         <BarChart3 className="h-16 w-16 text-muted-foreground/40 mb-4"/>
                         <p className="text-lg font-medium">No Loan Data for Charts</p>
                         <p className="text-sm mt-1">Add loans to see visualizations.</p>
                    </div>
                ) : (
                 <div className="grid md:grid-cols-1 gap-8"> {/* Adjust grid layout as needed */}

                     {/* Loan Status Pie Chart */}
                     <div className="min-h-[300px]"> {/* Ensure chart has height */}
                         <h3 className="text-md font-semibold mb-4 text-center">Loan Status Distribution</h3>
                         <ResponsiveContainer width="100%" height={300}>
                             <RechartsPieChart>
                                 <Pie
                                     data={loanStatusChartData}
                                     cx="50%"
                                     cy="50%"
                                     labelLine={false}
                                     outerRadius={110}
                                     fill="#8884d8"
                                     dataKey="value"
                                     nameKey="name"
                                     label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                                 >
                                     {loanStatusChartData.map((entry, index) => (
                                         <Cell key={`cell-${index}`} fill={PIE_COLORS[entry.name as keyof typeof PIE_COLORS] || '#cccccc'} />
                                     ))}
                                 </Pie>
                                  <Tooltip content={<CustomPieTooltip />} />
                                 <Legend />
                             </RechartsPieChart>
                         </ResponsiveContainer>
                     </div>

                      {/* Placeholder for Monthly Trend Chart */}
                      {/* <div className="min-h-[300px]">
                         <h3 className="text-md font-semibold mb-4 text-center">Monthly Loan Trends (Example)</h3>
                          <ResponsiveContainer width="100%" height={300}>
                              <BarChart data={monthlyTrendData}>
                                  <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                                  <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `₹${value/1000}k`} />
                                  <Tooltip formatter={(value: number) => formatCurrency(value)} cursor={{ fill: 'hsl(var(--muted))' }}/>
                                  <Legend />
                                  <Bar dataKey="loaned" fill="#3b82f6" name="Loaned" radius={[4, 4, 0, 0]} />
                                  <Bar dataKey="collected" fill="#16a34a" name="Collected" radius={[4, 4, 0, 0]} />
                              </BarChart>
                          </ResponsiveContainer>
                      </div> */}

                 </div>
                )}
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
         <div className={cn("p-4 border rounded-lg bg-card shadow-sm", borderClass, className)}>
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
