// src/app/api/repayments/route.ts
import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db';
import Repayment from '@/models/Repayment';
import Loan, { ILoan } from '@/models/Loan'; // Import ILoan
import { getUserIdFromRequest } from '@/lib/server-utils';
import { isBefore, parseISO, isValid } from 'date-fns'; // Import date-fns functions
import { adjustTrustScoreOnRepayment } from '@/lib/loans'; // Import trust score adjustment function

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
    // Allow requests from all origins in development.
    // In production, replace '*' with your specific frontend origin.
    const allowedOrigin = '*'; // Or dynamically get from req.headers.get('origin')
    response.headers.set('Access-Control-Allow-Origin', allowedOrigin);
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    response.headers.set('Access-Control-Allow-Credentials', 'true'); // Important if using credentials/cookies
    return response;
}

// Handle OPTIONS requests for CORS preflight
export async function OPTIONS(req: NextRequest) {
  const response = new NextResponse(null, { status: 204 });
  return addCorsHeaders(response);
}


// POST (Record) a new repayment
export async function POST(req: NextRequest) {
    let userId;
    let response: NextResponse;

    try {
        // Authenticate and connect to DB
        userId = await getUserIdFromRequest(req);
        await ensureDbConnection();
        const shopkeeperObjectId = new mongoose.Types.ObjectId(userId);

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
             response = NextResponse.json({ message: validationErrors.join('. ') }, { status: 400 });
             return addCorsHeaders(response);
        }


        // --- Core Logic ---
        // Fetch the loan
        const loan = await Loan.findOne({ _id: loanObjectId, shopkeeper: shopkeeperObjectId });

        if (!loan) {
            response = NextResponse.json({ message: 'Loan not found or not authorized' }, { status: 404 }); // 404 or 403
            return addCorsHeaders(response);
        }

        // Check if already paid (using tolerance)
        const tolerance = 0.001;
        if (loan.balance <= tolerance) {
            response = NextResponse.json({ message: 'Loan is already fully paid' }, { status: 400 });
            return addCorsHeaders(response);
        }

        // Check repayment amount against balance (using tolerance)
        if (repaymentAmount > loan.balance + tolerance) {
             console.warn(`Repayment amount ${repaymentAmount} exceeds balance ${loan.balance} for loan ${loanId}`);
             response = NextResponse.json({ message: `Repayment amount (₹${repaymentAmount.toFixed(2)}) exceeds balance (₹${loan.balance.toFixed(2)})` }, { status: 400 });
             return addCorsHeaders(response);
        }

         // Check if repayment date is before loan issue date
         if (isBefore(parsedDate, loan.issueDate)) {
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
        const savedRepayment = await newRepayment.save();

        // Update Loan Balance and Repayment Array
        loan.balance = parseFloat((loan.balance - repaymentAmount).toFixed(2));
        // Ensure balance doesn't go below zero due to floating point issues
        if (loan.balance < 0) {
            loan.balance = 0;
        }
        loan.repayments.push(savedRepayment._id);
        loan.status = loan.calculateStatus(); // Recalculate status

        await loan.save();

        console.log(`Repayment ${savedRepayment._id} recorded for loan ${loanId} by user ${userId}.`);

        // --- Adjust Trust Score (call the utility function) ---
        // We call this *after* the loan balance/status is updated.
        // Run this asynchronously and don't block the response for it.
        adjustTrustScoreOnRepayment(loan._id).catch(err => {
            console.error(`Error during async trust score adjustment for loan ${loan._id}:`, err);
            // Log the error, but don't fail the repayment response
        });


        // Populate and return the new repayment
        const populatedRepayment = await Repayment.findById(savedRepayment._id)
            .populate('loan', 'description amount balance status')
            .populate('customer', 'name')
            .lean();

        response = NextResponse.json(populatedRepayment, { status: 201 });
        return addCorsHeaders(response);

    } catch (error: any) {
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
            // Provide a more specific message if possible
            if (error.message.includes('Repayment date cannot be before')) {
                 response = NextResponse.json({ message: error.message }, { status: 400 });
            } else {
                 response = NextResponse.json({ message: 'Database error processing repayment.' }, { status: 500 });
            }
         } else {
            // Generic error
            response = NextResponse.json({ message: 'Server error recording repayment', error: error.message || 'Unknown error' }, { status: 500 });
         }
         return addCorsHeaders(response);
    }
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
