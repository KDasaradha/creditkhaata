// src/app/api/repayments/route.ts
import { NextRequest, NextResponse } from 'next/server';
import mongoose, { ClientSession } from 'mongoose'; // Import ClientSession for transaction typing
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

// POST (Record) a new repayment
export async function POST(req: NextRequest) {
    let session: ClientSession | null = null; // Initialize session as null
    let userId;

    try {
        // Authenticate and connect to DB BEFORE starting transaction
        userId = await getUserIdFromRequest(req);
        await ensureDbConnection();
        const shopkeeperObjectId = new mongoose.Types.ObjectId(userId);

        // Start transaction
        session = await mongoose.startSession();
        session.startTransaction();

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
             await session.abortTransaction(); session.endSession(); // Abort and end session on validation fail
             return NextResponse.json({ message: validationErrors.join('. ') }, { status: 400 });
        }


        // --- Core Logic (within transaction) ---
        // Fetch the loan within the transaction session
        const loan = await Loan.findOne({ _id: loanObjectId, shopkeeper: shopkeeperObjectId }).session(session);

        if (!loan) {
            await session.abortTransaction(); session.endSession();
            return NextResponse.json({ message: 'Loan not found or not authorized' }, { status: 404 }); // 404 or 403
        }

        // Check if already paid
        if (loan.balance <= 0) {
            await session.abortTransaction(); session.endSession();
            return NextResponse.json({ message: 'Loan is already fully paid' }, { status: 400 });
        }

        // Check repayment amount against balance
        // Use a tolerance for floating point comparisons if necessary
        const tolerance = 0.001; // Example tolerance (0.1 cent)
        if (repaymentAmount > loan.balance + tolerance) {
             await session.abortTransaction(); session.endSession();
             console.warn(`Repayment amount ${repaymentAmount} exceeds balance ${loan.balance} for loan ${loanId}`);
             return NextResponse.json({ message: `Repayment amount (₹${repaymentAmount.toFixed(2)}) exceeds balance (₹${loan.balance.toFixed(2)})` }, { status: 400 });
        }

         // Check if repayment date is before loan issue date
         if (isBefore(parsedDate, loan.issueDate)) {
             await session.abortTransaction(); session.endSession();
             return NextResponse.json({ message: 'Repayment date cannot be before the loan issue date' }, { status: 400 });
         }

        // --- Perform Operations within Transaction ---
        // Create Repayment
        const newRepayment = new Repayment({
            shopkeeper: shopkeeperObjectId,
            customer: loan.customer, // Denormalized from loan
            loan: loanObjectId,
            amount: repaymentAmount,
            date: parsedDate,
        });
        const savedRepayment = await newRepayment.save({ session });

        // Update Loan Balance and Repayment Array
        // Be precise with floating point arithmetic
        loan.balance = parseFloat((loan.balance - repaymentAmount).toFixed(2)); // Update balance
        loan.repayments.push(savedRepayment._id); // Add repayment reference
        loan.status = loan.calculateStatus(); // Recalculate status using the instance method

        await loan.save({ session }); // Save the updated loan within the transaction

        // Commit Transaction
        await session.commitTransaction();
        console.log(`Repayment ${savedRepayment._id} recorded for loan ${loanId} by user ${userId}.`);

        // Populate and return the new repayment (outside transaction, after commit)
        const populatedRepayment = await Repayment.findById(savedRepayment._id)
            .populate('loan', 'description amount balance status') // Populate relevant loan fields
            .populate('customer', 'name') // Populate customer name
            .lean();

        return NextResponse.json(populatedRepayment, { status: 201 });

    } catch (error: any) {
        // Ensure transaction is aborted on any error
        if (session) {
            try {
                 await session.abortTransaction();
                 console.log('Transaction aborted due to error.');
            } catch (abortError) {
                 console.error('Error aborting transaction:', abortError);
            } finally {
                 session.endSession();
            }
        }

        console.error('POST Repayment API error:', error);

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
        if (error instanceof mongoose.Error.ValidationError) { // Mongoose validation error during save
            const messages = Object.values(error.errors).map((val: any) => val.message);
            console.warn(`Validation failed recording repayment: ${messages.join('. ')}`);
            return NextResponse.json({ message: messages.join('. ') }, { status: 400 });
        }
         if (error instanceof mongoose.Error) { // Catch other Mongoose errors during find/save/transaction
            console.error('Mongoose error during repayment operation:', error);
            return NextResponse.json({ message: 'Database error processing repayment.' }, { status: 500 });
         }
        // Generic error
        return NextResponse.json({ message: 'Server error recording repayment', error: error.message || 'Unknown error' }, { status: 500 });
    }
}

// GET all repayments for the logged-in shopkeeper
export async function GET(req: NextRequest) {
    let userId;
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

        return NextResponse.json(repayments);

    } catch (error: any) {
        console.error('GET All Repayments API error:', error);
         // Handle specific errors
        if (error.message.startsWith('Not authorized')) {
            return NextResponse.json({ message: error.message }, { status: 401 });
        }
        if (error.message.includes('Could not connect to database')) {
            return NextResponse.json({ message: error.message }, { status: 503 }); // Service Unavailable
        }
         if (error instanceof mongoose.Error) { // Catch other Mongoose errors during find/populate
            console.error('Mongoose error fetching all repayments:', error);
            return NextResponse.json({ message: 'Database error fetching repayments.' }, { status: 500 });
         }
        // Generic error
        return NextResponse.json({ message: 'Server error fetching repayments', error: error.message || 'Unknown error' }, { status: 500 });
    }
}

    