
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { PlusCircle, Edit, Trash2, AlertTriangle, Loader2, UserPlus, Users } from 'lucide-react';
import { getAuthHeaders } from '@/lib/auth';
import { format } from 'date-fns';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface Customer {
  _id: string;
  name: string;
  phone: string;
  address?: string;
  trustScore: number;
  creditLimit: number;
  createdAt: string;
  updatedAt: string;
}

type CustomerFormData = Omit<Customer, '_id' | 'createdAt' | 'updatedAt'>;

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState<CustomerFormData>({
    name: '',
    phone: '',
    address: '',
    trustScore: 5,
    creditLimit: 0,
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);


  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/customers`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to fetch customers (${response.status})`);
      }
      const data: Customer[] = await response.json();
      setCustomers(data);
    } catch (err: any) {
        console.error("Fetch Customers Error:", err);
      setError(err.message || 'An unknown error occurred while fetching customers.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Check URL hash to potentially open the add customer dialog immediately
     if (typeof window !== 'undefined' && window.location.hash === '#add') {
       handleOpenForm();
       // Optionally remove the hash
       // window.history.replaceState(null, '', window.location.pathname + window.location.search);
     }
    fetchCustomers();
  }, [fetchCustomers]);


  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'trustScore' || name === 'creditLimit' ? Number(value) : value,
    }));
  };

  const resetForm = () => {
    setEditingCustomer(null);
    setFormData({
        name: '',
        phone: '',
        address: '',
        trustScore: 5,
        creditLimit: 0,
    });
    setFormError(null);
    setIsSubmitting(false);
  };

  const handleOpenForm = (customer: Customer | null = null) => {
      resetForm();
      if (customer) {
          setEditingCustomer(customer);
          setFormData({
              name: customer.name,
              phone: customer.phone,
              address: customer.address || '',
              trustScore: customer.trustScore,
              creditLimit: customer.creditLimit,
          });
      }
      setIsFormOpen(true);
  };

  const handleCloseForm = () => {
      setIsFormOpen(false);
      setTimeout(resetForm, 300);
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    if (!formData.name || !formData.phone) {
        setFormError('Name and Phone are required.');
        setIsSubmitting(false);
        return;
    }
    if (formData.trustScore < 0 || formData.trustScore > 10) {
        setFormError('Trust Score must be between 0 and 10.');
        setIsSubmitting(false);
        return;
    }
     if (formData.creditLimit < 0) {
        setFormError('Credit Limit cannot be negative.');
        setIsSubmitting(false);
        return;
    }

    const url = editingCustomer
      ? `${API_URL}/customers/${editingCustomer._id}`
      : `${API_URL}/customers`;
    const method = editingCustomer ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to ${editingCustomer ? 'update' : 'add'} customer`);
      }

      await fetchCustomers();
      handleCloseForm();

    } catch (err: any) {
      console.error("Submit Customer Error:", err);
      setFormError(err.message || `An unknown error occurred.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openDeleteDialog = (customer: Customer) => {
      setCustomerToDelete(customer);
      setIsDeleteDialogOpen(true);
  };

  const closeDeleteDialog = () => {
      setIsDeleteDialogOpen(false);
      setCustomerToDelete(null);
      setIsDeleting(false);
  };

  const handleDelete = async () => {
      if (!customerToDelete) return;
      setIsDeleting(true);
      setError(null);

      try {
          const response = await fetch(`${API_URL}/customers/${customerToDelete._id}`, {
              method: 'DELETE',
              headers: getAuthHeaders(),
          });

          if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.message || `Failed to delete customer (${response.status})`);
          }

          setCustomers(prev => prev.filter(c => c._id !== customerToDelete._id));
          closeDeleteDialog();

      } catch (err: any) {
          console.error("Delete Customer Error:", err);
           setError(err.message || 'An unknown error occurred while deleting.');
           // Keep dialog open on error? Maybe not, show main error instead.
           closeDeleteDialog();
      }
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
                {/* Provide a retry option if applicable */}
                 {error.includes('fetch') && <Button variant="link" size="sm" onClick={fetchCustomers} className="p-0 h-auto ml-2">Retry</Button>}
            </AlertDescription>
        </Alert>
      )}

      <Card className="shadow-md rounded-lg overflow-hidden">
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 sm:p-6 bg-card border-b">
          <div>
            <CardTitle className="text-xl font-semibold flex items-center gap-2"><Users className="h-5 w-5 text-primary"/> Manage Customers</CardTitle>
            <CardDescription className="text-muted-foreground mt-1">Add, view, edit, or delete customer profiles.</CardDescription>
          </div>
          <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogTrigger asChild>
                    <Button onClick={() => handleOpenForm()}>
                        <UserPlus className="mr-2 h-4 w-4" /> Add Customer
                    </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[480px]" onInteractOutside={(e) => { if (isSubmitting) e.preventDefault(); }}>
                    <DialogHeader>
                        <DialogTitle>{editingCustomer ? 'Edit Customer' : 'Add New Customer'}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                        <div className="space-y-2">
                           <Label htmlFor="name">Name <span className="text-destructive">*</span></Label>
                           <Input id="name" name="name" value={formData.name} onChange={handleInputChange} required disabled={isSubmitting} placeholder="e.g., John Doe"/>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="phone">Phone <span className="text-destructive">*</span></Label>
                            <Input id="phone" name="phone" value={formData.phone} onChange={handleInputChange} required disabled={isSubmitting} placeholder="e.g., 9876543210"/>
                        </div>
                        <div className="space-y-2">
                           <Label htmlFor="address">Address</Label>
                           <Textarea id="address" name="address" value={formData.address ?? ''} onChange={handleInputChange} disabled={isSubmitting} placeholder="Optional: Customer's address"/>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="trustScore">Trust Score (0-10)</Label>
                                <Input id="trustScore" name="trustScore" type="number" min="0" max="10" value={formData.trustScore} onChange={handleInputChange} required disabled={isSubmitting} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="creditLimit">Credit Limit (₹)</Label>
                                <Input id="creditLimit" name="creditLimit" type="number" min="0" step="any" value={formData.creditLimit} onChange={handleInputChange} required disabled={isSubmitting} placeholder="e.g., 5000" />
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
                           <Button type="submit" disabled={isSubmitting}>
                              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                              {editingCustomer ? 'Save Changes' : 'Add Customer'}
                           </Button>
                       </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </CardHeader>
        <CardContent className="p-0"> {/* Remove padding to allow table to span full width */}
          {loading ? (
             <div className="flex justify-center items-center py-16 text-muted-foreground">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                 <span>Loading customers...</span>
             </div>
          ) : customers.length === 0 ? (
              <div className="text-center py-16 px-6">
                 <Users className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
                 <p className="text-muted-foreground font-medium mb-2">No customers found.</p>
                 <p className="text-muted-foreground text-sm mb-4">Click "Add Customer" to get started.</p>
                 <Button onClick={() => handleOpenForm()}>
                    <UserPlus className="mr-2 h-4 w-4" /> Add First Customer
                 </Button>
             </div>
          ) : (
            <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead className="hidden md:table-cell">Address</TableHead>
                      <TableHead className="text-center">Trust</TableHead>
                      <TableHead className="text-right">Credit Limit</TableHead>
                       <TableHead className="hidden lg:table-cell text-right">Added On</TableHead>
                      <TableHead className="text-right sticky right-0 bg-card z-10">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customers.map((customer) => (
                      <TableRow key={customer._id} className="hover:bg-muted/50">
                        <TableCell className="font-medium">{customer.name}</TableCell>
                        <TableCell>{customer.phone}</TableCell>
                        <TableCell className="hidden md:table-cell max-w-xs truncate text-muted-foreground">{customer.address || 'N/A'}</TableCell>
                        <TableCell className="text-center">{customer.trustScore}/10</TableCell>
                        <TableCell className="text-right">₹{customer.creditLimit.toFixed(2)}</TableCell>
                        <TableCell className="hidden lg:table-cell text-right text-sm text-muted-foreground">{format(new Date(customer.createdAt), 'dd MMM yyyy')}</TableCell>
                        <TableCell className="text-right space-x-1 sticky right-0 bg-card z-10">
                            <Button variant="ghost" size="icon" className="hover:text-primary" onClick={() => handleOpenForm(customer)} title="Edit">
                                <Edit className="h-4 w-4" />
                                 <span className="sr-only">Edit</span>
                            </Button>
                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive/80" onClick={() => openDeleteDialog(customer)} title="Delete">
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
         {/* Optional: Add pagination controls if list becomes long */}
         {/* <CardFooter className="p-4 border-t"> <PaginationComponent /> </CardFooter> */}
      </Card>


      {/* Delete Confirmation Dialog */}
       <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
         <DialogContent>
             <DialogHeader>
                 <DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-destructive"/> Confirm Deletion</DialogTitle>
                 <Alert variant="destructive" className="mt-4 border-0 bg-transparent p-0">
                     {/* <AlertTriangle className="h-4 w-4" /> */}
                     {/* <AlertTitle>Are you sure?</AlertTitle> */}
                     <AlertDescription>
                         This action will permanently delete the customer <strong>"{customerToDelete?.name}"</strong>.
                         This cannot be undone. Ensure the customer has no outstanding loans before deleting.
                     </AlertDescription>
                 </Alert>
             </DialogHeader>
             <DialogFooter className="mt-4">
                <Button variant="outline" onClick={closeDeleteDialog} disabled={isDeleting}>Cancel</Button>
                <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
                    {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Delete Customer
                </Button>
             </DialogFooter>
         </DialogContent>
       </Dialog>
    </div>
  );
}

