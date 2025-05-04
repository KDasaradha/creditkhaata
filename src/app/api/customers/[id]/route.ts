// src/app/api/customers/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db';
import Customer, { ICustomer } from '@/models/Customer'; // Import ICustomer
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

// Helper to add CORS headers
function addCorsHeaders(response: NextResponse): NextResponse {
    response.headers.set('Access-Control-Allow-Origin', '*'); // Adjust for production
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    return response;
}

// Handle OPTIONS requests for CORS preflight
export async function OPTIONS(req: NextRequest) {
  const response = new NextResponse(null, { status: 204 });
  return addCorsHeaders(response);
}


// GET a single customer by ID
export async function GET(req: NextRequest, { params }: Params) {
  let userId;
  let response: NextResponse;
  try {
    // Authenticate and connect to DB first
    userId = await getUserIdFromRequest(req);
    await ensureDbConnection();
    const { id } = params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        response = NextResponse.json({ message: 'Invalid customer ID format' }, { status: 400 });
        return addCorsHeaders(response);
    }

    // Fetch customer
    const customer = await Customer.findById(id).lean(); // Use lean for read-only

    if (!customer) {
      response = NextResponse.json({ message: 'Customer not found' }, { status: 404 });
      return addCorsHeaders(response);
    }

    // Ensure the customer belongs to the logged-in shopkeeper
    if (customer.shopkeeper.toString() !== userId) {
       console.warn(`Unauthorized attempt: User ${userId} tried to access customer ${id} owned by ${customer.shopkeeper.toString()}`);
      response = NextResponse.json({ message: 'Not authorized to view this customer' }, { status: 403 }); // 403 Forbidden better than 401
      return addCorsHeaders(response);
    }

    response = NextResponse.json(customer);

  } catch (error: any) {
     console.error(`GET Customer ${params?.id || 'invalid ID'} API error:`, error);
     // Handle specific error types
     if (error.message.startsWith('Not authorized')) {
         response = NextResponse.json({ message: error.message }, { status: 401 });
     } else if (error.message.includes('Could not connect to database')) {
          response = NextResponse.json({ message: error.message }, { status: 503 }); // Service Unavailable
     } else if (error instanceof mongoose.Error.CastError && error.path === '_id') {
         response = NextResponse.json({ message: 'Invalid customer ID format' }, { status: 400 });
     } else {
        // Generic error
        response = NextResponse.json({ message: 'Server error fetching customer', error: error.message || 'Unknown error' }, { status: 500 });
     }
  }
  return addCorsHeaders(response);
}

// PUT (update) a customer by ID
export async function PUT(req: NextRequest, { params }: Params) {
   let userId;
   let response: NextResponse;
  try {
    // Authenticate and connect to DB
    userId = await getUserIdFromRequest(req);
    await ensureDbConnection();
    const { id } = params;

     if (!mongoose.Types.ObjectId.isValid(id)) {
        response = NextResponse.json({ message: 'Invalid customer ID format' }, { status: 400 });
        return addCorsHeaders(response);
    }

    const requestBody = await req.json(); // Parse body once

    // --- Validation --- (Add more specific validation if needed)
     const { name, phone, address, notes, trustScore, creditLimit } = requestBody; // Added notes
     const validationErrors: string[] = [];

     if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0)) validationErrors.push('Name cannot be empty.');
     if (phone !== undefined) {
         if (typeof phone !== 'string' || phone.trim().length === 0) {
             validationErrors.push('Phone cannot be empty.');
         } else if (!/^[6-9]\d{9}$/.test(phone.replace(/\s+/g, ''))) {
            validationErrors.push('Invalid 10-digit mobile number format.');
         }
     }
     if (address !== undefined && typeof address !== 'string') validationErrors.push('Invalid address format.');
     if (notes !== undefined && typeof notes !== 'string') validationErrors.push('Invalid notes format.'); // Added notes validation
     if (trustScore !== undefined) {
         const score = Number(trustScore);
         if (isNaN(score) || score < 0 || score > 10) validationErrors.push('Trust Score must be between 0 and 10.');
     }
     if (creditLimit !== undefined) {
         const limit = Number(creditLimit);
         if (isNaN(limit) || limit < 0) validationErrors.push('Credit Limit must be non-negative.');
     }

      if (validationErrors.length > 0) {
          response = NextResponse.json({ message: validationErrors.join(' ') }, { status: 400 });
          return addCorsHeaders(response);
      }


    // Find existing customer (do not use lean here, we need to save it)
    let customer = await Customer.findById(id);

    if (!customer) {
      response = NextResponse.json({ message: 'Customer not found' }, { status: 404 });
       return addCorsHeaders(response);
    }

    // Check ownership
    if (customer.shopkeeper.toString() !== userId) {
      console.warn(`Unauthorized attempt: User ${userId} tried to update customer ${id} owned by ${customer.shopkeeper.toString()}`);
      response = NextResponse.json({ message: 'Not authorized to update this customer' }, { status: 403 });
       return addCorsHeaders(response);
    }

    // Apply updates selectively - only update fields present in the request body
    if (name !== undefined) customer.name = name.trim();
    if (phone !== undefined) customer.phone = phone.replace(/\s+/g, ''); // Clean phone number
    if (address !== undefined) customer.address = address.trim();
    if (notes !== undefined) customer.notes = notes.trim(); // Added notes update
    if (trustScore !== undefined) customer.trustScore = Number(trustScore);
    if (creditLimit !== undefined) customer.creditLimit = Number(creditLimit);

    // Mongoose `timestamps: true` handles `updatedAt` automatically on save
    const updatedCustomer = await customer.save(); // Triggers validation and middleware

    response = NextResponse.json(updatedCustomer);

  } catch (error: any) {
     console.error(`PUT Customer ${params?.id || 'invalid ID'} API error:`, error);
      // Handle specific errors
     if (error.message.startsWith('Not authorized')) {
         response = NextResponse.json({ message: error.message }, { status: 401 });
     } else if (error.message.includes('Could not connect to database')) {
          response = NextResponse.json({ message: error.message }, { status: 503 }); // Service Unavailable
     } else if (error instanceof SyntaxError) { // JSON parsing error
         response = NextResponse.json({ message: 'Invalid request body format.' }, { status: 400 });
     } else if (error instanceof mongoose.Error.ValidationError) { // Mongoose validation error
        const messages = Object.values(error.errors).map((val: any) => val.message);
        response = NextResponse.json({ message: messages.join('. ') }, { status: 400 });
     } else if (error instanceof mongoose.Error.CastError) { // Invalid data type (e.g., for number fields)
         response = NextResponse.json({ message: `Invalid data type provided for field ${error.path}. Expected ${error.kind}.` }, { status: 400 });
     } else if (error.code === 11000) { // Duplicate key error
         response = NextResponse.json({ message: 'Update failed: Phone number might already be in use by another customer.' }, { status: 409 }); // 409 Conflict
     } else {
        // Generic error
        response = NextResponse.json({ message: 'Server error updating customer', error: error.message || 'Unknown error' }, { status: 500 });
     }
  }
   return addCorsHeaders(response);
}

// DELETE a customer by ID
export async function DELETE(req: NextRequest, { params }: Params) {
   let userId;
   let response: NextResponse;
  try {
     // Authenticate and connect to DB
    userId = await getUserIdFromRequest(req);
    await ensureDbConnection();
    const { id } = params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        response = NextResponse.json({ message: 'Invalid customer ID format' }, { status: 400 });
        return addCorsHeaders(response);
    }

    // Find customer to check ownership before deleting
    const customer = await Customer.findById(id);

    if (!customer) {
      response = NextResponse.json({ message: 'Customer not found' }, { status: 404 });
       return addCorsHeaders(response);
    }

    // Check ownership
    if (customer.shopkeeper.toString() !== userId) {
      console.warn(`Unauthorized attempt: User ${userId} tried to delete customer ${id} owned by ${customer.shopkeeper.toString()}`);
      response = NextResponse.json({ message: 'Not authorized to delete this customer' }, { status: 403 });
       return addCorsHeaders(response);
    }

    // Check for associated loans before deleting
    const loanCount = await Loan.countDocuments({ customer: id, shopkeeper: userId });
    if (loanCount > 0) {
       console.log(`Deletion prevented: Customer ${id} has ${loanCount} associated loans.`);
      response = NextResponse.json({ message: `Cannot delete customer with ${loanCount} associated loan(s). Consider archiving or resolving loans first.` }, { status: 400 }); // 400 Bad Request as it's a business rule violation
       return addCorsHeaders(response);
    }

    // Perform delete
    const deleteResult = await Customer.findByIdAndDelete(id);

     if (!deleteResult) {
         // Should ideally not happen if the initial findById succeeded, but handle race conditions
         console.warn(`Customer ${id} not found during delete operation, possibly deleted already.`);
         response = NextResponse.json({ message: 'Customer not found during delete operation' }, { status: 404 });
         return addCorsHeaders(response);
     }

     console.log(`Customer ${id} deleted successfully by user ${userId}.`);
    response = NextResponse.json({ message: 'Customer removed successfully' });

  } catch (error: any) {
      console.error(`DELETE Customer ${params?.id || 'invalid ID'} API error:`, error);
       // Handle specific errors
      if (error.message.startsWith('Not authorized')) {
          response = NextResponse.json({ message: error.message }, { status: 401 });
      } else if (error.message.includes('Could not connect to database')) {
           response = NextResponse.json({ message: error.message }, { status: 503 }); // Service Unavailable
       } else if (error instanceof mongoose.Error.CastError && error.path === '_id') {
         response = NextResponse.json({ message: 'Invalid customer ID format' }, { status: 400 });
     } else if (error instanceof mongoose.Error) { // Catch other potential Mongoose errors during count/delete
            console.error('Mongoose error during customer delete operation:', error);
            response = NextResponse.json({ message: 'Database error during delete operation.' }, { status: 500 });
       } else {
          // Generic error
          response = NextResponse.json({ message: 'Server error deleting customer', error: error.message || 'Unknown error' }, { status: 500 });
      }
  }
   return addCorsHeaders(response);
}
