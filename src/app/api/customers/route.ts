// src/app/api/customers/route.ts
import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Customer, { ICustomer } from '@/models/Customer'; // Import ICustomer interface
import { getUserIdFromRequest } from '@/lib/server-utils'; // Server-side auth helper
import mongoose from 'mongoose';

// Helper function to handle database connection errors
async function ensureDbConnection() {
    try {
        await connectDB();
    } catch (dbError: any) {
        console.error('Database connection failed in /api/customers:', dbError);
        throw new Error('Server error: Could not connect to database.'); // Throw specific error
    }
}

// Helper to add CORS headers
function addCorsHeaders(response: NextResponse): NextResponse {
    // Allow requests from all origins in development.
    // In production, replace '*' with your specific frontend origin.
    response.headers.set('Access-Control-Allow-Origin', '*');
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


// GET all customers for the logged-in shopkeeper
export async function GET(req: NextRequest) {
   let userId;
   let response: NextResponse;
  try {
    // Authenticate and connect to DB first
    userId = await getUserIdFromRequest(req); // Authenticate and get user ID
    await ensureDbConnection();

    // Fetch customers, sorting by name
    const customers = await Customer.find({ shopkeeper: userId }).sort({ name: 1 }).lean(); // Use lean() for potentially better performance if not modifying docs
    response = NextResponse.json(customers);

  } catch (error: any) {
    console.error('GET Customers API error:', error);
    // Handle specific error types
    if (error.message.startsWith('Not authorized')) {
         response = NextResponse.json({ message: error.message }, { status: 401 });
    } else if (error.message.includes('Could not connect to database')) {
          response = NextResponse.json({ message: error.message }, { status: 503 }); // Service Unavailable
     } else if (error instanceof mongoose.Error) { // Catch other Mongoose errors during find
        console.error('Mongoose error fetching customers:', error);
        response = NextResponse.json({ message: 'Database error fetching customers.' }, { status: 500 });
     } else {
        // Generic error
        response = NextResponse.json({ message: 'Server error fetching customers', error: error.message || 'Unknown error' }, { status: 500 });
     }
  }
   return addCorsHeaders(response); // Add CORS headers to all responses
}

// POST (add) a new customer
export async function POST(req: NextRequest) {
   let userId;
   let response: NextResponse;
  try {
    // Authenticate and connect to DB
    userId = await getUserIdFromRequest(req); // Authenticate and get user ID
    await ensureDbConnection();

    const body = await req.json();
    const { name, phone, address, notes, trustScore, creditLimit } = body; // Added notes

    // --- Input Validation ---
    const validationErrors: string[] = [];
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
        validationErrors.push('Name is required');
    }
    if (!phone || typeof phone !== 'string' || phone.trim().length === 0) {
        validationErrors.push('Phone is required');
    }
    // Validate phone format (e.g., 10-digit number)
    if (phone && !/^[6-9]\d{9}$/.test(phone.replace(/\s+/g, ''))) {
        validationErrors.push('Please enter a valid 10-digit mobile number.');
    }

    const numTrustScore = trustScore !== undefined ? Number(trustScore) : 5; // Default
    if (isNaN(numTrustScore) || numTrustScore < 0 || numTrustScore > 10) {
       validationErrors.push('Trust Score must be a number between 0 and 10.');
    }
    const numCreditLimit = creditLimit !== undefined ? Number(creditLimit) : 0; // Default
    if (isNaN(numCreditLimit) || numCreditLimit < 0) {
        validationErrors.push('Credit Limit must be a non-negative number.');
    }
    if (notes && typeof notes !== 'string') {
        validationErrors.push('Notes must be a string.');
    }


     if (validationErrors.length > 0) {
       response = NextResponse.json({ message: validationErrors.join('. ') }, { status: 400 });
       return addCorsHeaders(response);
     }


    // --- Create and Save Customer ---
    const newCustomerData: Partial<ICustomer> = {
      name: name.trim(),
      phone: phone.replace(/\s+/g, ''), // Clean phone number
      address: address ? String(address).trim() : '',
      notes: notes ? String(notes).trim() : '', // Added notes
      trustScore: numTrustScore,
      creditLimit: numCreditLimit,
      shopkeeper: new mongoose.Types.ObjectId(userId), // Ensure shopkeeper is ObjectId
    };

    const newCustomer = new Customer(newCustomerData);
    const customer = await newCustomer.save(); // This triggers schema validation and pre-save hooks

    console.log(`New customer created: ${customer._id} for user ${userId}`);
    response = NextResponse.json(customer, { status: 201 });

  } catch (error: any) {
    console.error('POST Customer API error:', error);
     // Handle specific errors
     if (error.message.startsWith('Not authorized')) {
         response = NextResponse.json({ message: error.message }, { status: 401 });
     } else if (error.message.includes('Could not connect to database')) {
           response = NextResponse.json({ message: error.message }, { status: 503 }); // Service Unavailable
      } else if (error instanceof SyntaxError) { // JSON parsing error
         response = NextResponse.json({ message: 'Invalid request body format.' }, { status: 400 });
     } else if (error instanceof mongoose.Error.ValidationError) { // Mongoose validation error
        const messages = Object.values(error.errors).map((val: any) => val.message);
        console.warn(`Validation failed creating customer: ${messages.join('. ')}`);
        response = NextResponse.json({ message: messages.join('. ') }, { status: 400 });
     } else if (error.code === 11000) { // Duplicate key error (e.g., if compound index on shopkeeper/phone exists)
         console.warn(`Duplicate entry error creating customer: ${error.message}`);
         // Customize message based on what field caused the duplicate error if possible
         response = NextResponse.json({ message: 'This customer (e.g., phone number) might already exist for your account.' }, { status: 409 }); // 409 Conflict
     } else {
        // Generic error
        response = NextResponse.json({ message: 'Server error adding customer', error: error.message || 'Unknown error' }, { status: 500 });
     }
  }
   return addCorsHeaders(response); // Add CORS headers to all responses
}
