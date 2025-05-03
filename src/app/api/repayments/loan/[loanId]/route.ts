// src/app/api/repayments/loan/[loanId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db';
import Repayment from '@/models/Repayment';
import Loan from '@/models/Loan';
import { getUserIdFromRequest } from '@/lib/server-utils';

interface Params {
    params: { loanId: string };
}

// Helper function to handle database connection errors
async function ensureDbConnection() {
    try {
        await connectDB();
    } catch (dbError: any) {
        console.error('Database connection failed in /api/repayments/loan/[loanId]:', dbError);
        throw new Error('Server error: Could not connect to database.'); // Throw specific error
    }
}

// GET all repayments for a specific loan
export async function GET(req: NextRequest, { params }: Params) {
    let userId;
    try {
        // Authenticate and connect to DB
        userId = await getUserIdFromRequest(req);
        await ensureDbConnection();
        const shopkeeperObjectId = new mongoose.Types.ObjectId(userId);
        const { loanId } = params;

        if (!mongoose.Types.ObjectId.isValid(loanId)) {
            return NextResponse.json({ message: 'Invalid loan ID format' }, { status: 400 });
        }
        const loanObjectId = new mongoose.Types.ObjectId(loanId);

        // Verify the loan exists and belongs to the user (optional but good practice)
        const loan = await Loan.findOne({ _id: loanObjectId, shopkeeper: shopkeeperObjectId }).select('_id'); // Select only _id for existence check
        if (!loan) {
           console.warn(`Attempt to fetch repayments for non-existent or unauthorized loan ${loanId} by user ${userId}`);
           return NextResponse.json({ message: 'Loan not found or not authorized' }, { status: 404 }); // Use 404 or 403
        }

        // Find repayments for this specific loan, sorted by date
        const repayments = await Repayment.find({ loan: loanObjectId, shopkeeper: shopkeeperObjectId })
                                          .sort({ date: -1 }) // Most recent first
                                          .lean(); // Use lean if not modifying

        return NextResponse.json(repayments);

    } catch (error: any) {
        console.error(`GET Repayments for Loan ${params?.loanId || 'invalid ID'} API error:`, error);
         // Handle specific errors
        if (error.message.startsWith('Not authorized')) {
            return NextResponse.json({ message: error.message }, { status: 401 });
        }
        if (error.message.includes('Could not connect to database')) {
            return NextResponse.json({ message: error.message }, { status: 503 }); // Service Unavailable
        }
        if (error instanceof mongoose.Error.CastError) {
            // Handle cases where loanId might be invalid format in findOne or find queries
            return NextResponse.json({ message: `Invalid ID format for ${error.path}.` }, { status: 400 });
        }
        if (error instanceof mongoose.Error) { // Catch other Mongoose errors
            console.error('Mongoose error fetching repayments by loan:', error);
            return NextResponse.json({ message: 'Database error fetching loan repayments.' }, { status: 500 });
        }
        // Generic error
        return NextResponse.json({ message: 'Server error fetching loan repayments', error: error.message || 'Unknown error' }, { status: 500 });
    }
}

    