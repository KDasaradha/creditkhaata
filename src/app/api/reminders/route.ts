// src/app/api/reminders/route.ts
import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db';
import Loan from '@/models/Loan';
import Customer from '@/models/Customer';
import { getUserIdFromRequest } from '@/lib/server-utils';
import { startOfDay, addDays } from 'date-fns';

// --- Mock Reminder Service ---
// In a real app, this would integrate with Twilio, Msg91, etc.
async function sendReminderMock(phoneNumber: string, message: string): Promise<{ success: boolean, messageId?: string, error?: string }> {
    console.log(`--- MOCK REMINDER ---`);
    console.log(`To: ${phoneNumber}`);
    console.log(`Message: ${message}`);
    console.log(`---------------------`);

    // Simulate network delay and potential failure
    await new Promise(resolve => setTimeout(resolve, Math.random() * 1000)); // 0-1s delay

    if (Math.random() > 0.1) { // 90% success rate
        return { success: true, messageId: `mock_${Date.now()}` };
    } else {
        return { success: false, error: 'Mock service unavailable' };
    }
}

// Helper function to handle database connection errors
async function ensureDbConnection() {
    try {
        await connectDB();
    } catch (dbError: any) {
        console.error('Database connection failed in /api/reminders:', dbError);
        throw new Error('Server error: Could not connect to database.');
    }
}

// Helper to add CORS headers
function addCorsHeaders(response: NextResponse): NextResponse {
    response.headers.set('Access-Control-Allow-Origin', '*'); // Adjust for production
    response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    return response;
}

// Handle OPTIONS requests for CORS preflight
export async function OPTIONS(req: NextRequest) {
  const response = new NextResponse(null, { status: 204 });
  return addCorsHeaders(response);
}

// POST /api/reminders - Send reminders for due or overdue loans
export async function POST(req: NextRequest) {
    let userId;
    let response: NextResponse;
    let sentCount = 0;
    let failedCount = 0;

    try {
        userId = await getUserIdFromRequest(req);
        await ensureDbConnection();
        const shopkeeperObjectId = new mongoose.Types.ObjectId(userId);

        const { type = 'overdue', loanIds } = await req.json(); // type can be 'due' or 'overdue', loanIds is optional array

        let loansToRemind = [];

        if (loanIds && Array.isArray(loanIds) && loanIds.length > 0) {
            // Validate ObjectIds
            const validLoanIds = loanIds.filter(id => mongoose.Types.ObjectId.isValid(id)).map(id => new mongoose.Types.ObjectId(id));
            if(validLoanIds.length !== loanIds.length) {
                 response = NextResponse.json({ message: 'Invalid loan ID format provided.' }, { status: 400 });
                 return addCorsHeaders(response);
            }
            // Fetch specific loans if IDs are provided
            loansToRemind = await Loan.find({
                _id: { $in: validLoanIds },
                shopkeeper: shopkeeperObjectId,
                status: { $in: ['pending', 'overdue'] }, // Only remind for active loans
                balance: { $gt: 0 }
            }).populate('customer', 'name phone');

        } else if (type === 'overdue') {
             // Fetch all overdue loans
            loansToRemind = await Loan.find({
                shopkeeper: shopkeeperObjectId,
                status: 'overdue',
                balance: { $gt: 0 }
            }).populate('customer', 'name phone');
        } else if (type === 'due') {
            // Fetch loans due soon (e.g., within next 3 days) - Adjust logic as needed
            const today = startOfDay(new Date());
            const threeDaysLater = addDays(today, 3);
            loansToRemind = await Loan.find({
                shopkeeper: shopkeeperObjectId,
                status: 'pending',
                balance: { $gt: 0 },
                dueDate: { $gte: today, $lte: threeDaysLater }
            }).populate('customer', 'name phone');
        } else {
             response = NextResponse.json({ message: 'Invalid reminder type specified.' }, { status: 400 });
             return addCorsHeaders(response);
        }

        if (loansToRemind.length === 0) {
            response = NextResponse.json({ message: `No loans found matching the criteria (${type}).` });
            return addCorsHeaders(response);
        }

        // --- Send Reminders (Loop and Mock) ---
        for (const loan of loansToRemind) {
            // Type guard for populated customer
            if (!loan.customer || typeof loan.customer === 'string' || !('phone' in loan.customer) || !('name' in loan.customer)) {
                console.warn(`Skipping reminder for loan ${loan._id}: Customer data not fully populated or phone missing.`);
                failedCount++;
                continue;
            }

            const customerPhone = loan.customer.phone;
            const customerName = loan.customer.name;
            const balance = loan.balance.toFixed(2);
            const dueDateFormatted = format(loan.dueDate, 'PPP'); // Format date nicely

            let message = '';
            if (loan.status === 'overdue') {
                message = `Hi ${customerName}, gentle reminder from CrediKhaata: Your payment of ₹${balance} for "${loan.description}" was due on ${dueDateFormatted}. Please pay soon.`;
            } else { // Assuming 'pending' and type is 'due'
                message = `Hi ${customerName}, reminder from CrediKhaata: Your payment of ₹${balance} for "${loan.description}" is due on ${dueDateFormatted}.`;
            }

            const result = await sendReminderMock(customerPhone, message);

            if (result.success) {
                sentCount++;
                // TODO: Log reminder in ReminderLog collection (optional bonus)
            } else {
                failedCount++;
                console.error(`Failed to send reminder for loan ${loan._id} to ${customerPhone}: ${result.error}`);
            }
        }

        response = NextResponse.json({
            message: `Reminder process completed. Sent: ${sentCount}, Failed: ${failedCount}.`,
            sentCount,
            failedCount
        });

    } catch (error: any) {
        console.error('POST /api/reminders error:', error);
        if (error.message.startsWith('Not authorized')) {
            response = NextResponse.json({ message: error.message }, { status: 401 });
        } else if (error.message.includes('Could not connect to database')) {
            response = NextResponse.json({ message: error.message }, { status: 503 });
        } else if (error instanceof SyntaxError) {
            response = NextResponse.json({ message: 'Invalid request body format.' }, { status: 400 });
        } else {
            response = NextResponse.json({ message: 'Server error processing reminders.', error: error.message || 'Unknown error' }, { status: 500 });
        }
    }

    return addCorsHeaders(response);
}