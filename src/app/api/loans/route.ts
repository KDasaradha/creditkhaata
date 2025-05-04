// src/app/api/loans/route.ts
import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Loan, { ILoan } from '@/models/Loan'; // Import ILoan
import Customer from '@/models/Customer';
import { getUserIdFromRequest } from '@/lib/server-utils';
import { startOfDay, isAfter, parseISO, isValid } from 'date-fns'; // Use date-fns
import mongoose from 'mongoose';
import { processOverdueLoansAndInterest } from '@/lib/loans'; // Import processing function

// Helper function to handle database connection errors
async function ensureDbConnection() {
    try {
        await connectDB();
    } catch (dbError: any) {
        console.error('Database connection failed in /api/loans:', dbError);
        throw new Error('Server error: Could not connect to database.'); // Throw specific error
    }
}

// Helper to add CORS headers
function addCorsHeaders(response: NextResponse): NextResponse {
    // Allow requests from all origins in development.
    // In production, replace '*' with your specific frontend origin.
    const allowedOrigin = '*'; // Or dynamically get from req.headers.get('origin')
    response.headers.set('Access-Control-Allow-Origin', allowedOrigin);
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS'); // Add PUT, DELETE if needed on this route
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    response.headers.set('Access-Control-Allow-Credentials', 'true'); // Important if using credentials/cookies
    return response;
}

// Handle OPTIONS requests for CORS preflight
export async function OPTIONS(req: NextRequest) {
  const response = new NextResponse(null, { status: 204 });
  return addCorsHeaders(response);
}


// GET all loans for the logged-in shopkeeper
export async function GET(req: NextRequest) {
  let userId;
  let response: NextResponse;
  try {
     // Authenticate and connect to DB
    userId = await getUserIdFromRequest(req);
    await ensureDbConnection();
    const shopkeeperObjectId = new mongoose.Types.ObjectId(userId);

    // --- Process Overdue Loans and Interest First ---
     // Ensures statuses and balances are up-to-date before fetching
     console.log(`GET /api/loans: Triggering overdue processing for user ${userId}...`);
     try {
         await processOverdueLoansAndInterest(shopkeeperObjectId);
     } catch (processingError: any) {
         console.error(`Error during pre-fetch overdue processing for user ${userId}:`, processingError);
         // Decide if this is fatal or just a warning. For now, log and continue.
     }
     console.log(`GET /api/loans: Overdue processing complete for user ${userId}. Fetching loans...`);


    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const customerId = searchParams.get('customerId');
    const category = searchParams.get('category'); // Added category filter

    // Build filter object
    const filter: mongoose.FilterQuery<ILoan> = { shopkeeper: shopkeeperObjectId };
    if (status && ['pending', 'paid', 'overdue'].includes(status)) {
        filter.status = status;
    }
    if (customerId) {
        if (!mongoose.Types.ObjectId.isValid(customerId)) {
             response = NextResponse.json({ message: 'Invalid customer ID format in query parameter.' }, { status: 400 });
             return addCorsHeaders(response);
        }
        filter.customer = customerId;
    }
     if (category) { // Added category filter logic
         filter.category = category; // Case-sensitive match, use $regex for case-insensitive if needed
     }


    // Fetch loans based on filter
    const loans = await Loan.find(filter)
                            .populate('customer', 'name phone') // Populate specific customer fields
                            .sort({ dueDate: 1 }) // Sort by due date ascending
                            .lean(); // Use lean for potentially better performance

    response = NextResponse.json(loans);

  } catch (error: any) {
    console.error('GET Loans API error:', error);
     // Handle specific errors
     if (error.message.startsWith('Not authorized')) {
         response = NextResponse.json({ message: error.message }, { status: 401 });
     } else if (error.message.includes('Could not connect to database')) {
          response = NextResponse.json({ message: error.message }, { status: 503 }); // Service Unavailable
      } else if (error instanceof mongoose.Error) { // Catch other Mongoose errors during find/populate
        console.error('Mongoose error fetching loans:', error);
        response = NextResponse.json({ message: 'Database error fetching loans.' }, { status: 500 });
     } else {
        // Generic error
        response = NextResponse.json({ message: 'Server error fetching loans', error: error.message || 'Unknown error' }, { status: 500 });
     }
  }
  return addCorsHeaders(response);
}

// POST (create) a new loan
export async function POST(req: NextRequest) {
  let userId;
  let response: NextResponse;
  try {
     // Authenticate and connect to DB
    userId = await getUserIdFromRequest(req);
    await ensureDbConnection();
    const shopkeeperObjectId = new mongoose.Types.ObjectId(userId);

    const body = await req.json();
    const {
        customerId,
        description,
        amount,
        category, // Added category
        issueDate, // Expect ISO string or parsable date format
        dueDate,   // Expect ISO string or parsable date format
        frequency = 'monthly', // Default if not provided
        interestRate = 0,
        graceDays = 0
    } = body;

    // --- Input Validation ---
    const validationErrors: string[] = [];

    if (!customerId || !mongoose.Types.ObjectId.isValid(customerId)) {
        validationErrors.push('Valid Customer ID is required');
    }
    if (!description || typeof description !== 'string' || description.trim().length === 0) {
        validationErrors.push('Description is required');
    }
    if (category && typeof category !== 'string') { // Added category validation
        validationErrors.push('Category must be a string.');
    }


    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
        validationErrors.push('Amount must be a positive number');
    }

    const parsedIssueDate = issueDate ? parseISO(issueDate) : new Date(); // Default to now if not provided
    const parsedDueDate = dueDate ? parseISO(dueDate) : null;

    if (!isValid(parsedIssueDate)) {
        validationErrors.push('Invalid issue date format. Please use ISO 8601 format.');
    }
    if (!parsedDueDate || !isValid(parsedDueDate)) {
         validationErrors.push('Due date is required and must be in ISO 8601 format.');
    } else if (isValid(parsedIssueDate) && isAfter(startOfDay(parsedIssueDate), startOfDay(parsedDueDate))) {
         // Check order only if both dates are valid, comparing start of day
         validationErrors.push('Due date must be on or after the issue date');
    }

     if (!['one-time', 'bi-weekly', 'monthly'].includes(frequency)) {
         validationErrors.push('Invalid frequency value.');
     }

    const numInterest = Number(interestRate);
     if (isNaN(numInterest) || numInterest < 0) {
        validationErrors.push('Interest rate must be a non-negative number');
    }
    const numGraceDays = Number(graceDays);
    if (!Number.isInteger(numGraceDays) || numGraceDays < 0) {
        validationErrors.push('Grace days must be a non-negative integer');
    }

    if (validationErrors.length > 0) {
        response = NextResponse.json({ message: validationErrors.join('. ') }, { status: 400 });
         return addCorsHeaders(response);
    }


     // Verify customer exists and belongs to the shopkeeper
    const customer = await Customer.findOne({ _id: customerId, shopkeeper: shopkeeperObjectId });
    if (!customer) {
        response = NextResponse.json({ message: 'Customer not found or does not belong to this shopkeeper.' }, { status: 404 }); // 404 Not Found or 403 Forbidden
        return addCorsHeaders(response);
    }

     // Optional: Credit Limit Check (Implement more robustly if needed)
     // const existingDebt = await Loan.aggregate([...]); // Calculate current debt for the customer
     // if (customer.creditLimit > 0 && (existingDebt + numAmount) > customer.creditLimit) {
     //     return NextResponse.json({ message: `Adding this loan exceeds the customer's credit limit of ${formatCurrency(customer.creditLimit)}.` }, { status: 400 });
     // }

    // --- Create and Save Loan ---
    const newLoanData: Partial<ILoan> = {
        shopkeeper: shopkeeperObjectId,
        customer: new mongoose.Types.ObjectId(customerId),
        description: description.trim(),
        amount: numAmount,
        balance: numAmount, // Set the initial balance to the loan amount
        category: category ? category.trim() : undefined, // Added category
        issueDate: parsedIssueDate,
        dueDate: parsedDueDate!, // We've validated it's not null above
        frequency,
        interestRate: numInterest,
        graceDays: numGraceDays,
        lastInterestCalculationDate: parsedIssueDate, // Initialize interest calc date
        // status is set by pre-save middleware
    };

    const newLoan = new Loan(newLoanData);
    const savedLoan = await newLoan.save();

    // Populate customer details for the response
    // Use findById again to ensure population works correctly after save
    const populatedLoan = await Loan.findById(savedLoan._id)
                                      .populate('customer', 'name phone')
                                      .lean();

     console.log(`New loan ${savedLoan._id} created for customer ${customerId} by user ${userId}.`);
    response = NextResponse.json(populatedLoan, { status: 201 });

  } catch (error: any) {
    console.error('POST Loan API error:', error);
      // Handle specific errors
     if (error.message.startsWith('Not authorized')) {
         response = NextResponse.json({ message: error.message }, { status: 401 });
     } else if (error.message.includes('Could not connect to database')) {
          response = NextResponse.json({ message: error.message }, { status: 503 }); // Service Unavailable
      } else if (error instanceof SyntaxError) { // JSON parsing error
         response = NextResponse.json({ message: 'Invalid request body format.' }, { status: 400 });
     } else if (error instanceof mongoose.Error.ValidationError) { // Mongoose validation error during save
         const messages = Object.values(error.errors).map((val: any) => val.message);
         console.warn(`Validation failed creating loan: ${messages.join('. ')}`);
         response = NextResponse.json({ message: messages.join('. ') }, { status: 400 });
     } else if (error instanceof mongoose.Error.CastError) { // Invalid data type (e.g., ObjectId)
          response = NextResponse.json({ message: `Invalid data type provided for field ${error.path}. Expected ${error.kind}.` }, { status: 400 });
     } else if (error instanceof mongoose.Error) { // Catch other Mongoose errors during find/save
        console.error('Mongoose error creating loan:', error);
        response = NextResponse.json({ message: 'Database error creating loan.' }, { status: 500 });
     } else {
        // Generic error
        response = NextResponse.json({ message: 'Server error creating loan', error: error.message || 'Unknown error' }, { status: 500 });
     }
  }
   return addCorsHeaders(response);
}
