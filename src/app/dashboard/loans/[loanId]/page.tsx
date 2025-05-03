
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
import { Separator } from '@/components/ui/separator'; // Import Separator
import { ArrowLeft, Loader2, AlertTriangle, CalendarIcon, Banknote, Info, CheckCircle2, Clock, Users, Phone, HomeIcon } from 'lucide-react';
import { getAuthHeaders } from '@/lib/auth';
import { format, parseISO, differenceInDays, isBefore } from 'date-fns';
import Link from 'next/link'; // Import Link
import { cn } from '@/lib/utils';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface Customer {
  _id: string;
  name: string;
  phone: string;
  address?: string;
}

interface Repayment {
    _id: string;
    amount: number;
    date: string; // ISO string
    createdAt: string;
}

interface Loan {
  _id: string;
  customer: Customer;
  description: string;
  amount: number;
  balance: number;
  issueDate: string;
  dueDate: string;
  frequency: 'bi-weekly' | 'monthly' | 'one-time';
  interestRate: number;
  graceDays: number;
  status: 'pending' | 'paid' | 'overdue';
  repayments: Repayment[];
  createdAt: string;
  updatedAt: string;
}

interface RepaymentFormData {
    amount: string | number;
    date: Date | undefined;
}

export default function LoanDetailPage() {
  const params = useParams();
  const router = useRouter();
  const loanId = params.loanId as string;

  const [loan, setLoan] = useState<Loan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [repaymentForm, setRepaymentForm] = useState<RepaymentFormData>({ amount: '', date: new Date() });
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchLoanDetails = useCallback(async () => {
    if (!loanId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/loans/${loanId}`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        const errorData = await response.json();
         if (response.status === 404) throw new Error('Loan not found.');
        throw new Error(errorData.message || `Failed to fetch loan details (${response.status})`);
      }
      const data: Loan = await response.json();
      setLoan(data);
      // Pre-fill repayment amount if balance is low? Optional UX improvement
       // if (data && data.balance > 0) {
       //    setRepaymentForm(prev => ({ ...prev, amount: data.balance }));
       // }
    } catch (err: any) {
      console.error("Fetch Loan Details Error:", err);
      setError(err.message || 'An unknown error occurred.');
    } finally {
      setLoading(false);
    }
  }, [loanId]);

  useEffect(() => {
    fetchLoanDetails();
  }, [fetchLoanDetails]);

    const handleRepaymentInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setRepaymentForm(prev => ({ ...prev, [name]: value }));
    };

     const handleRepaymentDateChange = (date: Date | undefined) => {
        setRepaymentForm(prev => ({ ...prev, date: date }));
    };

  const handleRecordRepayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loan) return;
    setFormError(null);
    setIsSubmitting(true);

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
      if (amountNum > loan.balance) {
         setFormError(`Repayment amount (₹${amountNum.toFixed(2)}) cannot exceed the current balance (₹${loan.balance.toFixed(2)}).`);
         setIsSubmitting(false);
         return;
     }
       if (isBefore(repaymentForm.date, parseISO(loan.issueDate))) {
            setFormError('Repayment date cannot be before the loan issue date.');
            setIsSubmitting(false);
            return;
       }

    const payload = {
      loanId: loan._id,
      amount: amountNum,
      date: repaymentForm.date.toISOString(),
    };

    try {
      const response = await fetch(`${API_URL}/repayments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to record repayment.');
      }

      setRepaymentForm({ amount: '', date: new Date() });
      await fetchLoanDetails(); // Refetch to update everything

    } catch (err: any) {
      console.error("Record Repayment Error:", err);
      setFormError(err.message || 'An unknown error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

    const getStatusBadgeVariant = (status: Loan['status']): "default" | "secondary" | "destructive" | "outline" => {
        switch (status) {
            case 'paid': return 'secondary';
            case 'overdue': return 'destructive';
            case 'pending': return 'default';
            default: return 'default';
        }
    };
     const getStatusBadgeText = (status: Loan['status']): string => {
        switch (status) {
            case 'paid': return 'Paid';
            case 'overdue': return 'Overdue';
            case 'pending': return 'Pending';
            default: return status;
        }
    }
     const getStatusIcon = (status: Loan['status']) => {
         switch (status) {
            case 'paid': return <CheckCircle2 className="h-5 w-5 text-green-600" />;
            case 'overdue': return <AlertTriangle className="h-5 w-5 text-destructive" />;
            case 'pending': return <Clock className="h-5 w-5 text-primary" />; // Or use text-orange-500
            default: return null;
        }
     };


    const calculateDaysOverdue = (dueDateStr: string, graceDays: number): number => {
        const dueDate = parseISO(dueDateStr);
        const today = new Date();
        const effectiveDueDate = new Date(dueDate);
        effectiveDueDate.setDate(dueDate.getDate() + graceDays);

        if (isBefore(effectiveDueDate, today)) { // Check if effective due date is before today
            return differenceInDays(today, effectiveDueDate);
        }
        return 0;
    };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-200px)] text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        <span>Loading loan details...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-6 px-4 md:px-6 space-y-4">
         <Button variant="outline" size="sm" onClick={() => router.back()}>
             <ArrowLeft className="mr-2 h-4 w-4" /> Back to Loans
         </Button>
         <Alert variant="destructive">
             <AlertTriangle className="h-4 w-4" />
             <AlertTitle>Error Loading Loan</AlertTitle>
             <AlertDescription>{error}</AlertDescription>
         </Alert>
      </div>
    );
  }

  if (!loan) {
     return (
        <div className="container mx-auto py-6 px-4 md:px-6 text-center space-y-4">
             <Button variant="outline" size="sm" onClick={() => router.back()}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Loans
             </Button>
             <Card className="p-6">
                <p className="text-muted-foreground">Loan details could not be loaded or the loan does not exist.</p>
             </Card>
        </div>
     );
  }

    const daysOverdue = loan.status === 'overdue' ? calculateDaysOverdue(loan.dueDate, loan.graceDays) : 0;
    const totalRepaid = loan.amount - loan.balance;

  return (
    <div className="container mx-auto py-6 px-4 md:px-6 space-y-6">
       <Button variant="outline" size="sm" onClick={() => router.back()} className="mb-4 print:hidden">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Loans List
       </Button>

       {/* Loan Header & Status */}
        <Card className="shadow-md rounded-lg">
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4">
                <div>
                    <CardTitle className="text-xl lg:text-2xl mb-1">Loan: {loan.description}</CardTitle>
                    {/* Link to customer page could be added here */}
                    <div className="text-sm text-muted-foreground space-y-1">
                        <p className="flex items-center gap-2"><Users className="h-4 w-4"/> Customer: <strong className="text-foreground">{loan.customer.name}</strong></p>
                        <p className="flex items-center gap-2"><Phone className="h-4 w-4"/> Phone: {loan.customer.phone}</p>
                        {loan.customer.address && <p className="flex items-center gap-2"><HomeIcon className="h-4 w-4"/> Address: {loan.customer.address}</p>}
                    </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                     <Badge variant={getStatusBadgeVariant(loan.status)} className="text-base px-3 py-1">
                        {getStatusIcon(loan.status)}
                        <span className="ml-2">{getStatusBadgeText(loan.status)}</span>
                     </Badge>
                     {loan.status === 'overdue' && daysOverdue > 0 && (
                         <p className="text-xs text-destructive">({daysOverdue} day{daysOverdue !== 1 ? 's' : ''} overdue)</p>
                     )}
                      {loan.status === 'paid' && (
                         <p className="text-xs text-green-600">(Fully Repaid)</p>
                     )}
                </div>
            </CardHeader>

            {/* Separator */}
            <Separator />

            {/* Loan Financial Summary */}
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-6 pb-4">
                 <div className="flex flex-col items-center p-3 rounded-md bg-secondary/30">
                    <p className="text-sm font-medium text-muted-foreground mb-1">Original Amount</p>
                    <p className="text-lg font-semibold">₹{loan.amount.toFixed(2)}</p>
                </div>
                <div className="flex flex-col items-center p-3 rounded-md bg-secondary/30">
                    <p className="text-sm font-medium text-muted-foreground mb-1">Total Repaid</p>
                    <p className="text-lg font-semibold text-green-600">₹{totalRepaid.toFixed(2)}</p>
                </div>
                <div className="flex flex-col items-center p-3 rounded-md bg-secondary/30">
                    <p className="text-sm font-medium text-muted-foreground mb-1">Current Balance</p>
                    <p className={cn("text-lg font-bold", loan.balance > 0 ? 'text-orange-600' : 'text-green-600')}>
                        ₹{loan.balance.toFixed(2)}
                    </p>
                </div>
                 <div className="flex flex-col items-center p-3 rounded-md bg-secondary/30">
                    <p className="text-sm font-medium text-muted-foreground mb-1">Interest Rate</p>
                    <p className="text-lg font-semibold">{loan.interestRate}% {loan.interestRate > 0 ? <span className="text-xs">(Annual)</span> : ''}</p>
                </div>
            </CardContent>

            {/* Separator */}
            <Separator />

            {/* Loan Dates & Terms */}
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 pb-6">
                <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Issue Date</p>
                    <p className="text-sm">{format(parseISO(loan.issueDate), 'PPP')}</p>
                </div>
                <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Due Date</p>
                    <p className="text-sm">{format(parseISO(loan.dueDate), 'PPP')}</p>
                </div>
                 <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Frequency</p>
                    <p className="text-sm capitalize">{loan.frequency.replace('-', ' ')}</p>
                </div>
                <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Grace Period</p>
                    <p className="text-sm">{loan.graceDays > 0 ? `${loan.graceDays} days` : 'None'}</p>
                </div>
            </CardContent>
        </Card>


        {/* Record Repayment Card (Only if balance > 0) */}
        {loan.balance > 0 && (
            <Card className="shadow-md rounded-lg print:hidden">
                <CardHeader>
                    <CardTitle className="text-lg">Record Repayment</CardTitle>
                    <CardDescription>Log a payment received for this loan.</CardDescription>
                </CardHeader>
                <CardContent>
                     <form onSubmit={handleRecordRepayment} className="grid md:grid-cols-3 gap-4 items-end">
                         <div className="space-y-2">
                             <Label htmlFor="amount">Amount Received (₹) <span className="text-destructive">*</span></Label>
                             <Input
                                 id="amount"
                                 name="amount"
                                 type="number"
                                 min="0.01"
                                 step="0.01"
                                 max={loan.balance}
                                 value={repaymentForm.amount}
                                 onChange={handleRepaymentInputChange}
                                 required
                                 disabled={isSubmitting}
                                 placeholder={`Max: ${loan.balance.toFixed(2)}`}
                                 className="text-base"
                             />
                         </div>
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
                                         disabled={(date) =>
                                                isBefore(date, parseISO(loan.issueDate)) || isBefore(new Date(new Date().setHours(23, 59, 59, 999)), date) // Disable future dates and dates before issue date
                                            }
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                        <Button type="submit" disabled={isSubmitting || !repaymentForm.amount || !repaymentForm.date} className="w-full md:w-auto">
                             {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Banknote className="mr-2 h-4 w-4" /> }
                             Record Payment
                         </Button>
                     </form>
                      {formError && (
                        <Alert variant="destructive" className="mt-4">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle>Error</AlertTitle>
                            <AlertDescription>{formError}</AlertDescription>
                        </Alert>
                    )}
                </CardContent>
            </Card>
        )}

       {/* Repayment History Card */}
      <Card className="shadow-md rounded-lg">
        <CardHeader>
          <CardTitle className="text-lg">Repayment History</CardTitle>
           <CardDescription>List of payments recorded for this loan.</CardDescription>
        </CardHeader>
        <CardContent className="p-0"> {/* Remove padding for table */}
          {loan.repayments.length === 0 ? (
            <p className="text-muted-foreground text-center py-8 px-6">No repayments recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
                <Table>
                <TableHeader>
                    <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Amount Paid</TableHead>
                    <TableHead className="hidden md:table-cell text-right">Recorded On</TableHead>
                    {/* Add actions column if needed (e.g., delete repayment) */}
                    {/* <TableHead className="text-right">Actions</TableHead> */}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {loan.repayments
                        // Sort handled by backend population
                        .map((repayment) => (
                    <TableRow key={repayment._id} className="hover:bg-muted/50">
                        <TableCell>{format(parseISO(repayment.date), 'PPP')}</TableCell>
                        <TableCell className="text-right font-medium text-green-600">₹{repayment.amount.toFixed(2)}</TableCell>
                        <TableCell className="hidden md:table-cell text-right text-muted-foreground text-sm">
                            {format(parseISO(repayment.createdAt), 'dd MMM yy, hh:mm a')}
                        </TableCell>
                        {/* <TableCell className="text-right print:hidden">
                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive/80" title="Delete Repayment (Caution!)">
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </TableCell> */}
                    </TableRow>
                    ))}
                </TableBody>
                </Table>
            </div>
          )}
        </CardContent>
         {loan.repayments.length > 0 && (
             <CardFooter className="pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                    Total repaid: <span className="font-medium text-foreground">₹{totalRepaid.toFixed(2)}</span>
                </p>
             </CardFooter>
         )}
      </Card>
    </div>
  );
}
