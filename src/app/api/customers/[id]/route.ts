// src/app/api/customers/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db';
import Customer from '@/models/Customer';
import Loan from '@/models/Loan'; // Needed for delete check
import { getUserIdFromRequest } from '@/lib/server-utils';

interface Params {
    params: { id: string };
}

// Helper function to handle database connection errors
async function ensureDbConnection() {
    try {
        await connectDB();
    } catch (dbError: any) {
        console.error('Database connection failed in /api/customers/[id]:', dbError);
        throw new Error('Server error: Could not connect to database.'); // Throw specific error
    }
}

// GET a single customer by ID
export async function GET(req: NextRequest, { params }: Params) {
  let userId;
  try {
    // Authenticate and connect to DB first
    userId = await getUserIdFromRequest(req);
    await ensureDbConnection();
    const { id } = params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return NextResponse.json({ message: 'Invalid customer ID format' }, { status: 400 });
    }

    // Fetch customer
    const customer = await Customer.findById(id);

    if (!customer) {
      return NextResponse.json({ message: 'Customer not found' }, { status: 404 });
    }

    // Ensure the customer belongs to the logged-in shopkeeper
    if (customer.shopkeeper.toString() !== userId) {
       console.warn(`Unauthorized attempt: User ${userId} tried to access customer ${id} owned by ${customer.shopkeeper.toString()}`);
      return NextResponse.json({ message: 'Not authorized to view this customer' }, { status: 403 }); // 403 Forbidden better than 401
    }

    return NextResponse.json(customer);

  } catch (error: any) {
     console.error(`GET Customer ${params?.id || 'invalid ID'} API error:`, error);
     // Handle specific error types
     if (error.message.startsWith('Not authorized')) {
         return NextResponse.json({ message: error.message }, { status: 401 });
     }
     if (error.message.includes('Could not connect to database')) {
          return NextResponse.json({ message: error.message }, { status: 503 }); // Service Unavailable
     }
     if (error instanceof mongoose.Error.CastError && error.path === '_id') {
         return NextResponse.json({ message: 'Invalid customer ID format' }, { status: 400 });
     }
     // Generic error
     return NextResponse.json({ message: 'Server error fetching customer', error: error.message || 'Unknown error' }, { status: 500 });
  }
}

// PUT (update) a customer by ID
export async function PUT(req: NextRequest, { params }: Params) {
   let userId;
  try {
    // Authenticate and connect to DB
    userId = await getUserIdFromRequest(req);
    await ensureDbConnection();
    const { id } = params;

     if (!mongoose.Types.ObjectId.isValid(id)) {
        return NextResponse.json({ message: 'Invalid customer ID format' }, { status: 400 });
    }

    const requestBody = await req.json(); // Parse body once

    // --- Validation --- (Add more specific validation if needed)
     const { name, phone, address, trustScore, creditLimit } = requestBody;
     if (name !== undefined && typeof name !== 'string') return NextResponse.json({ message: 'Invalid name format' }, { status: 400 });
     if (phone !== undefined && typeof phone !== 'string') return NextResponse.json({ message: 'Invalid phone format' }, { status: 400 });
     // Add more validation as needed for address, trustScore, creditLimit types/values

    // Find existing customer
    let customer = await Customer.findById(id);

    if (!customer) {
      return NextResponse.json({ message: 'Customer not found' }, { status: 404 });
    }

    // Check ownership
    if (customer.shopkeeper.toString() !== userId) {
      console.warn(`Unauthorized attempt: User ${userId} tried to update customer ${id} owned by ${customer.shopkeeper.toString()}`);
      return NextResponse.json({ message: 'Not authorized to update this customer' }, { status: 403 });
    }

    // Build update object selectively - only include fields present in the request body
    const updateFields: Partial<ICustomer> = {}; // Use Partial<ICustomer> for type safety
    if (name !== undefined) updateFields.name = name;
    if (phone !== undefined) updateFields.phone = phone;
    if (address !== undefined) updateFields.address = address;
    if (trustScore !== undefined) updateFields.trustScore = Number(trustScore); // Ensure conversion
    if (creditLimit !== undefined) updateFields.creditLimit = Number(creditLimit); // Ensure conversion

    // Add updatedAt manually if not using timestamps: true
    // updateFields.updatedAt = new Date();

    // Perform update
    const updatedCustomer = await Customer.findByIdAndUpdate(
      id,
      { $set: updateFields },
      { new: true, runValidators: true, context: 'query' } // Return updated doc, run validators
    );

    // Check if update was successful (findByIdAndUpdate returns null if not found)
    if (!updatedCustomer) {
         // This might happen in a race condition if deleted between findById and findByIdAndUpdate
         console.warn(`Customer ${id} not found during update operation, possibly deleted.`);
         return NextResponse.json({ message: 'Customer not found during update' }, { status: 404 });
    }

    return NextResponse.json(updatedCustomer);

  } catch (error: any) {
     console.error(`PUT Customer ${params?.id || 'invalid ID'} API error:`, error);
      // Handle specific errors
     if (error.message.startsWith('Not authorized')) {
         return NextResponse.json({ message: error.message }, { status: 401 });
     }
     if (error.message.includes('Could not connect to database')) {
          return NextResponse.json({ message: error.message }, { status: 503 }); // Service Unavailable
     }
      if (error instanceof SyntaxError) { // JSON parsing error
         return NextResponse.json({ message: 'Invalid request body format.' }, { status: 400 });
     }
     if (error instanceof mongoose.Error.ValidationError) { // Mongoose validation error
        const messages = Object.values(error.errors).map((val: any) => val.message);
        return NextResponse.json({ message: messages.join('. ') }, { status: 400 });
     }
     if (error instanceof mongoose.Error.CastError) { // Invalid data type (e.g., for number fields)
         return NextResponse.json({ message: `Invalid data type provided for field ${error.path}. Expected ${error.kind}.` }, { status: 400 });
     }
     // Generic error
     return NextResponse.json({ message: 'Server error updating customer', error: error.message || 'Unknown error' }, { status: 500 });
  }
}

// DELETE a customer by ID
export async function DELETE(req: NextRequest, { params }: Params) {
   let userId;
  try {
     // Authenticate and connect to DB
    userId = await getUserIdFromRequest(req);
    await ensureDbConnection();
    const { id } = params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return NextResponse.json({ message: 'Invalid customer ID format' }, { status: 400 });
    }

    // Find customer to check ownership before deleting
    const customer = await Customer.findById(id);

    if (!customer) {
      return NextResponse.json({ message: 'Customer not found' }, { status: 404 });
    }

    // Check ownership
    if (customer.shopkeeper.toString() !== userId) {
      console.warn(`Unauthorized attempt: User ${userId} tried to delete customer ${id} owned by ${customer.shopkeeper.toString()}`);
      return NextResponse.json({ message: 'Not authorized to delete this customer' }, { status: 403 });
    }

    // Check for associated loans before deleting
    const loanCount = await Loan.countDocuments({ customer: id, shopkeeper: userId });
    if (loanCount > 0) {
       console.log(`Deletion prevented: Customer ${id} has ${loanCount} associated loans.`);
      return NextResponse.json({ message: `Cannot delete customer with ${loanCount} associated loan(s). Consider archiving or resolving loans first.` }, { status: 400 }); // 400 Bad Request as it's a business rule violation
    }

    // Perform delete
    const deleteResult = await Customer.findByIdAndDelete(id);

     if (!deleteResult) {
         // Should ideally not happen if the initial findById succeeded, but handle race conditions
         console.warn(`Customer ${id} not found during delete operation, possibly deleted already.`);
         return NextResponse.json({ message: 'Customer not found during delete operation' }, { status: 404 });
     }

     console.log(`Customer ${id} deleted successfully by user ${userId}.`);
    return NextResponse.json({ message: 'Customer removed successfully' });

  } catch (error: any) {
      console.error(`DELETE Customer ${params?.id || 'invalid ID'} API error:`, error);
       // Handle specific errors
      if (error.message.startsWith('Not authorized')) {
          return NextResponse.json({ message: error.message }, { status: 401 });
      }
       if (error.message.includes('Could not connect to database')) {
           return NextResponse.json({ message: error.message }, { status: 503 }); // Service Unavailable
       }
      if (error instanceof mongoose.Error.CastError && error.path === '_id') {
         return NextResponse.json({ message: 'Invalid customer ID format' }, { status: 400 });
     }
       if (error instanceof mongoose.Error) { // Catch other potential Mongoose errors during count/delete
            console.error('Mongoose error during customer delete operation:', error);
            return NextResponse.json({ message: 'Database error during delete operation.' }, { status: 500 });
       }
      // Generic error
      return NextResponse.json({ message: 'Server error deleting customer', error: error.message || 'Unknown error' }, { status: 500 });
  }
}

    