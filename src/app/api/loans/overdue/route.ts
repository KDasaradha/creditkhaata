// src/app/api/loans/overdue/route.ts
import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Loan from '@/models/Loan';
import { getUserIdFromRequest } from '@/lib/server-utils';
import { startOfDay, addDays } from 'date-fns'; // Import addDays
import mongoose from 'mongoose';

// Helper function to handle database connection errors
async function ensureDbConnection() {
    try {
        await connectDB();
    } catch (dbError: any) {
        console.error('Database connection failed in /api/loans/overdue:', dbError);
        throw new Error('Server error: Could not connect to database.'); // Throw specific error
    }
}

// GET overdue loans for the logged-in shopkeeper
export async function GET(req: NextRequest) {
    let userId;
    try {
        // Authenticate and connect to DB
        userId = await getUserIdFromRequest(req);
        await ensureDbConnection();
        const shopkeeperObjectId = new mongoose.Types.ObjectId(userId); // Ensure correct type for matching

        // --- Update statuses before querying ---
        // Ensure the 'overdue' status is current based on today's date.
        // This operation should ideally be atomic and efficient.
        const todayStart = startOfDay(new Date());
        try {
            await Loan.updateMany(
                // Filter: Target loans belonging to the shopkeeper that are currently 'pending' and have a balance > 0
                {
                    shopkeeper: shopkeeperObjectId,
                    status: 'pending', // Only transition from pending to overdue here
                    balance: { $gt: 0 },
                    // Check if today is strictly after the effective due date (dueDate + graceDays)
                    // We need to compare todayStart against the calculated effective due date.
                    // MongoDB $expr allows using aggregation expressions in queries.
                     $expr: {
                         $gt: [
                             todayStart,
                             { $add: [ "$dueDate", { $multiply: [ "$graceDays", 24*60*60*1000 ] } ] }
                         ]
                     }
                },
                 // Update: Set status to 'overdue' for matched documents
                { $set: { status: "overdue", updatedAt: new Date() } } // Also update 'updatedAt' timestamp
            );
             console.log(`Checked and updated overdue status for user ${userId}.`);
        } catch (updateError: any) {
             console.error(`Error updating overdue status for user ${userId}:`, updateError);
             // Decide if this error is critical. Maybe log and proceed to fetch?
             // Or return an error if status update is crucial for the result.
             return NextResponse.json({ message: 'Server error updating loan statuses.' }, { status: 500 });
        }


        // Now query for loans explicitly marked as 'overdue'
        const overdueLoans = await Loan.find({ shopkeeper: shopkeeperObjectId, status: 'overdue' })
                                    .populate('customer', 'name phone') // Populate relevant customer details
                                    .sort({ dueDate: 1 }) // Sort by oldest due date first
                                    .lean(); // Use lean if not modifying

        return NextResponse.json(overdueLoans);

    } catch (error: any) {
        console.error('GET Overdue Loans API error:', error);
         // Handle specific errors
        if (error.message.startsWith('Not authorized')) {
            return NextResponse.json({ message: error.message }, { status: 401 });
        }
         if (error.message.includes('Could not connect to database')) {
             return NextResponse.json({ message: error.message }, { status: 503 }); // Service Unavailable
         }
         if (error instanceof mongoose.Error) { // Catch other Mongoose errors during find/populate
            console.error('Mongoose error fetching overdue loans:', error);
            return NextResponse.json({ message: 'Database error fetching overdue loans.' }, { status: 500 });
         }
        // Generic error
        return NextResponse.json({ message: 'Server error fetching overdue loans', error: error.message || 'Unknown error' }, { status: 500 });
    }
}

    