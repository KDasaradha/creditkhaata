// src/app/api/summary/route.ts
import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db';
import Loan from '@/models/Loan';
import Repayment from '@/models/Repayment';
import Customer from '@/models/Customer'; // Import Customer model
import { getUserIdFromRequest } from '@/lib/server-utils';
import { differenceInDays, startOfDay, isValid, parseISO } from 'date-fns'; // Import parseISO
import { processOverdueLoansAndInterest } from '@/lib/loans'; // Import processing function

// Interface for the expected summary structure
interface ShopkeeperSummary {
  totalLoaned: number;
  totalCollected: number;
  totalOutstanding: number; // Principal + Overdue Interest
  totalOverdueAmount: number; // Principal + Overdue Interest for overdue loans
  overdueLoanCount: number;
  averageRepaymentTimeDays: number | null;
  totalCustomers: number;
  activeLoanCount: number;
}


// Helper function to handle database connection errors
async function ensureDbConnection() {
    try {
        await connectDB();
    } catch (dbError: any) {
        console.error('Database connection failed in /api/summary:', dbError);
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


export async function GET(req: NextRequest) {
    let userId;
    let response: NextResponse;
    try {
        // Authenticate and connect to DB
        userId = await getUserIdFromRequest(req);
        const shopkeeperObjectId = new mongoose.Types.ObjectId(userId); // Ensure it's an ObjectId for matching
        await ensureDbConnection();

        // --- Process Overdue Loans and Interest First ---
        // Ensure statuses and balances (including potential overdue interest) are correct before aggregation
        console.log(`GET /api/summary: Triggering overdue processing for user ${userId}...`);
         try {
            await processOverdueLoansAndInterest(shopkeeperObjectId);
        } catch (processingError: any) {
            console.error(`Error during pre-summary overdue processing for user ${userId}:`, processingError);
            // Log and continue, summary might be slightly stale if processing fails.
        }
         console.log(`GET /api/summary: Overdue processing complete for user ${userId}. Calculating summary...`);


        // --- Perform Aggregations Concurrently ---
        // Use Promise.all for efficiency
        const [
            totalLoanedResult,
            totalCollectedResult,
            totalOutstandingResult, // Now includes potentially added overdue interest
            totalOverdueResult,     // Now includes potentially added overdue interest
            paidLoansForAvgCalc, // Fetch necessary data for avg repayment time calc
            totalCustomersCount, // Count total customers
            activeLoanCount // Count active loans (pending or overdue)
        ] = await Promise.all([
            // 1. Total Loaned Amount (Original principal)
            Loan.aggregate([
                { $match: { shopkeeper: shopkeeperObjectId } },
                { $group: { _id: null, totalLoaned: { $sum: "$amount" } } } // Sum original amount
            ]),
            // 2. Total Collected Amount (Sum of all repayments)
            Repayment.aggregate([
                { $match: { shopkeeper: shopkeeperObjectId } },
                { $group: { _id: null, totalCollected: { $sum: "$amount" } } }
            ]),
             // 3. Total Outstanding Balance (Sum of CURRENT balance for non-paid loans)
             // This balance field NOW includes any overdue interest added by the processing step
            Loan.aggregate([
                { $match: { shopkeeper: shopkeeperObjectId, status: { $in: ['pending', 'overdue'] } } },
                { $group: { _id: null, totalOutstanding: { $sum: "$balance" } } }
            ]),
            // 4. Total Overdue Amount & Count (Sum CURRENT balance of 'overdue' loans)
             // This balance field NOW includes any overdue interest added by the processing step
            Loan.aggregate([
                { $match: { shopkeeper: shopkeeperObjectId, status: 'overdue' } },
                { $group: {
                    _id: null,
                    totalOverdueAmount: { $sum: "$balance" }, // Sum current balance (incl. interest)
                    overdueLoanCount: { $sum: 1 } // Count documents matching 'overdue'
                }}
            ]),
            // 5. Data for Average Repayment Time (Fetch paid loans with details)
             Loan.find({ shopkeeper: shopkeeperObjectId, status: 'paid' })
                 .select('issueDate repayments amount dueDate') // Select fields needed for calc
                 .populate({ // Populate repayment dates, sorted descending
                     path: 'repayments',
                     select: 'date', // Only need the date of repayments
                     options: { sort: { 'date': -1 } } // Get latest repayment first
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

        response = NextResponse.json(summary);

    } catch (error: any) {
        console.error('GET Summary API error:', error);
         // Handle specific errors
        if (error.message.startsWith('Not authorized')) {
            response = NextResponse.json({ message: error.message }, { status: 401 });
        } else if (error.message.includes('Could not connect to database')) {
            response = NextResponse.json({ message: error.message }, { status: 503 }); // Service Unavailable
        } else if (error instanceof mongoose.Error) { // Catch Mongoose errors during aggregation/find/count
            console.error('Mongoose error fetching summary:', error);
            response = NextResponse.json({ message: 'Database error fetching summary data.' }, { status: 500 });
         } else {
            // Generic error
            response = NextResponse.json({ message: 'Server error fetching summary', error: error.message || 'Unknown error' }, { status: 500 });
        }
    }
    return addCorsHeaders(response);
}
