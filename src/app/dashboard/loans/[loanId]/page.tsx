
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
import { ArrowLeft, Loader2, AlertTriangle, CalendarIcon, Banknote, Info, CheckCircle2, Clock, Users, Phone, HomeIcon } from 'lucide-react';
import { getAuthHeaders } from '@/lib/auth';
import { format, parseISO, differenceInDays, isBefore, isValid, startOfDay } from 'date-fns'; // Import necessary date-fns functions
import Link from 'next/link';
import { cn } from '@/lib/utils';

// Use NEXT_PUBLIC_ prefix for client-side environment variables
const API_URL = process.env.NEXT_PUBLIC_API_URL; // Corrected variable name

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
      // Optional UX: Pre-fill repayment amount if balance > 0 and not too large?
       if (data && data.balance > 0 && data.balance <= 5000) { // Example threshold
          // setRepaymentForm(prev => ({ ...prev, amount: data.balance }));
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
     // Ensure repayment amount doesn't exceed current balance
      if (amountNum > loan.balance) {
         setFormError(`Repayment amount (₹${amountNum.toFixed(2)}) cannot exceed the current balance (₹${loan.balance.toFixed(2)}).`);
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
     // Ensure repayment date is not in the future
      if (isBefore(startOfDay(new Date()), startOfDay(repaymentForm.date)) && differenceInDays(repaymentForm.date, new Date()) > 0) {
         // Allow same day, but not future days
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
            case 'pending': return 'default'; // Or choose another variant like 'outline'
            default: return 'outline';
        }
    };
     const getStatusBadgeText = (status: LoanStatus): string => {
        return status.charAt(0).toUpperCase() + status.slice(1); // Capitalize
    }
     const getStatusIcon = (status: LoanStatus) => {
         switch (status) {
            case 'paid': return <CheckCircle2 className="h-5 w-5 text-green-600" />;
            case 'overdue': return <AlertTriangle className="h-5 w-5 text-destructive" />;
            case 'pending': return <Clock className="h-5 w-5 text-primary" />; // Or text-orange-500 / text-yellow-500
            default: return null;
        }
     };

    // Calculate days overdue based on due date and grace period
    const calculateDaysOverdue = (dueDateStr: string, graceDays: number): number => {
        const dueDate = parseISO(dueDateStr);
        if (!isValid(dueDate)) return 0; // Handle invalid date

        const today = startOfDay(new Date()); // Compare against start of today
        const effectiveDueDate = new Date(dueDate);
        // Add grace days correctly
        effectiveDueDate.setDate(dueDate.getDate() + graceDays);
        const effectiveDueDayStart = startOfDay(effectiveDueDate);

        // If today is after the effective due date
        if (isBefore(effectiveDueDayStart, today)) {
            return differenceInDays(today, effectiveDueDayStart);
        }
        return 0; // Not overdue yet
    };

  // --- Render Logic ---

  // Loading State
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-200px)] text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        <span>Loading loan details...</span>
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
             <Card className="p-6 shadow-md rounded-lg border">
                <AlertTriangle className="mx-auto h-10 w-10 text-muted-foreground mb-4"/>
                <p className="text-muted-foreground">Loan details could not be loaded or the loan does not exist.</p>
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
    <div className="container mx-auto py-6 px-4 md:px-6 space-y-6">
       {/* Back Button */}
       <Button variant="outline" size="sm" onClick={() => router.back()} className="mb-4 print:hidden">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Loans List
       </Button>

       {/* Loan Header & Status Card */}
        <Card className="shadow-md rounded-lg border border-border">
            {/* Card Header */}
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4">
                {/* Loan Title and Customer Info */}
                <div>
                    <CardTitle className="text-xl lg:text-2xl mb-1">{loan.description}</CardTitle>
                    <div className="text-sm text-muted-foreground space-y-1 mt-2">
                        <p className="flex items-center gap-2">
                            <Users className="h-4 w-4 flex-shrink-0"/> Customer: <strong className="text-foreground">{loan.customer.name}</strong>
                             {/* Link to customer details page if needed */}
                            {/* <Link href={`/dashboard/customers/${loan.customer._id}`} className="ml-2 text-primary hover:underline text-xs">(View)</Link> */}
                        </p>
                        <p className="flex items-center gap-2"><Phone className="h-4 w-4 flex-shrink-0"/> Phone: {loan.customer.phone}</p>
                        {loan.customer.address && <p className="flex items-center gap-2"><HomeIcon className="h-4 w-4 flex-shrink-0"/> Address: {loan.customer.address}</p>}
                    </div>
                </div>
                {/* Loan Status Badge and Overdue Info */}
                <div className="flex flex-col items-start sm:items-end gap-2">
                     <Badge variant={getStatusBadgeVariant(loan.status)} className="text-sm px-3 py-1 h-auto">
                        {getStatusIcon(loan.status)}
                        <span className="ml-2">{getStatusBadgeText(loan.status)}</span>
                     </Badge>
                     {loan.status === 'overdue' && daysOverdue > 0 && (
                         <p className="text-xs text-destructive font-medium">({daysOverdue} day{daysOverdue !== 1 ? 's' : ''} overdue)</p>
                     )}
                      {loan.status === 'paid' && (
                         <p className="text-xs text-green-600 font-medium">(Fully Repaid)</p>
                     )}
                </div>
            </CardHeader>

            {/* Separator */}
            <Separator />

            {/* Loan Financial Summary Grid */}
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-6 pb-4">
                 <div className="flex flex-col items-center p-3 rounded-md bg-muted/50 border">
                    <p className="text-sm font-medium text-muted-foreground mb-1">Original Amount</p>
                    <p className="text-lg font-semibold">₹{loan.amount.toFixed(2)}</p>
                </div>
                <div className="flex flex-col items-center p-3 rounded-md bg-muted/50 border">
                    <p className="text-sm font-medium text-muted-foreground mb-1">Total Repaid</p>
                    <p className="text-lg font-semibold text-green-600">₹{totalRepaid.toFixed(2)}</p>
                </div>
                <div className="flex flex-col items-center p-3 rounded-md bg-muted/50 border">
                    <p className="text-sm font-medium text-muted-foreground mb-1">Current Balance</p>
                    <p className={cn("text-lg font-bold", loan.balance > 0 ? 'text-orange-600' : 'text-green-600')}>
                        ₹{loan.balance.toFixed(2)}
                    </p>
                </div>
                 <div className="flex flex-col items-center p-3 rounded-md bg-muted/50 border">
                    <p className="text-sm font-medium text-muted-foreground mb-1">Interest Rate</p>
                    {/* Display interest rate with context */}
                    <p className="text-lg font-semibold">{loan.interestRate}% {loan.interestRate > 0 ? <span className="text-xs">(Annual)</span> : ''}</p>
                </div>
            </CardContent>

            {/* Separator */}
            <Separator />

            {/* Loan Dates & Terms Grid */}
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 pb-6">
                <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Issue Date</p>
                    {/* Format dates safely */}
                    <p className="text-sm">{isValid(issueDateParsed) ? format(issueDateParsed, 'PPP') : 'Invalid Date'}</p>
                </div>
                <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Due Date</p>
                    <p className="text-sm">{isValid(dueDateParsed) ? format(dueDateParsed, 'PPP') : 'Invalid Date'}</p>
                </div>
                 <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Frequency</p>
                    <p className="text-sm capitalize">{loan.frequency.replace('-', ' ')}</p>
                </div>
                <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Grace Period</p>
                    <p className="text-sm">{loan.graceDays > 0 ? `${loan.graceDays} day${loan.graceDays !== 1 ? 's' : ''}` : 'None'}</p>
                </div>
            </CardContent>
        </Card>


        {/* Record Repayment Card (Only show if balance > 0) */}
        {loan.balance > 0 && (
            <Card className="shadow-md rounded-lg border border-border print:hidden">
                <CardHeader>
                    <CardTitle className="text-lg">Record Repayment</CardTitle>
                    <CardDescription>Log a payment received for this loan.</CardDescription>
                </CardHeader>
                <CardContent>
                     {/* Repayment Form */}
                     <form onSubmit={handleRecordRepayment} className="grid md:grid-cols-3 gap-4 items-end">
                         {/* Amount Input */}
                         <div className="space-y-2">
                             <Label htmlFor="amount">Amount Received (₹) <span className="text-destructive">*</span></Label>
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
                                 placeholder={`Max: ₹${loan.balance.toFixed(2)}`}
                                 className="text-base"
                             />
                         </div>
                        {/* Date Picker */}
                        <div className="space-y-2">
                            <Label htmlFor="date">Repayment Date <span className="text-destructive">*</span></Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant={"outline"}
                                        className={cn("w-full justify-start text-left font-normal", !repaymentForm.date && "text-muted-foreground")}
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
                                                isBefore(startOfDay(new Date()), startOfDay(date)) && differenceInDays(date, new Date()) > 0
                                            }
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                        {/* Submit Button */}
                        <Button type="submit" disabled={isSubmitting || !repaymentForm.amount || !repaymentForm.date} className="w-full md:w-auto">
                             {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Banknote className="mr-2 h-4 w-4" /> }
                             Record Payment
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
      <Card className="shadow-md rounded-lg border border-border">
        <CardHeader>
          <CardTitle className="text-lg">Repayment History</CardTitle>
           <CardDescription>List of payments recorded for this loan.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loan.repayments.length === 0 ? (
            // Empty state for repayments
            <p className="text-muted-foreground text-center py-8 px-6">No repayments recorded yet.</p>
          ) : (
              // Repayments Table
            <div className="overflow-x-auto">
                <Table>
                <TableHeader>
                    <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Amount Paid</TableHead>
                    <TableHead className="hidden md:table-cell text-right">Recorded On</TableHead>
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
                            const recordedDateParsed = parseISO(repayment.createdAt);
                            return (
                                <TableRow key={repayment._id} className="hover:bg-muted/50">
                                    <TableCell>{isValid(repaymentDateParsed) ? format(repaymentDateParsed, 'PPP') : 'Invalid Date'}</TableCell>
                                    <TableCell className="text-right font-medium text-green-600">₹{repayment.amount.toFixed(2)}</TableCell>
                                    <TableCell className="hidden md:table-cell text-right text-muted-foreground text-sm">
                                        {isValid(recordedDateParsed) ? format(recordedDateParsed, 'dd MMM yy, hh:mm a') : 'N/A'}
                                    </TableCell>
                                    {/* Repayment Action Cell (Example) */}
                                    {/* <TableCell className="text-right print:hidden">
                                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive/80 h-8 w-8" title="Delete Repayment (Caution!)">
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
             <CardFooter className="pt-4 border-t justify-end">
                <p className="text-sm text-muted-foreground">
                    Total Repaid: <span className="font-semibold text-green-600">₹{totalRepaid.toFixed(2)}</span>
                </p>
             </CardFooter>
         )}
      </Card>
    </div>
  );
}
