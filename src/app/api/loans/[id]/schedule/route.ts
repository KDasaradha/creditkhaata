// src/app/api/loans/[id]/schedule/route.ts
import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db';
import Loan from '@/models/Loan';
import { getUserIdFromRequest } from '@/lib/server-utils';
import { addWeeks, addMonths, format, isBefore, startOfDay } from 'date-fns';

interface Params {
    params: { id: string }; // Loan ID
}

interface Installment {
    installmentNumber: number;
    dueDate: string; // Formatted date string
    estimatedAmount: number; // Basic equal division, ignoring interest for simplicity here
    status: 'Upcoming' | 'Past Due' | 'Paid (Approximation)'; // Simplified status based on date
}

// Helper function to handle database connection errors
async function ensureDbConnection() {
    try {
        await connectDB();
    } catch (dbError: any) {
        console.error('Database connection failed in /api/loans/[id]/schedule:', dbError);
        throw new Error('Server error: Could not connect to database.');
    }
}

// Helper to add CORS headers
function addCorsHeaders(response: NextResponse): NextResponse {
    response.headers.set('Access-Control-Allow-Origin', '*'); // Adjust for production
    response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    return response;
}

// Handle OPTIONS requests for CORS preflight
export async function OPTIONS(req: NextRequest) {
  const response = new NextResponse(null, { status: 204 });
  return addCorsHeaders(response);
}

// GET /api/loans/:id/schedule - Generate a theoretical installment schedule
export async function GET(req: NextRequest, { params }: Params) {
    let userId;
    let response: NextResponse;

    try {
        userId = await getUserIdFromRequest(req);
        await ensureDbConnection();
        const shopkeeperObjectId = new mongoose.Types.ObjectId(userId);
        const { id: loanId } = params;

        if (!mongoose.Types.ObjectId.isValid(loanId)) {
            response = NextResponse.json({ message: 'Invalid loan ID format' }, { status: 400 });
            return addCorsHeaders(response);
        }
        const loanObjectId = new mongoose.Types.ObjectId(loanId);

        // Fetch the loan
        const loan = await Loan.findOne({ _id: loanObjectId, shopkeeper: shopkeeperObjectId }).lean();
        if (!loan) {
            response = NextResponse.json({ message: 'Loan not found or not authorized' }, { status: 404 });
            return addCorsHeaders(response);
        }

        // --- Generate Schedule (Basic Implementation) ---
        // This is a simplified example. Real installment calculation can be complex,
        // especially with varying interest, payments, etc.
        // This mock assumes equal installments based on frequency until the original due date.

        const schedule: Installment[] = [];
        let currentDueDate = loan.issueDate; // Start from issue date for calculation
        const finalDueDate = loan.dueDate;
        const today = startOfDay(new Date());
        let installmentNumber = 1;
        const totalPaid = loan.amount - loan.balance; // Approximation based on balance

        // Determine number of periods (rough estimate)
        let estimatedInstallmentAmount = loan.amount; // Default for one-time
        let periods = 1;

        if (loan.frequency !== 'one-time') {
             // This is a very rough estimation of periods. Needs refinement for accuracy.
             // A better approach might involve financial libraries or more complex date logic.
             const daysDiff = Math.max(1, Math.ceil((finalDueDate.getTime() - currentDueDate.getTime()) / (1000 * 60 * 60 * 24)));
             periods = loan.frequency === 'bi-weekly' ? Math.ceil(daysDiff / 14) : Math.ceil(daysDiff / 30);
             estimatedInstallmentAmount = periods > 0 ? loan.amount / periods : loan.amount;
        }


        while (isBefore(currentDueDate, finalDueDate) || currentDueDate.getTime() === finalDueDate.getTime()) {
             let nextDueDate: Date;
             if (loan.frequency === 'bi-weekly') {
                 nextDueDate = addWeeks(currentDueDate, 2);
             } else if (loan.frequency === 'monthly') {
                 nextDueDate = addMonths(currentDueDate, 1);
             } else { // one-time
                  // For one-time, we just show the single due date
                  currentDueDate = finalDueDate;
                  nextDueDate = finalDueDate;
                  estimatedInstallmentAmount = loan.amount; // Full amount due
             }

              // Determine status based on date (approximation)
             let status: Installment['status'] = 'Upcoming';
              // Simple approximation: if installment's estimated due date is past, mark as 'Past Due' unless loan is fully paid
             if (isBefore(currentDueDate, today) && loan.balance > 0) {
                 status = 'Past Due';
             }
             // Very rough paid status approximation - needs actual repayment tracking correlation
             if (totalPaid >= (estimatedInstallmentAmount * installmentNumber)) {
                 status = 'Paid (Approximation)';
             }


             schedule.push({
                 installmentNumber: installmentNumber,
                 // Use the calculated 'next' due date for display, or final date for one-time
                 dueDate: format(loan.frequency === 'one-time' ? finalDueDate : nextDueDate, 'PPP'),
                 estimatedAmount: estimatedInstallmentAmount,
                 status: status
             });

             if (loan.frequency === 'one-time' || schedule.length >= periods) {
                 break; // Exit after one installment for one-time or if estimated periods reached
             }

             currentDueDate = nextDueDate;
             installmentNumber++;

             // Safety break to prevent infinite loops
             if (installmentNumber > 120) { // Limit to 10 years of monthly payments
                 console.warn(`Loan schedule generation stopped for loan ${loanId} due to excessive installments.`);
                 break;
             }
        }

        // If schedule is empty (e.g., one-time loan where loop didn't run as expected), add the final due date.
         if (schedule.length === 0) {
             schedule.push({
                 installmentNumber: 1,
                 dueDate: format(finalDueDate, 'PPP'),
                 estimatedAmount: loan.amount,
                 status: isBefore(finalDueDate, today) && loan.balance > 0 ? 'Past Due' : (loan.balance <= 0 ? 'Paid (Approximation)' : 'Upcoming')
             });
         }


        response = NextResponse.json(schedule);

    } catch (error: any) {
        console.error('GET /api/loans/[id]/schedule error:', error);
        if (error.message.startsWith('Not authorized')) {
            response = NextResponse.json({ message: error.message }, { status: 401 });
        } else if (error.message.includes('Could not connect to database')) {
            response = NextResponse.json({ message: error.message }, { status: 503 });
        } else {
            response = NextResponse.json({ message: 'Server error generating schedule.', error: error.message || 'Unknown error' }, { status: 500 });
        }
    }

    return addCorsHeaders(response);
}