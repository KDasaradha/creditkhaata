
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
import { format, parseISO, isBefore, isValid } from 'date-fns'; // Added isValid
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import Link from 'next/link'; // Added Link import

// Use NEXT_PUBLIC_ prefix for client-side environment variables
const API_URL = process.env.NEXT_PUBLIC_API_URL; // Corrected variable name

interface Customer {
  _id: string;
  name: string;
  phone: string;
}

// Allow customer to be populated object or just string ID
interface Loan {
  _id: string;
  customer: Customer | string; // Can be populated or just ID string
  description: string;
  amount: number;
  balance: number;
  issueDate: string; // ISO String
  dueDate: string; // ISO String
  frequency: 'bi-weekly' | 'monthly' | 'one-time';
  interestRate: number;
  graceDays: number;
  status: 'pending' | 'paid' | 'overdue';
  createdAt: string; // ISO String
  updatedAt: string; // ISO String
}

// Form data structure
interface LoanFormData {
    customerId: string; // Always store ID in form
    description: string;
    amount: number | string; // Allow string during input
    issueDate: Date | undefined;
    dueDate: Date | undefined;
    frequency: 'bi-weekly' | 'monthly' | 'one-time';
    interestRate: number | string; // Allow string during input
    graceDays: number | string; // Allow string during input
}

type LoanStatus = Loan['status'];
type LoanFrequency = Loan['frequency'];

export default function LoansPage() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingLoan, setEditingLoan] = useState<Loan | null>(null);
  // Initialize form data with defaults
  const [formData, setFormData] = useState<LoanFormData>({
    customerId: '',
    description: '',
    amount: '',
    issueDate: new Date(), // Default issue date to today
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

  // Helper to safely get customer name
  const getCustomerName = (customerInput: string | Customer | undefined): string => {
      if (!customerInput) return 'Unknown';
      if (typeof customerInput === 'object' && customerInput !== null && 'name' in customerInput) {
          return customerInput.name;
      }
      // If it's a string ID, find the customer in the customers list
      if (typeof customerInput === 'string') {
           const customer = customers.find(c => c._id === customerInput);
           return customer ? customer.name : 'Loading...'; // Indicate loading if customer list isn't ready
      }
      return 'Invalid Customer Data';
  };

  // Fetch both loans and customers
  const fetchLoansAndCustomers = useCallback(async () => {
    if (!API_URL) {
        setError("API URL is not configured.");
        setLoading(false);
        return;
    }
    setLoading(true);
    setError(null);
    try {
        // Fetch customers first for the dropdown
        const customerResponse = await fetch(`${API_URL}/customers`, { headers: getAuthHeaders() });
        if (!customerResponse.ok) {
            const errData = await customerResponse.json().catch(()=>({message: 'Failed to load customers'}));
            throw new Error(errData.message || 'Failed to fetch customers');
        }
        const customerData: Customer[] = await customerResponse.json();
        setCustomers(customerData);

        // Then fetch loans
        const loanResponse = await fetch(`${API_URL}/loans`, { headers: getAuthHeaders() });
        if (!loanResponse.ok) {
            const errData = await loanResponse.json().catch(()=>({message: 'Failed to load loans'}));
            throw new Error(errData.message || `Failed to fetch loans (${loanResponse.status})`);
        }
        const loanData: Loan[] = await loanResponse.json();
        // Note: Backend should populate customer name, but frontend can map if needed
        setLoans(loanData);

    } catch (err: any) {
      console.error("Fetch Loans/Customers Error:", err);
      setError(err.message || 'An unknown error occurred while loading data.');
    } finally {
      setLoading(false);
    }
  }, []); // Empty dependency array, depends only on API_URL

  useEffect(() => {
     if (typeof window !== 'undefined' && window.location.hash === '#add') {
       handleOpenForm();
       // window.history.replaceState(null, '', window.location.pathname + window.location.search);
     }
    fetchLoansAndCustomers();
  }, [fetchLoansAndCustomers]); // fetchLoansAndCustomers is stable

  // Reset form fields and errors
  const resetForm = () => {
    setEditingLoan(null);
    setFormData({
        customerId: '',
        description: '',
        amount: '',
        issueDate: new Date(), // Reset issue date to today
        dueDate: undefined,
        frequency: 'monthly',
        interestRate: 0,
        graceDays: 0,
    });
    setFormError(null);
    setIsSubmitting(false); // Ensure submitting state is reset
  };

  // Open the add/edit form dialog
  const handleOpenForm = (loan: Loan | null = null) => {
    resetForm(); // Reset before populating
    if (loan) {
        setEditingLoan(loan);
        // Ensure dates are parsed correctly from ISO strings
        const issueDate = loan.issueDate ? parseISO(loan.issueDate) : new Date();
        const dueDate = loan.dueDate ? parseISO(loan.dueDate) : undefined;

        setFormData({
            // Handle case where customer might be just an ID string
            customerId: typeof loan.customer === 'string' ? loan.customer : loan.customer._id,
            description: loan.description,
            amount: loan.amount,
            issueDate: isValid(issueDate) ? issueDate : new Date(), // Fallback if parsing fails
            dueDate: isValid(dueDate) ? dueDate : undefined,       // Fallback if parsing fails
            frequency: loan.frequency,
            interestRate: loan.interestRate,
            graceDays: loan.graceDays,
        });
    } else {
         // Ensure dates are reset for a new loan
         setFormData(prev => ({ ...prev, issueDate: new Date(), dueDate: undefined }));
    }
    setIsFormOpen(true);
  };

   // Close the add/edit form dialog
   const handleCloseForm = () => {
      if(isSubmitting) return; // Prevent closing during submission
      setIsFormOpen(false);
      setTimeout(resetForm, 300); // Delay reset for animation
   };

   // Handle input changes for text/number fields
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
             // Allow empty strings for number inputs temporarily
            [name]: (name === 'amount' || name === 'interestRate' || name === 'graceDays') ? value : value,
        }));
    };

    // Handle changes for Select components
    const handleSelectChange = (name: keyof LoanFormData, value: string) => {
        // Type assertion for frequency
        if (name === 'frequency') {
            setFormData(prev => ({ ...prev, [name]: value as LoanFrequency }));
        } else {
             setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    // Handle changes for Date picker components
    const handleDateChange = (name: 'issueDate' | 'dueDate', date: Date | undefined) => {
        setFormData(prev => ({ ...prev, [name]: date }));
    };


  // Handle form submission (Add/Edit Loan)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
     if (!API_URL) {
         setFormError("API URL not configured.");
         return;
     }
    setFormError(null);
    setIsSubmitting(true);

    // --- Form Validation ---
    if (!formData.customerId || !formData.description || formData.amount === '' || !formData.dueDate) {
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
         setFormError('Interest Rate must be a non-negative number.');
         setIsSubmitting(false);
         return;
     }
     const graceDaysNum = parseInt(String(formData.graceDays), 10);
      if (isNaN(graceDaysNum) || graceDaysNum < 0) {
          setFormError('Grace Days must be a non-negative integer.');
          setIsSubmitting(false);
          return;
      }
      // Ensure issueDate is set (should be by default)
       if (!formData.issueDate) {
           setFormError('Issue Date is required.');
           setIsSubmitting(false);
           return;
       }
      if (isBefore(formData.dueDate, formData.issueDate)) {
          setFormError('Due Date cannot be before the Issue Date.');
          setIsSubmitting(false);
          return;
      }
      // --- End Validation ---


    const url = editingLoan ? `${API_URL}/loans/${editingLoan._id}` : `${API_URL}/loans`;
    const method = editingLoan ? 'PUT' : 'POST';

    // Construct payload carefully
    const payloadBase = {
        customerId: formData.customerId,
        description: formData.description,
        amount: amountNum,
        issueDate: formData.issueDate?.toISOString(),
        dueDate: formData.dueDate?.toISOString(),
        frequency: formData.frequency,
        interestRate: interestRateNum,
        graceDays: graceDaysNum,
    };

    // For PUT, only send fields that are editable according to backend logic
    const payload = editingLoan ? {
        description: payloadBase.description,
        dueDate: payloadBase.dueDate,
        frequency: payloadBase.frequency,
        interestRate: payloadBase.interestRate,
        graceDays: payloadBase.graceDays,
        // DO NOT SEND: customerId, amount, issueDate if they are immutable
    } : payloadBase; // For POST, send everything


    try {
      const response = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to parse error response'}));
        throw new Error(errorData.message || `Failed to ${editingLoan ? 'update' : 'create'} loan (${response.status})`);
      }

      await fetchLoansAndCustomers(); // Refresh list
      handleCloseForm(); // Close form on success

    } catch (err: any) {
      console.error("Submit Loan Error:", err);
      setFormError(err.message || 'An unknown error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

   // Open delete confirmation dialog
   const openDeleteDialog = (loan: Loan) => {
      setLoanToDelete(loan);
      setIsDeleteDialogOpen(true);
   };

   // Close delete confirmation dialog
   const closeDeleteDialog = () => {
      if (isDeleting) return;
      setIsDeleteDialogOpen(false);
       setTimeout(() => {
           setLoanToDelete(null);
       }, 300);
   };

  // Handle actual deletion
  const handleDelete = async () => {
      if (!loanToDelete || !API_URL) return;
      setIsDeleting(true);
      setError(null); // Clear main page error

      try {
          const response = await fetch(`${API_URL}/loans/${loanToDelete._id}`, {
              method: 'DELETE',
              headers: getAuthHeaders(),
          });

          if (!response.ok) {
              const errorData = await response.json().catch(() => ({ message: 'Failed to parse error response'}));
              // Handle specific constraint errors from backend
              if (response.status === 400 && errorData.message?.includes('repayments')) {
                   setError(`Cannot delete loan "${loanToDelete.description}": ${errorData.message}`);
              } else {
                  throw new Error(errorData.message || `Failed to delete loan (${response.status})`);
              }
               closeDeleteDialog();
               return;
          }

          // Update state or refetch
          setLoans(prev => prev.filter(l => l._id !== loanToDelete._id));
          // await fetchLoansAndCustomers();
          closeDeleteDialog(); // Close on success

      } catch (err: any) {
          console.error("Delete Loan Error:", err);
          setError(`Delete failed: ${err.message}`); // Show error on main page
          closeDeleteDialog(); // Close dialog even on error
      } finally {
          setIsDeleting(false);
      }
  };


    // Helper function to get badge variant based on loan status
    const getStatusBadgeVariant = (status: LoanStatus): "default" | "secondary" | "destructive" | "outline" => {
        switch (status) {
            case 'paid': return 'secondary'; // Greyish for paid
            case 'overdue': return 'destructive'; // Red for overdue
            case 'pending': return 'default'; // Primary color (or yellow/orange if defined) for pending
            default: return 'outline'; // Fallback
        }
    };
    // Helper function to get badge text
    const getStatusBadgeText = (status: LoanStatus): string => {
        switch (status) {
            case 'paid': return 'Paid';
            case 'overdue': return 'Overdue';
            case 'pending': return 'Pending';
            default: return status.charAt(0).toUpperCase() + status.slice(1); // Capitalize
        }
    }

    // Navigate to the loan detail page
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
                     {/* Provide retry only for specific fetch errors */}
                     {(error.includes('fetch loans') || error.includes('fetch customers')) &&
                        <Button variant="link" size="sm" onClick={fetchLoansAndCustomers} className="p-0 h-auto ml-2">Retry</Button>}
                </AlertDescription>
            </Alert>
        )}

      {/* Main Card for Loan Management */}
      <Card className="shadow-md rounded-lg overflow-hidden border border-border">
        {/* Card Header with Title and Add Button */}
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 sm:p-6 bg-card border-b">
           <div>
                <CardTitle className="text-xl font-semibold flex items-center gap-2"><ListChecks className="h-5 w-5 text-primary"/> Loan Management</CardTitle>
                <CardDescription className="text-muted-foreground mt-1">Track credit sales, balances, and payment statuses.</CardDescription>
           </div>
           {/* Add/Edit Loan Dialog Trigger and Content */}
           <div className="flex gap-2 items-center">
                {/* TODO: Add Filtering/Search */}
                {/* <Input placeholder="Search loans..." className="max-w-xs hidden md:block" />
                <Button variant="outline" size="icon"><ListFilter className="h-4 w-4" /><span className="sr-only">Filter</span></Button> */}
                 <Dialog open={isFormOpen} onOpenChange={(open) => open ? setIsFormOpen(true) : handleCloseForm()}>
                    <DialogTrigger asChild>
                        <Button onClick={() => handleOpenForm()}>
                            <FilePlus className="mr-2 h-4 w-4" /> Add Loan
                        </Button>
                    </DialogTrigger>
                    {/* Dialog Content */}
                    <DialogContent
                        className="sm:max-w-[520px]"
                        onInteractOutside={(e) => {if(isSubmitting) e.preventDefault()}}
                        onEscapeKeyDown={(e) => {if(isSubmitting) e.preventDefault()}}
                    >
                        <DialogHeader>
                            <DialogTitle>{editingLoan ? 'Edit Loan Details' : 'Add New Loan'}</DialogTitle>
                            {/* Reminder for editing limitations */}
                            {editingLoan && <p className="text-sm text-muted-foreground">Note: Customer, Amount, and Issue Date cannot be changed after creation.</p>}
                        </DialogHeader>
                        {/* Form inside Dialog */}
                        <form onSubmit={handleSubmit} className="space-y-4 pt-4 max-h-[70vh] overflow-y-auto pr-2">
                                {/* Customer Selection */}
                                <div className="space-y-2">
                                    <Label htmlFor="customerId">Customer <span className="text-destructive">*</span></Label>
                                    <Select
                                        value={formData.customerId}
                                        onValueChange={(value) => handleSelectChange('customerId', value)}
                                        required
                                        // Disable customer selection when editing or if no customers exist
                                        disabled={isSubmitting || !!editingLoan || customers.length === 0}
                                        >
                                        <SelectTrigger>
                                            <SelectValue placeholder={customers.length === 0 ? "No customers available" : "Select a customer"} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {customers.length === 0 && <div className='p-4 text-sm text-muted-foreground text-center'>No customers found. <Link href="/dashboard/customers#add" className="text-primary underline">Add one first</Link>.</div>}
                                            {customers.map((customer) => (
                                                <SelectItem key={customer._id} value={customer._id}>
                                                    {customer.name} ({customer.phone})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                     {customers.length === 0 && !editingLoan && (
                                         <p className="text-xs text-muted-foreground">You need to <Link href="/dashboard/customers#add" className="text-primary underline">add a customer</Link> before creating a loan.</p>
                                     )}
                                </div>

                                {/* Description */}
                               <div className="space-y-2">
                                   <Label htmlFor="description">Description <span className="text-destructive">*</span></Label>
                                   <Textarea id="description" name="description" value={formData.description} onChange={handleInputChange} required disabled={isSubmitting} placeholder="e.g., Groceries, Repair service"/>
                               </div>

                               {/* Amount & Frequency */}
                               <div className="grid grid-cols-2 gap-4">
                                    {/* Amount (Disabled if editing) */}
                                   <div className="space-y-2">
                                       <Label htmlFor="amount">Amount (₹) <span className="text-destructive">*</span></Label>
                                       <Input id="amount" name="amount" type="number" min="0.01" step="0.01" value={formData.amount} onChange={handleInputChange} required disabled={isSubmitting || !!editingLoan} placeholder="e.g., 500"/>
                                   </div>
                                    {/* Frequency */}
                                    <div className="space-y-2">
                                        <Label htmlFor="frequency">Payment Frequency</Label>
                                        <Select value={formData.frequency} onValueChange={(value: LoanFrequency) => handleSelectChange('frequency', value)} required disabled={isSubmitting}>
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

                               {/* Issue Date & Due Date */}
                                <div className="grid grid-cols-2 gap-4">
                                    {/* Issue Date (Disabled if editing) */}
                                    <div className="space-y-2">
                                        <Label htmlFor="issueDate">Issue Date <span className="text-destructive">*</span></Label>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant={"outline"}
                                                    className={cn("w-full justify-start text-left font-normal", !formData.issueDate && "text-muted-foreground")}
                                                    // Disable issue date picker when editing
                                                    disabled={isSubmitting || !!editingLoan}
                                                >
                                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                                    {formData.issueDate ? format(formData.issueDate, "PPP") : <span>Pick issue date</span>}
                                                </Button>
                                            </PopoverTrigger>
                                            {!editingLoan && ( // Only show calendar if NOT editing
                                                <PopoverContent className="w-auto p-0">
                                                    <Calendar
                                                        mode="single"
                                                        selected={formData.issueDate}
                                                        onSelect={(date) => handleDateChange('issueDate', date)}
                                                        initialFocus
                                                        disabled={isSubmitting || !!editingLoan}
                                                    />
                                                </PopoverContent>
                                            )}
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
                                                    // Disable dates before the issue date
                                                     disabled={(date) =>
                                                        (!!formData.issueDate && isBefore(date, formData.issueDate)) || isSubmitting
                                                     }
                                                />
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                </div>

                               {/* Interest Rate & Grace Days */}
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

                              {/* Form Error Alert */}
                              {formError && (
                                  <Alert variant="destructive">
                                      <AlertTriangle className="h-4 w-4" />
                                      <AlertTitle>Form Error</AlertTitle>
                                      <AlertDescription>{formError}</AlertDescription>
                                  </Alert>
                              )}

                            {/* Dialog Footer */}
                            <DialogFooter className="pt-4 sticky bottom-0 bg-background py-4">
                                <DialogClose asChild>
                                    <Button type="button" variant="outline" onClick={handleCloseForm} disabled={isSubmitting}>Cancel</Button>
                                </DialogClose>
                                <Button
                                    type="submit"
                                    // Disable submit if adding and no customers are available
                                    disabled={isSubmitting || (customers.length === 0 && !editingLoan)}
                                >
                                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    {editingLoan ? 'Save Changes' : 'Create Loan'}
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>
        </CardHeader>
        {/* Card Content with Table */}
        <CardContent className="p-0">
           {loading ? (
               <div className="flex justify-center items-center py-16 text-muted-foreground">
                   <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                   <span>Loading loans...</span>
               </div>
           ) : loans.length === 0 ? (
               // Empty State
               <div className="text-center py-16 px-6">
                    <ListChecks className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
                    <p className="text-muted-foreground font-medium mb-2">No loans recorded yet.</p>
                    <p className="text-muted-foreground text-sm mb-4">Click "Add Loan" to record a new credit sale.</p>
                    <Button onClick={() => handleOpenForm()}>
                        <FilePlus className="mr-2 h-4 w-4" /> Add First Loan
                    </Button>
               </div>
           ) : (
               // Loans Table
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
                    {/* Sticky Actions Header */}
                    <TableHead className="text-right sticky right-0 bg-card z-10 px-2 md:px-4">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {loans.map((loan) => (
                    <TableRow key={loan._id} className="hover:bg-muted/50">
                        <TableCell className="font-medium">{getCustomerName(loan.customer)}</TableCell>
                        <TableCell className="hidden md:table-cell max-w-[200px] truncate text-muted-foreground">{loan.description}</TableCell>
                        <TableCell className="text-right">₹{Number(loan.amount).toFixed(2)}</TableCell>
                        <TableCell className={cn("text-right font-semibold", Number(loan.balance) > 0 ? 'text-orange-600' : 'text-green-600')}>₹{Number(loan.balance).toFixed(2)}</TableCell>
                        <TableCell className="hidden lg:table-cell text-center text-sm text-muted-foreground">{format(parseISO(loan.issueDate), 'dd MMM yy')}</TableCell>
                        <TableCell className="text-center text-sm">{format(parseISO(loan.dueDate), 'dd MMM yy')}</TableCell>
                        <TableCell className="text-center">
                            <Badge variant={getStatusBadgeVariant(loan.status)} className="text-xs px-2 py-0.5">{getStatusBadgeText(loan.status)}</Badge>
                        </TableCell>
                        {/* Sticky Actions Cell */}
                        <TableCell className="text-right space-x-1 sticky right-0 bg-card z-10 px-2 md:px-4">
                            {/* View Details Button */}
                            <Button variant="ghost" size="icon" onClick={() => navigateToLoanDetail(loan._id)} title="View Details" className="hover:text-primary h-8 w-8">
                                <Eye className="h-4 w-4" />
                                <span className="sr-only">View Details</span>
                            </Button>
                            {/* Edit Button */}
                            <Button variant="ghost" size="icon" onClick={() => handleOpenForm(loan)} title="Edit" className="hover:text-primary h-8 w-8">
                                <Edit className="h-4 w-4" />
                                <span className="sr-only">Edit</span>
                            </Button>
                             {/* Delete Button */}
                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive/80 h-8 w-8" onClick={() => openDeleteDialog(loan)} title="Delete">
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
       <Dialog open={isDeleteDialogOpen} onOpenChange={(open) => open ? setIsDeleteDialogOpen(true) : closeDeleteDialog()}>
         <DialogContent
            onInteractOutside={(e) => { if (isDeleting) e.preventDefault(); }}
            onEscapeKeyDown={(e) => { if (isDeleting) e.preventDefault(); }}
         >
             <DialogHeader>
                 <DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-destructive"/> Confirm Deletion</DialogTitle>
                 <Alert variant="destructive" className="mt-4 border-0 bg-transparent p-0">
                     <AlertDescription>
                         This will permanently delete the loan: <strong className="text-foreground">"{loanToDelete?.description}"</strong> for <strong className="text-foreground">"{getCustomerName(loanToDelete?.customer)}"</strong>.
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
