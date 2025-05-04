// src/app/api/repayments/route.ts
import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose'; // Remove ClientSession import
import connectDB from '@/lib/db';
import Repayment from '@/models/Repayment';
import Loan, { ILoan } from '@/models/Loan'; // Import ILoan
import { getUserIdFromRequest } from '@/lib/server-utils';
import { isBefore, parseISO, isValid } from 'date-fns'; // Import date-fns functions

// Helper function to handle database connection errors
async function ensureDbConnection() {
    try {
        await connectDB();
    } catch (dbError: any) {
        console.error('Database connection failed in /api/repayments:', dbError);
        throw new Error('Server error: Could not connect to database.'); // Throw specific error
    }
}

// Helper to add CORS headers
function addCorsHeaders(response: NextResponse): NextResponse {
    response.headers.set('Access-Control-Allow-Origin', '*'); // Adjust for production
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    return response;
}

// Handle OPTIONS requests for CORS preflight
export async function OPTIONS(req: NextRequest) {
  const response = new NextResponse(null, { status: 204 });
  return addCorsHeaders(response);
}


// POST (Record) a new repayment
export async function POST(req: NextRequest) {
    // Remove session initialization: let session: ClientSession | null = null;
    let userId;
    let response: NextResponse;

    try {
        // Authenticate and connect to DB
        userId = await getUserIdFromRequest(req);
        await ensureDbConnection();
        const shopkeeperObjectId = new mongoose.Types.ObjectId(userId);

        // Remove transaction start: session = await mongoose.startSession(); session.startTransaction();

        const body = await req.json();
        const { loanId, amount, date } = body;

        // --- Validation ---
        const validationErrors: string[] = [];
        let loanObjectId: mongoose.Types.ObjectId | null = null;

        if (!loanId || !mongoose.Types.ObjectId.isValid(loanId)) {
            validationErrors.push('Valid Loan ID is required');
        } else {
            loanObjectId = new mongoose.Types.ObjectId(loanId);
        }

        const repaymentAmount = Number(amount);
        if (isNaN(repaymentAmount) || repaymentAmount <= 0) {
            validationErrors.push('Repayment amount must be a positive number');
        }

        const parsedDate = date ? parseISO(date) : new Date(); // Default to now if not provided
        if (!isValid(parsedDate)) {
             validationErrors.push('Invalid repayment date format. Please use ISO 8601 format.');
        }

        if (validationErrors.length > 0) {
             // Remove transaction abort: await session.abortTransaction(); session.endSession();
             response = NextResponse.json({ message: validationErrors.join('. ') }, { status: 400 });
             return addCorsHeaders(response);
        }


        // --- Core Logic (without transaction) ---
        // Fetch the loan
        // Remove .session(session)
        const loan = await Loan.findOne({ _id: loanObjectId, shopkeeper: shopkeeperObjectId });

        if (!loan) {
            // Remove transaction abort: await session.abortTransaction(); session.endSession();
            response = NextResponse.json({ message: 'Loan not found or not authorized' }, { status: 404 }); // 404 or 403
            return addCorsHeaders(response);
        }

        // Check if already paid
        if (loan.balance <= 0) {
            // Remove transaction abort: await session.abortTransaction(); session.endSession();
            response = NextResponse.json({ message: 'Loan is already fully paid' }, { status: 400 });
            return addCorsHeaders(response);
        }

        // Check repayment amount against balance
        const tolerance = 0.001; // Example tolerance
        if (repaymentAmount > loan.balance + tolerance) {
             // Remove transaction abort: await session.abortTransaction(); session.endSession();
             console.warn(`Repayment amount ${repaymentAmount} exceeds balance ${loan.balance} for loan ${loanId}`);
             response = NextResponse.json({ message: `Repayment amount (₹${repaymentAmount.toFixed(2)}) exceeds balance (₹${loan.balance.toFixed(2)})` }, { status: 400 });
             return addCorsHeaders(response);
        }

         // Check if repayment date is before loan issue date
         if (isBefore(parsedDate, loan.issueDate)) {
             // Remove transaction abort: await session.abortTransaction(); session.endSession();
             response = NextResponse.json({ message: 'Repayment date cannot be before the loan issue date' }, { status: 400 });
             return addCorsHeaders(response);
         }

        // --- Perform Operations (Sequentially, No Transaction Guarantee) ---
        // Create Repayment
        const newRepayment = new Repayment({
            shopkeeper: shopkeeperObjectId,
            customer: loan.customer,
            loan: loanObjectId,
            amount: repaymentAmount,
            date: parsedDate,
        });
        // Remove { session }
        const savedRepayment = await newRepayment.save();

        // Update Loan Balance and Repayment Array
        loan.balance = parseFloat((loan.balance - repaymentAmount).toFixed(2));
        loan.repayments.push(savedRepayment._id);
        loan.status = loan.calculateStatus(); // Recalculate status

        // Remove { session }
        // Note: If this fails after saving the repayment, the data will be inconsistent.
        await loan.save();

        // Remove transaction commit: await session.commitTransaction();
        console.log(`Repayment ${savedRepayment._id} recorded for loan ${loanId} by user ${userId}. (No Transaction)`);

        // Populate and return the new repayment
        const populatedRepayment = await Repayment.findById(savedRepayment._id)
            .populate('loan', 'description amount balance status')
            .populate('customer', 'name')
            .lean();

        response = NextResponse.json(populatedRepayment, { status: 201 });
        return addCorsHeaders(response);

    } catch (error: any) {
        // Remove transaction abort logic
        // if (session) { try { await session.abortTransaction(); } catch (abortError) { ... } finally { session.endSession(); } }

        console.error('POST Repayment API error:', error);

        // Handle specific errors
        if (error.message.startsWith('Not authorized')) {
            response = NextResponse.json({ message: error.message }, { status: 401 });
        } else if (error.message.includes('Could not connect to database')) {
             response = NextResponse.json({ message: error.message }, { status: 503 }); // Service Unavailable
         } else if (error instanceof SyntaxError) { // JSON parsing error
            response = NextResponse.json({ message: 'Invalid request body format.' }, { status: 400 });
        } else if (error instanceof mongoose.Error.ValidationError) { // Mongoose validation error
            const messages = Object.values(error.errors).map((val: any) => val.message);
            console.warn(`Validation failed recording repayment: ${messages.join('. ')}`);
            response = NextResponse.json({ message: messages.join('. ') }, { status: 400 });
        } else if (error instanceof mongoose.Error) { // Catch other Mongoose errors
            console.error('Mongoose error during repayment operation:', error);
            response = NextResponse.json({ message: 'Database error processing repayment.' }, { status: 500 });
         } else {
            // Generic error
            response = NextResponse.json({ message: 'Server error recording repayment', error: error.message || 'Unknown error' }, { status: 500 });
         }
         return addCorsHeaders(response);
    }
    // Remove final session end: finally { if (session) { session.endSession(); } }
}

// GET all repayments for the logged-in shopkeeper
export async function GET(req: NextRequest) {
    let userId;
    let response: NextResponse;
    try {
        // Authenticate and connect to DB
        userId = await getUserIdFromRequest(req);
        await ensureDbConnection();
        const shopkeeperObjectId = new mongoose.Types.ObjectId(userId);

        // Fetch all repayments for the user
        const repayments = await Repayment.find({ shopkeeper: shopkeeperObjectId })
                                          .populate('loan', 'description') // Add loan description
                                          .populate('customer', 'name')   // Add customer name
                                          .sort({ date: -1 }) // Most recent first
                                          .lean(); // Use lean if not modifying

        response = NextResponse.json(repayments);
        return addCorsHeaders(response);

    } catch (error: any) {
        console.error('GET All Repayments API error:', error);
         // Handle specific errors
        if (error.message.startsWith('Not authorized')) {
            response = NextResponse.json({ message: error.message }, { status: 401 });
        } else if (error.message.includes('Could not connect to database')) {
            response = NextResponse.json({ message: error.message }, { status: 503 }); // Service Unavailable
        } else if (error instanceof mongoose.Error) { // Catch other Mongoose errors during find/populate
            console.error('Mongoose error fetching all repayments:', error);
            response = NextResponse.json({ message: 'Database error fetching repayments.' }, { status: 500 });
         } else {
            // Generic error
            response = NextResponse.json({ message: 'Server error fetching repayments', error: error.message || 'Unknown error' }, { status: 500 });
         }
        return addCorsHeaders(response);
    }
}
