// src/app/api/summary/route.ts
import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db';
import Loan from '@/models/Loan';
import Repayment from '@/models/Repayment';
import Customer from '@/models/Customer'; // Import Customer model
import { getUserIdFromRequest } from '@/lib/server-utils';
import { differenceInDays, startOfDay, isValid } from 'date-fns'; // Import isValid

// Helper function to handle database connection errors
async function ensureDbConnection() {
    try {
        await connectDB();
    } catch (dbError: any) {
        console.error('Database connection failed in /api/summary:', dbError);
        throw new Error('Server error: Could not connect to database.'); // Throw specific error
    }
}


export async function GET(req: NextRequest) {
    let userId;
    try {
        // Authenticate and connect to DB
        userId = await getUserIdFromRequest(req);
        const shopkeeperObjectId = new mongoose.Types.ObjectId(userId); // Ensure it's an ObjectId for matching
        await ensureDbConnection();

        // --- Update Loan Statuses First ---
        // Ensure overdue and paid statuses are correct before aggregation
        const todayStart = startOfDay(new Date());
        try {
             // Update pending to overdue
             await Loan.updateMany(
                 {
                     shopkeeper: shopkeeperObjectId,
                     status: 'pending',
                     balance: { $gt: 0 },
                     $expr: { $gt: [ todayStart, { $add: [ "$dueDate", { $multiply: [ "$graceDays", 24*60*60*1000 ] } ] } ] }
                 },
                 { $set: { status: "overdue", updatedAt: new Date() } }
             );
             // Update pending/overdue to paid if balance <= 0
             await Loan.updateMany(
                 {
                     shopkeeper: shopkeeperObjectId,
                     status: { $in: ['pending', 'overdue'] },
                     balance: { $lte: 0 }
                 },
                 { $set: { status: "paid", updatedAt: new Date() } }
             );
              console.log(`Checked and updated loan statuses before summary for user ${userId}.`);
         } catch (updateError: any) {
             console.error(`Error updating loan statuses before summary for user ${userId}:`, updateError);
             // Log and continue, summary might be slightly stale if updates fail.
         }


        // --- Perform Aggregations Concurrently ---
        // Use Promise.all for efficiency
        const [
            totalLoanedResult,
            totalCollectedResult,
            totalOutstandingResult,
            totalOverdueResult,
            paidLoansForAvgCalc, // Fetch necessary data for avg repayment time calc
            totalCustomersCount, // Count total customers
            activeLoanCount // Count active loans
        ] = await Promise.all([
            // 1. Total Loaned Amount
            Loan.aggregate([
                { $match: { shopkeeper: shopkeeperObjectId } },
                { $group: { _id: null, totalLoaned: { $sum: "$amount" } } }
            ]),
            // 2. Total Collected Amount (Sum of all repayments)
            Repayment.aggregate([
                { $match: { shopkeeper: shopkeeperObjectId } },
                { $group: { _id: null, totalCollected: { $sum: "$amount" } } }
            ]),
             // 3. Total Outstanding Balance (Sum of balance for non-paid loans)
            Loan.aggregate([
                // Match loans that are 'pending' or 'overdue'
                { $match: { shopkeeper: shopkeeperObjectId, status: { $in: ['pending', 'overdue'] } } },
                { $group: { _id: null, totalOutstanding: { $sum: "$balance" } } }
            ]),
            // 4. Total Overdue Amount & Count (Sum balance of 'overdue' loans)
            Loan.aggregate([
                { $match: { shopkeeper: shopkeeperObjectId, status: 'overdue' } },
                { $group: {
                    _id: null,
                    totalOverdueAmount: { $sum: "$balance" },
                    overdueLoanCount: { $sum: 1 } // Count documents matching 'overdue'
                }}
            ]),
            // 5. Data for Average Repayment Time (Fetch paid loans with details)
             Loan.find({ shopkeeper: shopkeeperObjectId, status: 'paid' })
                 .select('issueDate repayments amount dueDate') // Select fields needed for calc
                 .populate({ // Populate repayment dates, sorted descending
                     path: 'repayments',
                     select: 'date',
                     options: { sort: { 'date': -1 } }
                 })
                 .lean(), // Use lean for efficiency
             // 6. Total Customers Count
             Customer.countDocuments({ shopkeeper: shopkeeperObjectId }),
             // 7. Active Loan Count (Pending or Overdue)
             Loan.countDocuments({ shopkeeper: shopkeeperObjectId, status: { $in: ['pending', 'overdue'] } })
        ]);

        // --- Process Aggregation Results (Provide defaults) ---
        const totalLoaned = totalLoanedResult?.[0]?.totalLoaned ?? 0;
        const totalCollected = totalCollectedResult?.[0]?.totalCollected ?? 0;
        const totalOutstanding = totalOutstandingResult?.[0]?.totalOutstanding ?? 0;
        const totalOverdueAmount = totalOverdueResult?.[0]?.totalOverdueAmount ?? 0;
        const overdueLoanCount = totalOverdueResult?.[0]?.overdueLoanCount ?? 0;

        // --- Calculate Average Repayment Time ---
        let totalRepaymentDays = 0;
        let paidLoanCountWithRepayments = 0;

        // Ensure paidLoansForAvgCalc is an array before iterating
        if (Array.isArray(paidLoansForAvgCalc)) {
            paidLoansForAvgCalc.forEach((loan: any) => { // Using 'any' temporarily, define an interface if preferred
                // Check if issueDate is valid and repayments exist
                const issueDate = loan.issueDate instanceof Date ? loan.issueDate : parseISO(loan.issueDate);
                if (!isValid(issueDate) || !loan.repayments || loan.repayments.length === 0) {
                    return; // Skip loans with invalid issue dates or no repayments
                }

                // Find the latest repayment date for this paid loan (already sorted descending)
                const lastRepayment = loan.repayments[0];
                const lastRepaymentDate = lastRepayment.date instanceof Date ? lastRepayment.date : parseISO(lastRepayment.date);

                if (!isValid(lastRepaymentDate)) {
                    console.warn(`Invalid last repayment date found for paid loan ${loan._id}`);
                    return; // Skip if last repayment date is invalid
                }

                // Calculate difference in days (ensure dates are compared correctly)
                const daysToRepay = differenceInDays(startOfDay(lastRepaymentDate), startOfDay(issueDate));

                // Only include valid repayment times (non-negative)
                if (daysToRepay >= 0) {
                   totalRepaymentDays += daysToRepay;
                   paidLoanCountWithRepayments++;
                } else {
                    console.warn(`Negative repayment time calculated for loan ${loan._id} (Issue: ${issueDate}, Last Repayment: ${lastRepaymentDate})`);
                }
            });
        }

        const averageRepaymentTimeDays = paidLoanCountWithRepayments > 0
            ? Math.round(totalRepaymentDays / paidLoanCountWithRepayments)
            : null; // Return null if no valid paid loans with repayments

        // --- Construct Summary Response ---
        const summary: ShopkeeperSummary = {
            totalLoaned,
            totalCollected,
            totalOutstanding,
            totalOverdueAmount,
            overdueLoanCount,
            averageRepaymentTimeDays,
            totalCustomers: totalCustomersCount ?? 0, // Default to 0 if count fails
            activeLoanCount: activeLoanCount ?? 0, // Default to 0 if count fails
        };

        return NextResponse.json(summary);

    } catch (error: any) {
        console.error('GET Summary API error:', error);
         // Handle specific errors
        if (error.message.startsWith('Not authorized')) {
            return NextResponse.json({ message: error.message }, { status: 401 });
        }
        if (error.message.includes('Could not connect to database')) {
            return NextResponse.json({ message: error.message }, { status: 503 }); // Service Unavailable
        }
        if (error instanceof mongoose.Error) { // Catch Mongoose errors during aggregation/find/count
            console.error('Mongoose error fetching summary:', error);
            return NextResponse.json({ message: 'Database error fetching summary data.' }, { status: 500 });
         }
        // Generic error
        return NextResponse.json({ message: 'Server error fetching summary', error: error.message || 'Unknown error' }, { status: 500 });
    }
}

    