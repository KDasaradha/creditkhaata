// src/app/api/loans/overdue/route.ts
import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Loan, { ILoan } from '@/models/Loan';
import { getUserIdFromRequest } from '@/lib/server-utils';
import { startOfDay, addDays, parseISO, isValid } from 'date-fns'; // Import addDays, parseISO, isValid
import mongoose from 'mongoose';
import { processOverdueLoansAndInterest } from '@/lib/loans'; // Import processing function

// Helper function to handle database connection errors
async function ensureDbConnection() {
    try {
        await connectDB();
    } catch (dbError: any) {
        console.error('Database connection failed in /api/loans/overdue:', dbError);
        throw new Error('Server error: Could not connect to database.'); // Throw specific error
    }
}

// Helper to add CORS headers
function addCorsHeaders(response: NextResponse): NextResponse {
    // Allow requests from all origins in development.
    // In production, replace '*' with your specific frontend origin.
    const allowedOrigin = '*'; // Or dynamically get from req.headers.get('origin')
    response.headers.set('Access-Control-Allow-Origin', allowedOrigin);
    response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    response.headers.set('Access-Control-Allow-Credentials', 'true'); // Important if using credentials/cookies
    return response;
}

// Handle OPTIONS requests for CORS preflight
export async function OPTIONS(req: NextRequest) {
  const response = new NextResponse(null, { status: 204 });
  return addCorsHeaders(response);
}

// GET overdue loans for the logged-in shopkeeper
export async function GET(req: NextRequest) {
    let userId;
    let response: NextResponse;
    try {
        // Authenticate and connect to DB
        userId = await getUserIdFromRequest(req);
        await ensureDbConnection();
        const shopkeeperObjectId = new mongoose.Types.ObjectId(userId); // Ensure correct type for matching

        // --- Process Overdue Loans and Interest First ---
        // Ensures statuses and balances are up-to-date before fetching overdue loans
        console.log(`GET /api/loans/overdue: Triggering overdue processing for user ${userId}...`);
        try {
            await processOverdueLoansAndInterest(shopkeeperObjectId);
        } catch (processingError: any) {
            console.error(`Error during pre-fetch overdue processing for user ${userId}:`, processingError);
            // Decide if this is fatal or just a warning. For now, log and continue.
        }
         console.log(`GET /api/loans/overdue: Overdue processing complete for user ${userId}. Fetching overdue loans...`);


        const { searchParams } = new URL(req.url);
        const limitParam = searchParams.get('limit');
        const sortParam = searchParams.get('sort'); // e.g., 'dueDate' or '-dueDate'

        const limit = limitParam ? parseInt(limitParam, 10) : 0; // 0 means no limit
        let sort: mongoose.SortOrder | { [key: string]: mongoose.SortOrder } = { dueDate: 1 }; // Default sort: oldest due first

        if (sortParam) {
            if (sortParam.startsWith('-')) {
                sort = { [sortParam.substring(1)]: -1 };
            } else {
                sort = { [sortParam]: 1 };
            }
            // Validate sort field if needed (e.g., only allow 'dueDate', 'balance')
             const allowedSortFields = ['dueDate', 'balance', 'description']; // Example allowed fields
             if (!allowedSortFields.includes(Object.keys(sort)[0])) {
                 sort = { dueDate: 1 }; // Reset to default if invalid sort field
                 console.warn(`Invalid sort parameter '${sortParam}', defaulting to 'dueDate'.`);
             }
        }


        // Now query for loans explicitly marked as 'overdue' after processing
        const query = Loan.find({ shopkeeper: shopkeeperObjectId, status: 'overdue' })
                            .populate<{ customer: { _id: mongoose.Types.ObjectId, name: string } }>('customer', 'name') // Populate only customer name
                            .select('customer description balance dueDate') // Select fields needed for snippet
                            .sort(sort);

         if (limit > 0) {
             query.limit(limit);
         }

        const overdueLoans = await query.lean(); // Use lean for read-only

        response = NextResponse.json(overdueLoans);

    } catch (error: any) {
        console.error('GET Overdue Loans API error:', error);
         // Handle specific errors
        if (error.message.startsWith('Not authorized')) {
            response = NextResponse.json({ message: error.message }, { status: 401 });
        } else if (error.message.includes('Could not connect to database')) {
             response = NextResponse.json({ message: error.message }, { status: 503 }); // Service Unavailable
         } else if (error instanceof mongoose.Error) { // Catch other Mongoose errors during find/populate
            console.error('Mongoose error fetching overdue loans:', error);
            response = NextResponse.json({ message: 'Database error fetching overdue loans.' }, { status: 500 });
         } else {
            // Generic error
            response = NextResponse.json({ message: 'Server error fetching overdue loans', error: error.message || 'Unknown error' }, { status: 500 });
         }
    }
    return addCorsHeaders(response);
}
