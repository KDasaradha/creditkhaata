
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { PlusCircle, Edit, Trash2, AlertTriangle, Loader2, CalendarIcon, Eye, ListFilter, Search, FilePlus, ListChecks } from 'lucide-react';
import { getAuthHeaders } from '@/lib/auth';
import { format, parseISO, isBefore } from 'date-fns';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils'; // For conditional classes

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface Customer {
  _id: string;
  name: string;
  phone: string;
}

interface Loan {
  _id: string;
  customer: Customer | string;
  description: string;
  amount: number;
  balance: number;
  issueDate: string;
  dueDate: string;
  frequency: 'bi-weekly' | 'monthly' | 'one-time';
  interestRate: number;
  graceDays: number;
  status: 'pending' | 'paid' | 'overdue';
  createdAt: string;
  updatedAt: string;
}

interface LoanFormData {
    customerId: string;
    description: string;
    amount: number | string;
    issueDate: Date | undefined;
    dueDate: Date | undefined;
    frequency: 'bi-weekly' | 'monthly' | 'one-time';
    interestRate: number | string;
    graceDays: number | string;
}

export default function LoansPage() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingLoan, setEditingLoan] = useState<Loan | null>(null);
  const [formData, setFormData] = useState<LoanFormData>({
    customerId: '',
    description: '',
    amount: '',
    issueDate: new Date(),
    dueDate: undefined,
    frequency: 'monthly',
    interestRate: 0,
    graceDays: 0,
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [loanToDelete, setLoanToDelete] = useState<Loan | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();

  const getCustomerName = (customerId: string | Customer): string => {
      if (typeof customerId === 'object' && customerId !== null) {
          return customerId.name;
      }
      const customer = customers.find(c => c._id === customerId);
      return customer ? customer.name : 'Unknown';
  };

  const fetchLoansAndCustomers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
        const customerResponse = await fetch(`${API_URL}/customers`, { headers: getAuthHeaders() });
        if (!customerResponse.ok) throw new Error('Failed to fetch customers for dropdown');
        const customerData: Customer[] = await customerResponse.json();
        setCustomers(customerData);

        const loanResponse = await fetch(`${API_URL}/loans`, { headers: getAuthHeaders() });
        if (!loanResponse.ok) {
            const errorData = await loanResponse.json();
            throw new Error(errorData.message || `Failed to fetch loans (${loanResponse.status})`);
        }
        const loanData: Loan[] = await loanResponse.json();
        const populatedLoans = loanData.map(loan => ({
            ...loan,
            customer: typeof loan.customer === 'string'
                ? customerData.find(c => c._id === loan.customer) || loan.customer
                : loan.customer
        }));
        setLoans(populatedLoans as Loan[]);

    } catch (err: any) {
      console.error("Fetch Loans/Customers Error:", err);
      setError(err.message || 'An unknown error occurred.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
     if (typeof window !== 'undefined' && window.location.hash === '#add') {
       handleOpenForm();
     }
    fetchLoansAndCustomers();
  }, [fetchLoansAndCustomers]);

  const resetForm = () => {
    setEditingLoan(null);
    setFormData({
        customerId: '',
        description: '',
        amount: '',
        issueDate: new Date(),
        dueDate: undefined,
        frequency: 'monthly',
        interestRate: 0,
        graceDays: 0,
    });
    setFormError(null);
    setIsSubmitting(false);
  };

  const handleOpenForm = (loan: Loan | null = null) => {
    resetForm();
    if (loan) {
        setEditingLoan(loan);
        setFormData({
            customerId: typeof loan.customer === 'string' ? loan.customer : loan.customer._id,
            description: loan.description,
            amount: loan.amount,
            issueDate: loan.issueDate ? parseISO(loan.issueDate) : new Date(),
            dueDate: loan.dueDate ? parseISO(loan.dueDate) : undefined,
            frequency: loan.frequency,
            interestRate: loan.interestRate,
            graceDays: loan.graceDays,
        });
    } else {
         setFormData(prev => ({ ...prev, issueDate: new Date(), dueDate: undefined }));
    }
    setIsFormOpen(true);
  };

   const handleCloseForm = () => {
      setIsFormOpen(false);
      setTimeout(resetForm, 300);
   };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: (name === 'amount' || name === 'interestRate' || name === 'graceDays') ? value : value,
        }));
    };

    const handleSelectChange = (name: keyof LoanFormData, value: string) => {
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleDateChange = (name: 'issueDate' | 'dueDate', date: Date | undefined) => {
        setFormData(prev => ({ ...prev, [name]: date }));
    };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    if (!formData.customerId || !formData.description || !formData.amount || !formData.dueDate) {
        setFormError('Customer, Description, Amount, and Due Date are required.');
        setIsSubmitting(false);
        return;
    }
    const amountNum = parseFloat(String(formData.amount));
    if (isNaN(amountNum) || amountNum <= 0) {
        setFormError('Amount must be a positive number.');
        setIsSubmitting(false);
        return;
    }
    const interestRateNum = parseFloat(String(formData.interestRate));
     if (isNaN(interestRateNum) || interestRateNum < 0) {
         setFormError('Interest Rate must be non-negative.');
         setIsSubmitting(false);
         return;
     }
     const graceDaysNum = parseInt(String(formData.graceDays), 10);
      if (isNaN(graceDaysNum) || graceDaysNum < 0) {
          setFormError('Grace Days must be a non-negative integer.');
          setIsSubmitting(false);
          return;
      }
      if (formData.issueDate && formData.dueDate && isBefore(formData.dueDate, formData.issueDate)) {
          setFormError('Due Date cannot be before the Issue Date.');
          setIsSubmitting(false);
          return;
      }

    const url = editingLoan ? `${API_URL}/loans/${editingLoan._id}` : `${API_URL}/loans`;
    const method = editingLoan ? 'PUT' : 'POST';

    const payloadBase = {
        ...formData,
        amount: amountNum,
        interestRate: interestRateNum,
        graceDays: graceDaysNum,
        issueDate: formData.issueDate?.toISOString(),
        dueDate: formData.dueDate?.toISOString(),
    };
    const payload = editingLoan ? {
        // Only send editable fields for PUT
        description: payloadBase.description,
        dueDate: payloadBase.dueDate,
        frequency: payloadBase.frequency,
        interestRate: payloadBase.interestRate,
        graceDays: payloadBase.graceDays,
    } : payloadBase;

    try {
      const response = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to ${editingLoan ? 'update' : 'create'} loan`);
      }

      await fetchLoansAndCustomers();
      handleCloseForm();

    } catch (err: any) {
      console.error("Submit Loan Error:", err);
      setFormError(err.message || 'An unknown error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

   const openDeleteDialog = (loan: Loan) => {
      setLoanToDelete(loan);
      setIsDeleteDialogOpen(true);
   };

   const closeDeleteDialog = () => {
      setIsDeleteDialogOpen(false);
      setLoanToDelete(null);
      setIsDeleting(false);
   };

  const handleDelete = async () => {
      if (!loanToDelete) return;
      setIsDeleting(true);
      setError(null);

      try {
          const response = await fetch(`${API_URL}/loans/${loanToDelete._id}`, {
              method: 'DELETE',
              headers: getAuthHeaders(),
          });

          if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.message || `Failed to delete loan (${response.status})`);
          }

          setLoans(prev => prev.filter(l => l._id !== loanToDelete._id));
          closeDeleteDialog();

      } catch (err: any) {
          console.error("Delete Loan Error:", err);
          setError(`Delete failed: ${err.message}`);
          closeDeleteDialog();
      }
  };


    const getStatusBadgeVariant = (status: Loan['status']): "default" | "secondary" | "destructive" | "outline" => {
        switch (status) {
            case 'paid': return 'secondary'; // Use secondary (greyish) for paid
            case 'overdue': return 'destructive'; // Red for overdue
            case 'pending': return 'default'; // Primary color (blue/green) for pending
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

    const navigateToLoanDetail = (loanId: string) => {
        router.push(`/dashboard/loans/${loanId}`);
    };

  return (
    <div className="container mx-auto py-6 px-4 md:px-6 space-y-6">
       {/* Main Error Alert */}
        {error && (
            <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>
                    {error}
                     {error.includes('fetch') && <Button variant="link" size="sm" onClick={fetchLoansAndCustomers} className="p-0 h-auto ml-2">Retry</Button>}
                </AlertDescription>
            </Alert>
        )}

      <Card className="shadow-md rounded-lg overflow-hidden">
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 sm:p-6 bg-card border-b">
           <div>
                <CardTitle className="text-xl font-semibold flex items-center gap-2"><ListChecks className="h-5 w-5 text-primary"/> Loan Management</CardTitle>
                <CardDescription className="text-muted-foreground mt-1">Track credit sales, balances, and payment statuses.</CardDescription>
           </div>
           <div className="flex gap-2 items-center">
                {/* TODO: Add Filtering/Search */}
                {/* <Input placeholder="Search loans..." className="max-w-xs hidden md:block" />
                <Button variant="outline" size="icon">
                    <ListFilter className="h-4 w-4" />
                    <span className="sr-only">Filter</span>
                </Button> */}
                <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                    <DialogTrigger asChild>
                        <Button onClick={() => handleOpenForm()}>
                            <FilePlus className="mr-2 h-4 w-4" /> Add Loan
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[520px]" onInteractOutside={(e) => {if(isSubmitting) e.preventDefault()}}>
                        <DialogHeader>
                            <DialogTitle>{editingLoan ? 'Edit Loan Details' : 'Add New Loan'}</DialogTitle>
                            {editingLoan && <p className="text-sm text-muted-foreground">Note: Customer, Amount, and Issue Date cannot be changed after creation.</p>}
                        </DialogHeader>
                        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                                {/* Customer Selection */}
                                <div className="space-y-2">
                                    <Label htmlFor="customerId">Customer <span className="text-destructive">*</span></Label>
                                    <Select
                                        value={formData.customerId}
                                        onValueChange={(value) => handleSelectChange('customerId', value)}
                                        required
                                        disabled={isSubmitting || !!editingLoan || customers.length === 0}
                                        >
                                        <SelectTrigger>
                                            <SelectValue placeholder={customers.length === 0 ? "No customers available" : "Select a customer"} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {customers.length === 0 && <p className='p-4 text-sm text-muted-foreground'>Please add customers first.</p>}
                                            {customers.map((customer) => (
                                                <SelectItem key={customer._id} value={customer._id}>
                                                    {customer.name} ({customer.phone})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Description */}
                               <div className="space-y-2">
                                   <Label htmlFor="description">Description <span className="text-destructive">*</span></Label>
                                   <Textarea id="description" name="description" value={formData.description} onChange={handleInputChange} required disabled={isSubmitting} placeholder="e.g., Groceries, Repair service"/>
                               </div>

                               <div className="grid grid-cols-2 gap-4">
                                    {/* Amount (Disabled if editing) */}
                                   <div className="space-y-2">
                                       <Label htmlFor="amount">Amount (₹) <span className="text-destructive">*</span></Label>
                                       <Input id="amount" name="amount" type="number" min="0.01" step="0.01" value={formData.amount} onChange={handleInputChange} required disabled={isSubmitting || !!editingLoan} placeholder="e.g., 500"/>
                                   </div>
                                    {/* Frequency */}
                                    <div className="space-y-2">
                                        <Label htmlFor="frequency">Frequency</Label>
                                        <Select value={formData.frequency} onValueChange={(value: LoanFormData['frequency']) => handleSelectChange('frequency', value)} required disabled={isSubmitting}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select frequency" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="one-time">One-time</SelectItem>
                                                <SelectItem value="bi-weekly">Bi-Weekly</SelectItem>
                                                <SelectItem value="monthly">Monthly</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                               </div>

                                <div className="grid grid-cols-2 gap-4">
                                    {/* Issue Date (Disabled if editing) */}
                                    <div className="space-y-2">
                                        <Label htmlFor="issueDate">Issue Date</Label>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant={"outline"}
                                                    className={cn("w-full justify-start text-left font-normal", !formData.issueDate && "text-muted-foreground")}
                                                    disabled={isSubmitting || !!editingLoan}
                                                >
                                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                                    {formData.issueDate ? format(formData.issueDate, "PPP") : <span>Pick issue date</span>}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0">
                                                <Calendar
                                                    mode="single"
                                                    selected={formData.issueDate}
                                                    onSelect={(date) => handleDateChange('issueDate', date)}
                                                    initialFocus
                                                    disabled={isSubmitting || !!editingLoan}
                                                />
                                            </PopoverContent>
                                        </Popover>
                                    </div>

                                    {/* Due Date */}
                                    <div className="space-y-2">
                                        <Label htmlFor="dueDate">Due Date <span className="text-destructive">*</span></Label>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant={"outline"}
                                                     className={cn("w-full justify-start text-left font-normal", !formData.dueDate && "text-muted-foreground")}
                                                    disabled={isSubmitting}
                                                >
                                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                                    {formData.dueDate ? format(formData.dueDate, "PPP") : <span>Pick due date</span>}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0">
                                                <Calendar
                                                    mode="single"
                                                    selected={formData.dueDate}
                                                    onSelect={(date) => handleDateChange('dueDate', date)}
                                                    initialFocus
                                                     disabled={(date) =>
                                                        (formData.issueDate && isBefore(date, formData.issueDate)) || isSubmitting
                                                     }
                                                />
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                </div>

                               <div className="grid grid-cols-2 gap-4">
                                    {/* Interest Rate */}
                                   <div className="space-y-2">
                                       <Label htmlFor="interestRate">Interest Rate (%)</Label>
                                       <Input id="interestRate" name="interestRate" type="number" min="0" step="0.1" value={formData.interestRate} onChange={handleInputChange} disabled={isSubmitting} placeholder="Optional: e.g., 5"/>
                                   </div>
                                    {/* Grace Days */}
                                   <div className="space-y-2">
                                       <Label htmlFor="graceDays">Grace Days</Label>
                                       <Input id="graceDays" name="graceDays" type="number" min="0" step="1" value={formData.graceDays} onChange={handleInputChange} disabled={isSubmitting} placeholder="Optional: e.g., 3"/>
                                   </div>
                               </div>

                              {formError && (
                                  <Alert variant="destructive">
                                      <AlertTriangle className="h-4 w-4" />
                                      <AlertTitle>Error</AlertTitle>
                                      <AlertDescription>{formError}</AlertDescription>
                                  </Alert>
                              )}

                            <DialogFooter className="pt-4">
                                <DialogClose asChild>
                                    <Button type="button" variant="outline" onClick={handleCloseForm} disabled={isSubmitting}>Cancel</Button>
                                </DialogClose>
                                <Button type="submit" disabled={isSubmitting || (customers.length === 0 && !editingLoan)}>
                                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    {editingLoan ? 'Save Changes' : 'Create Loan'}
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>
        </CardHeader>
        <CardContent className="p-0">
           {loading ? (
               <div className="flex justify-center items-center py-16 text-muted-foreground">
                   <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                   <span>Loading loans...</span>
               </div>
           ) : loans.length === 0 ? (
               <div className="text-center py-16 px-6">
                    <ListChecks className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
                    <p className="text-muted-foreground font-medium mb-2">No loans recorded yet.</p>
                    <p className="text-muted-foreground text-sm mb-4">Click "Add Loan" to record a new credit sale.</p>
                    <Button onClick={() => handleOpenForm()}>
                        <FilePlus className="mr-2 h-4 w-4" /> Add First Loan
                    </Button>
               </div>
           ) : (
            <div className="overflow-x-auto">
                <Table>
                <TableHeader>
                    <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead className="hidden md:table-cell">Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead className="hidden lg:table-cell text-center">Issued</TableHead>
                    <TableHead className="text-center">Due</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-right sticky right-0 bg-card z-10">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {loans.map((loan) => (
                    <TableRow key={loan._id} className="hover:bg-muted/50">
                        <TableCell className="font-medium">{getCustomerName(loan.customer)}</TableCell>
                        <TableCell className="hidden md:table-cell max-w-[200px] truncate text-muted-foreground">{loan.description}</TableCell>
                        <TableCell className="text-right">₹{loan.amount.toFixed(2)}</TableCell>
                        <TableCell className={cn("text-right font-semibold", loan.balance > 0 ? 'text-orange-600' : 'text-green-600')}>₹{loan.balance.toFixed(2)}</TableCell>
                        <TableCell className="hidden lg:table-cell text-center text-sm text-muted-foreground">{format(parseISO(loan.issueDate), 'dd MMM yy')}</TableCell>
                        <TableCell className="text-center text-sm">{format(parseISO(loan.dueDate), 'dd MMM yy')}</TableCell>
                        <TableCell className="text-center">
                            <Badge variant={getStatusBadgeVariant(loan.status)} className="text-xs">{getStatusBadgeText(loan.status)}</Badge>
                        </TableCell>
                        <TableCell className="text-right space-x-1 sticky right-0 bg-card z-10">
                            <Button variant="ghost" size="icon" onClick={() => navigateToLoanDetail(loan._id)} title="View Details" className="hover:text-primary">
                                <Eye className="h-4 w-4" />
                                <span className="sr-only">View Details</span>
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleOpenForm(loan)} title="Edit" className="hover:text-primary">
                                <Edit className="h-4 w-4" />
                                <span className="sr-only">Edit</span>
                            </Button>
                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive/80" onClick={() => openDeleteDialog(loan)} title="Delete">
                                <Trash2 className="h-4 w-4" />
                                <span className="sr-only">Delete</span>
                            </Button>
                        </TableCell>
                    </TableRow>
                    ))}
                </TableBody>
                </Table>
            </div>
            )}
        </CardContent>
        {/* Optional: Add pagination if list is long */}
        {/* <CardFooter className="p-4 border-t">...</CardFooter> */}
      </Card>

      {/* Delete Confirmation Dialog */}
       <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
         <DialogContent>
             <DialogHeader>
                 <DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-destructive"/> Confirm Deletion</DialogTitle>
                 <Alert variant="destructive" className="mt-4 border-0 bg-transparent p-0">
                     <AlertDescription>
                         This will permanently delete the loan: <strong>"{loanToDelete?.description}"</strong> for <strong>"{getCustomerName(loanToDelete?.customer || '')}"</strong>.
                         <br/>
                         <span className="text-sm font-medium">Ensure this loan has no repayments before proceeding. This action cannot be undone.</span>
                     </AlertDescription>
                 </Alert>
             </DialogHeader>
             <DialogFooter className="mt-4">
                <Button variant="outline" onClick={closeDeleteDialog} disabled={isDeleting}>Cancel</Button>
                <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
                    {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Delete Loan
                </Button>
             </DialogFooter>
         </DialogContent>
       </Dialog>
    </div>
  );
}
