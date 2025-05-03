
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Loader2, AlertTriangle, CalendarIcon, Banknote, Info, CheckCircle2, Clock, Users, Phone, HomeIcon, IndianRupee, Percent, Repeat, Printer } from 'lucide-react'; // Added more icons
import { getAuthHeaders } from '@/lib/auth';
import { format, parseISO, differenceInDays, isBefore, isValid, startOfDay } from 'date-fns'; // Import necessary date-fns functions
import Link from 'next/link';
import { cn } from '@/lib/utils';

// Use NEXT_PUBLIC_ prefix for client-side environment variables
const API_URL = process.env.NEXT_PUBLIC_API_URL;

// Interfaces (ensure consistency with backend models)
interface Customer {
  _id: string;
  name: string;
  phone: string;
  address?: string;
}

interface Repayment {
    _id: string;
    amount: number;
    date: string; // ISO string from backend
    createdAt: string; // ISO string from backend
}

interface Loan {
  _id: string;
  customer: Customer; // Assuming backend populates this fully
  description: string;
  amount: number;
  balance: number;
  issueDate: string; // ISO string
  dueDate: string; // ISO string
  frequency: 'bi-weekly' | 'monthly' | 'one-time';
  interestRate: number;
  graceDays: number;
  status: 'pending' | 'paid' | 'overdue';
  repayments: Repayment[]; // Array of repayment objects
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
}

type LoanStatus = Loan['status'];

// Repayment form data state
interface RepaymentFormData {
    amount: string | number; // Allow string during input
    date: Date | undefined;
}

export default function LoanDetailPage() {
  const params = useParams();
  const router = useRouter();
  const loanId = params.loanId as string; // Get loanId from URL params

  const [loan, setLoan] = useState<Loan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [repaymentForm, setRepaymentForm] = useState<RepaymentFormData>({ amount: '', date: new Date() });
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch loan details function
  const fetchLoanDetails = useCallback(async () => {
    if (!loanId || !API_URL) {
        setError(!API_URL ? "API URL not configured." : "Loan ID is missing.");
        setLoading(false);
        return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/loans/${loanId}`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({message: 'Failed to parse error response'}));
         if (response.status === 404) throw new Error('Loan not found.');
        throw new Error(errorData.message || `Failed to fetch loan details (${response.status})`);
      }
      const data: Loan = await response.json();

      // Validate date strings before parsing
      if (!data.issueDate || !isValid(parseISO(data.issueDate))) {
           console.warn("Invalid or missing issueDate from API:", data.issueDate);
           // Handle potentially invalid date - maybe set to current date or show error?
      }
       if (!data.dueDate || !isValid(parseISO(data.dueDate))) {
           console.warn("Invalid or missing dueDate from API:", data.dueDate);
      }

      setLoan(data);
      // Optional UX: Pre-fill repayment amount if balance > 0
       if (data && data.balance > 0) {
          setRepaymentForm(prev => ({ ...prev, amount: '' })); // Clear amount, let user enter
       }
    } catch (err: any) {
      console.error("Fetch Loan Details Error:", err);
      setError(err.message || 'An unknown error occurred.');
    } finally {
      setLoading(false);
    }
  }, [loanId]); // Dependency on loanId

  // Fetch data on component mount or when loanId changes
  useEffect(() => {
    fetchLoanDetails();
  }, [fetchLoanDetails]);

    // Handle input change for repayment amount
    const handleRepaymentInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setRepaymentForm(prev => ({ ...prev, [name]: value }));
    };

     // Handle date selection for repayment date
     const handleRepaymentDateChange = (date: Date | undefined) => {
        setRepaymentForm(prev => ({ ...prev, date: date }));
    };

  // Handle submission of the repayment form
  const handleRecordRepayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loan || !API_URL) return; // Guard clause
    setFormError(null); // Clear previous form errors
    setIsSubmitting(true);

    // --- Repayment Form Validation ---
    const amountNum = parseFloat(String(repaymentForm.amount));

     if (isNaN(amountNum) || amountNum <= 0) {
         setFormError('Repayment amount must be a positive number.');
         setIsSubmitting(false);
         return;
     }
      if (!repaymentForm.date) {
         setFormError('Repayment date is required.');
         setIsSubmitting(false);
         return;
     }
     // Ensure repayment amount doesn't exceed current balance (add small tolerance)
      const tolerance = 0.01; // Allow for minor floating point differences
      if (amountNum > loan.balance + tolerance) {
         setFormError(`Repayment amount (₹${amountNum.toFixed(2)}) cannot exceed the current balance (${formatCurrency(loan.balance)}).`);
         setIsSubmitting(false);
         return;
     }
     // Ensure repayment date is not before the loan issue date
     const issueDate = parseISO(loan.issueDate);
     if (isValid(issueDate) && isBefore(repaymentForm.date, issueDate)) {
            setFormError('Repayment date cannot be before the loan issue date.');
            setIsSubmitting(false);
            return;
     }
     // Ensure repayment date is not in the future (allow today)
      if (isBefore(startOfDay(new Date()), startOfDay(repaymentForm.date))) {
          setFormError('Repayment date cannot be in the future.');
          setIsSubmitting(false);
          return;
      }
     // --- End Validation ---

    // Prepare payload for API
    const payload = {
      loanId: loan._id,
      amount: amountNum,
      date: repaymentForm.date.toISOString(), // Send date as ISO string
    };

    try {
      const response = await fetch(`${API_URL}/repayments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({message: 'Failed to parse error response'}));
        throw new Error(errorData.message || 'Failed to record repayment.');
      }

      setRepaymentForm({ amount: '', date: new Date() }); // Reset form
      await fetchLoanDetails(); // Refetch loan details to update balance, status, and repayment list

    } catch (err: any) {
      console.error("Record Repayment Error:", err);
      setFormError(err.message || 'An unknown error occurred while recording repayment.');
    } finally {
      setIsSubmitting(false); // Re-enable form
    }
  };

    // --- Helper Functions for Display ---
    const getStatusBadgeVariant = (status: LoanStatus): "default" | "secondary" | "destructive" | "outline" => {
        switch (status) {
            case 'paid': return 'secondary';
            case 'overdue': return 'destructive';
            case 'pending': return 'default'; // Using primary theme color
            default: return 'outline';
        }
    };
     const getStatusBadgeText = (status: LoanStatus): string => {
        return status.charAt(0).toUpperCase() + status.slice(1); // Capitalize
    }
     const getStatusIcon = (status: LoanStatus) => {
         switch (status) {
            case 'paid': return <CheckCircle2 className="h-4 w-4 mr-1.5" />;
            case 'overdue': return <AlertTriangle className="h-4 w-4 mr-1.5" />;
            case 'pending': return <Clock className="h-4 w-4 mr-1.5" />;
            default: return null;
        }
     };

    // Calculate days overdue based on due date and grace period
    const calculateDaysOverdue = (dueDateStr: string, graceDays: number): number => {
        const dueDate = parseISO(dueDateStr);
        if (!isValid(dueDate)) return 0; // Handle invalid date

        const today = startOfDay(new Date()); // Compare against start of today
        const effectiveDueDate = addDays(startOfDay(dueDate), graceDays); // Add grace days

        // If today is after the effective due date
        if (isBefore(effectiveDueDate, today)) {
            return differenceInDays(today, effectiveDueDate);
        }
        return 0; // Not overdue yet
    };

    // Format currency
    const formatCurrency = (amount: number | null | undefined): string => {
      if (amount === null || amount === undefined) return '₹ --.--';
      return `₹${Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    const handlePrint = () => {
       window.print();
    }

  // --- Render Logic ---

  // Loading State
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-200px)] text-muted-foreground">
        <Loader2 className="mr-3 h-6 w-6 animate-spin text-primary" />
        <span className="text-lg">Loading loan details...</span>
      </div>
    );
  }

  // Error State
  if (error) {
    return (
      <div className="container mx-auto py-6 px-4 md:px-6 space-y-4">
         <Button variant="outline" size="sm" onClick={() => router.back()} className="print:hidden">
             <ArrowLeft className="mr-2 h-4 w-4" /> Back
         </Button>
         <Alert variant="destructive">
             <AlertTriangle className="h-4 w-4" />
             <AlertTitle>Error Loading Loan</AlertTitle>
             <AlertDescription>
                 {error}
                 {/* Add retry button for fetch errors */}
                  {error.includes('fetch loan details') &&
                     <Button variant="link" onClick={fetchLoanDetails} className="p-0 h-auto ml-2">Retry</Button>}
             </AlertDescription>
         </Alert>
      </div>
    );
  }

  // Loan Not Found State
  if (!loan) {
     return (
        <div className="container mx-auto py-6 px-4 md:px-6 text-center space-y-4">
             <Button variant="outline" size="sm" onClick={() => router.back()} className="print:hidden">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Loans
             </Button>
             <Card className="p-10 shadow-md rounded-lg border">
                <AlertTriangle className="mx-auto h-12 w-12 text-muted-foreground mb-4"/>
                 <p className="text-xl text-foreground font-semibold">Loan Not Found</p>
                <p className="text-muted-foreground mt-2">The requested loan details could not be loaded or the loan does not exist.</p>
             </Card>
        </div>
     );
  }

  // --- Calculated Values for Display ---
    const daysOverdue = loan.status === 'overdue' ? calculateDaysOverdue(loan.dueDate, loan.graceDays) : 0;
    const totalRepaid = loan.amount - loan.balance;
    const issueDateParsed = parseISO(loan.issueDate);
    const dueDateParsed = parseISO(loan.dueDate);


  // --- Main Render ---
  return (
    <div className="container mx-auto py-6 px-4 md:px-6 space-y-8 print:space-y-4">
       {/* Header Section with Back Button and Print */}
       <div className="flex justify-between items-center mb-6 print:hidden">
         <Button variant="outline" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Loans List
         </Button>
         <Button variant="outline" size="sm" onClick={handlePrint}>
             <Printer className="mr-2 h-4 w-4" /> Print / Save PDF
         </Button>
       </div>

        {/* Print Header */}
       <div className="hidden print:block mb-6 border-b pb-4">
           <h1 className="text-xl font-bold">Loan Details - CrediKhaata</h1>
           <p className="text-sm text-muted-foreground">Generated on: {format(new Date(), 'PPP p')}</p>
       </div>

       {/* Loan Header & Status Card */}
        <Card className="shadow-md rounded-lg border border-border print:shadow-none print:border-0">
            {/* Card Header */}
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b print:border-b-0 print:pb-2">
                {/* Loan Title and Customer Info */}
                <div>
                    <CardTitle className="text-xl lg:text-2xl mb-1 font-semibold text-foreground">{loan.description}</CardTitle>
                    <div className="text-sm text-muted-foreground space-y-1 mt-2">
                        <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 flex-shrink-0 text-primary"/>
                            <span className="font-medium">Customer:</span>
                             <Link href={`/dashboard/customers?id=${loan.customer._id}`} className="text-primary hover:underline font-semibold">
                                {loan.customer.name}
                             </Link>
                        </div>
                        <div className="flex items-center gap-2"><Phone className="h-4 w-4 flex-shrink-0 text-primary"/> <span className="font-medium">Phone:</span> {loan.customer.phone}</div>
                        {loan.customer.address && <div className="flex items-center gap-2"><HomeIcon className="h-4 w-4 flex-shrink-0 text-primary"/> <span className="font-medium">Address:</span> {loan.customer.address}</div>}
                    </div>
                </div>
                {/* Loan Status Badge and Overdue Info */}
                <div className="flex flex-col items-start sm:items-end gap-2 mt-2 sm:mt-0">
                     <Badge variant={getStatusBadgeVariant(loan.status)} className="text-base px-4 py-1.5 rounded-full shadow-sm">
                        {getStatusIcon(loan.status)}
                        <span>{getStatusBadgeText(loan.status)}</span>
                     </Badge>
                     {loan.status === 'overdue' && daysOverdue > 0 && (
                         <p className="text-sm text-destructive font-medium mt-1">({daysOverdue} day{daysOverdue !== 1 ? 's' : ''} overdue)</p>
                     )}
                      {loan.status === 'paid' && (
                         <p className="text-sm text-green-600 font-medium mt-1">(Fully Repaid)</p>
                     )}
                </div>
            </CardHeader>

            {/* Loan Financial Summary Grid */}
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-6 print:grid-cols-4">
                 <div className="flex flex-col items-center text-center p-3 rounded-md bg-muted/40 border">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Original Amount</p>
                    <p className="text-xl font-semibold flex items-center"> <IndianRupee className="h-4 w-4 mr-0.5"/> {loan.amount.toLocaleString('en-IN')}</p>
                </div>
                <div className="flex flex-col items-center text-center p-3 rounded-md bg-muted/40 border">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Total Repaid</p>
                    <p className="text-xl font-semibold text-green-600 flex items-center"> <IndianRupee className="h-4 w-4 mr-0.5"/> {totalRepaid.toLocaleString('en-IN')}</p>
                </div>
                <div className="flex flex-col items-center text-center p-3 rounded-md bg-muted/40 border">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Current Balance</p>
                    <p className={cn("text-xl font-bold flex items-center", loan.balance > 0 ? 'text-orange-600' : 'text-green-600')}>
                       <IndianRupee className="h-4 w-4 mr-0.5"/> {loan.balance.toLocaleString('en-IN')}
                    </p>
                </div>
                 <div className="flex flex-col items-center text-center p-3 rounded-md bg-muted/40 border">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Interest Rate</p>
                    <p className="text-xl font-semibold flex items-center">
                        <Percent className="h-4 w-4 mr-0.5"/> {loan.interestRate}% {loan.interestRate > 0 ? <span className="text-xs ml-1">(Annual)</span> : ''}
                     </p>
                </div>
            </CardContent>

            {/* Separator */}
            <Separator className="my-4 print:hidden" />

            {/* Loan Dates & Terms Grid */}
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-0 pb-6 print:grid-cols-4 print:pb-4">
                <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1"><CalendarIcon className="h-3 w-3"/>Issue Date</p>
                    <p className="text-sm font-medium">{isValid(issueDateParsed) ? format(issueDateParsed, 'PPP') : 'Invalid Date'}</p>
                </div>
                <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1"><CalendarIcon className="h-3 w-3 text-destructive"/>Due Date</p>
                    <p className="text-sm font-medium">{isValid(dueDateParsed) ? format(dueDateParsed, 'PPP') : 'Invalid Date'}</p>
                </div>
                 <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1"><Repeat className="h-3 w-3"/>Frequency</p>
                    <p className="text-sm font-medium capitalize">{loan.frequency.replace('-', ' ')}</p>
                </div>
                <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1"><Clock className="h-3 w-3"/>Grace Period</p>
                    <p className="text-sm font-medium">{loan.graceDays > 0 ? `${loan.graceDays} day${loan.graceDays !== 1 ? 's' : ''}` : 'None'}</p>
                </div>
            </CardContent>
        </Card>


        {/* Record Repayment Card (Only show if balance > 0) */}
        {loan.balance > 0 && (
            <Card className="shadow-md rounded-lg border border-border print:hidden">
                <CardHeader>
                    <CardTitle className="text-lg font-semibold">Record Repayment</CardTitle>
                    <CardDescription>Log a payment received for this loan.</CardDescription>
                </CardHeader>
                <CardContent>
                     {/* Repayment Form */}
                     <form onSubmit={handleRecordRepayment} className="grid md:grid-cols-3 gap-4 items-end">
                         {/* Amount Input */}
                         <div className="space-y-2">
                             <Label htmlFor="amount">Amount Received <span className="text-destructive">*</span></Label>
                             <div className="relative">
                                <IndianRupee className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                     id="amount"
                                     name="amount"
                                     type="number"
                                     min="0.01"
                                     step="0.01"
                                     max={loan.balance} // Set max to current balance
                                     value={repaymentForm.amount}
                                     onChange={handleRepaymentInputChange}
                                     required
                                     disabled={isSubmitting}
                                     placeholder={`Max: ${formatCurrency(loan.balance)}`}
                                     className="text-base font-semibold pl-10"
                                 />
                             </div>
                         </div>
                        {/* Date Picker */}
                        <div className="space-y-2">
                            <Label htmlFor="date">Repayment Date <span className="text-destructive">*</span></Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant={"outline"}
                                        className={cn("w-full justify-start text-left font-normal text-base", !repaymentForm.date && "text-muted-foreground")}
                                        disabled={isSubmitting}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {repaymentForm.date ? format(repaymentForm.date, "PPP") : <span>Pick date</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <Calendar
                                        mode="single"
                                        selected={repaymentForm.date}
                                        onSelect={handleRepaymentDateChange}
                                        initialFocus
                                        // Disable dates before issue date and future dates
                                         disabled={(date) =>
                                                (isValid(issueDateParsed) && isBefore(date, issueDateParsed)) ||
                                                isBefore(startOfDay(new Date()), startOfDay(date))
                                            }
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                        {/* Submit Button */}
                        <Button type="submit" disabled={isSubmitting || !repaymentForm.amount || !repaymentForm.date} className="w-full md:w-auto h-10 text-base">
                             {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Banknote className="mr-2 h-4 w-4" /> }
                             {isSubmitting ? 'Recording...' : 'Record Payment'}
                         </Button>
                     </form>
                     {/* Repayment Form Error */}
                      {formError && (
                        <Alert variant="destructive" className="mt-4">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle>Repayment Error</AlertTitle>
                            <AlertDescription>{formError}</AlertDescription>
                        </Alert>
                    )}
                </CardContent>
            </Card>
        )}

       {/* Repayment History Card */}
      <Card className="shadow-md rounded-lg border border-border print:shadow-none print:border">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Repayment History</CardTitle>
           <CardDescription>List of payments recorded for this loan.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loan.repayments.length === 0 ? (
            // Empty state for repayments
            <p className="text-muted-foreground text-center py-10 px-6 bg-muted/30">No repayments recorded yet.</p>
          ) : (
              // Repayments Table
            <div className="overflow-x-auto">
                <Table>
                <TableHeader>
                    <TableRow>
                    <TableHead className="pl-6">Payment Date</TableHead>
                    <TableHead className="text-right pr-6">Amount Paid</TableHead>
                    {/* <TableHead className="hidden md:table-cell text-right">Recorded On</TableHead> */}
                    {/* Add actions column if needed (e.g., delete repayment) */}
                    {/* <TableHead className="text-right print:hidden">Actions</TableHead> */}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {loan.repayments
                        // Sort should be handled by backend population or here if needed
                        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) // Ensure descending sort by repayment date
                        .map((repayment) => {
                            const repaymentDateParsed = parseISO(repayment.date);
                            // const recordedDateParsed = parseISO(repayment.createdAt);
                            return (
                                <TableRow key={repayment._id} className="hover:bg-muted/50">
                                    <TableCell className="pl-6">{isValid(repaymentDateParsed) ? format(repaymentDateParsed, 'PPP') : 'Invalid Date'}</TableCell>
                                    <TableCell className="text-right font-medium text-green-600 pr-6">{formatCurrency(repayment.amount)}</TableCell>
                                    {/* <TableCell className="hidden md:table-cell text-right text-muted-foreground text-sm">
                                        {isValid(recordedDateParsed) ? format(recordedDateParsed, 'dd MMM yy, hh:mm a') : 'N/A'}
                                    </TableCell> */}
                                    {/* Repayment Action Cell (Example - Add confirmation dialog!) */}
                                    {/* <TableCell className="text-right print:hidden">
                                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive/80 hover:bg-destructive/10 h-8 w-8" title="Delete Repayment (Caution!)">
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </TableCell> */}
                                </TableRow>
                            );
                        })}
                </TableBody>
                </Table>
            </div>
          )}
        </CardContent>
         {/* Footer showing total repaid */}
         {loan.repayments.length > 0 && (
             <CardFooter className="pt-4 pb-6 border-t justify-end pr-6 bg-muted/30">
                <p className="text-sm text-muted-foreground">
                    Total Repaid: <span className="font-semibold text-lg text-green-600">{formatCurrency(totalRepaid)}</span>
                </p>
             </CardFooter>
         )}
      </Card>
    </div>
  );
}

    