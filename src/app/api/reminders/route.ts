// src/app/api/reminders/route.ts
import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db';
import Loan, { LoanDocument } from '@/models/Loan'; // Import ILoan
import Customer, { ICustomer } from '@/models/Customer'; // Import ICustomer
import { getUserIdFromRequest } from '@/lib/server-utils';
import { startOfDay, addDays, format } from 'date-fns';

// --- Mock External Reminder Service (Simulates calling Twilio, Msg91, etc.) ---
interface ReminderServiceResult {
    success: boolean;
    messageId?: string; // ID from the external service
    error?: string;     // Error message if failed
    details?: any;      // Additional details from the service
}

/**
 * Simulates sending a reminder via an external SMS/WhatsApp service.
 * In a real application, this function would contain the actual API call
 * to a service like Twilio using their SDK.
 *
 * @param phoneNumber The recipient's phone number.
 * @param message The message content.
 * @returns Promise<ReminderServiceResult> Result of the simulated send operation.
 */
async function sendReminderViaExternalService(phoneNumber: string, message: string): Promise<ReminderServiceResult> {
    console.log(`[Reminder Service Simulation] Attempting to send to: ${phoneNumber}`);
    // --- PLACEHOLDER for actual API call ---
    // Example with Twilio (conceptual):
    // try {
    //   const twilioClient = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    //   const messageResult = await twilioClient.messages.create({
    //     body: message,
    //     from: process.env.TWILIO_PHONE_NUMBER, // Your Twilio number
    //     to: phoneNumber // Ensure phone number is in E.164 format for Twilio
    //   });
    //   console.log(`[Reminder Service Simulation] Message sent via Twilio. SID: ${messageResult.sid}`);
    //   return { success: true, messageId: messageResult.sid, details: messageResult };
    // } catch (error: any) {
    //   console.error(`[Reminder Service Simulation] Error sending message via Twilio:`, error);
    //   return { success: false, error: error.message || 'Failed to send via Twilio', details: error };
    // }
    // --- END PLACEHOLDER ---

    // Mock implementation:
    await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 100)); // Simulate 100-600ms delay

    // Basic validation simulation for phone number format (adjust regex if needed)
    if (!/^\+?[1-9]\d{1,14}$/.test(phoneNumber.replace(/\s+/g, ''))) { // Simple E.164-like check
        const errorMsg = 'Simulated service failure: Invalid phone number format for external service.';
        console.error(`[Reminder Service Simulation] Failed: ${errorMsg}`);
        return { success: false, error: errorMsg };
    }


    const isSuccess = Math.random() > 0.1; // 90% success rate for simulation

    if (isSuccess) {
        const mockMessageId = `mock_sms_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        console.log(`[Reminder Service Simulation] Success. Message ID: ${mockMessageId}`);
        return { success: true, messageId: mockMessageId };
    } else {
        const errorMsg = 'Simulated service failure: Network error';
        console.error(`[Reminder Service Simulation] Failed: ${errorMsg}`);
        return { success: false, error: errorMsg };
    }
}

//Helper Function
function convertToLoanDocument(loan: any): LoanDocument {
    return {
        ...loan,
        calculateStatus: () => {
            return Loan.prototype.calculateStatus.call({ ...loan, dueDate: new Date(loan.dueDate) }); // Reconstructs the loan object for the method
        },
    } as LoanDocument;
}
// --- Database and Request Handling ---

async function ensureDbConnection() {
    try {
        await connectDB();
    } catch (dbError: any) {
        console.error('Database connection failed in /api/reminders:', dbError);
        throw new Error('Server error: Could not connect to database.');
    }
}

function addCorsHeaders(response: NextResponse): NextResponse {
    response.headers.set('Access-Control-Allow-Origin', '*'); // Adjust for production
    response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    return response;
}

export async function OPTIONS(req: NextRequest) {
    const response = new NextResponse(null, { status: 204 });
    return addCorsHeaders(response);
}

// POST /api/reminders - Send reminders for due or overdue loans
export async function POST(req: NextRequest) {
    let userId;
    let response: NextResponse;
    const results = { sent: 0, failed: 0, skipped: 0, errors: [] as { loanId?: string; customerName?: string; message: string }[] };

    try {
        userId = await getUserIdFromRequest(req);
        await ensureDbConnection();
        const shopkeeperObjectId = new mongoose.Types.ObjectId(userId);

        // Determine reminder type and target loans
        let requestBody;
        try {
            requestBody = await req.json();
        } catch (parseError) {
            throw new SyntaxError('Invalid JSON payload');
        }
        const { type = 'overdue', loanIds } = requestBody;

        console.log(`[API Reminders] Received request. Type: ${type}, User: ${userId}, Specific Loan IDs: ${loanIds ? loanIds.join(', ') : 'None'}`);

        let loansToRemindQuery: mongoose.Query<any[], any> | null = null; // Initialize with null or a base query

        if (loanIds && Array.isArray(loanIds) && loanIds.length > 0) {
            const validLoanIds = loanIds
                .filter(id => mongoose.Types.ObjectId.isValid(id))
                .map(id => new mongoose.Types.ObjectId(id));

            if (validLoanIds.length === 0) {
                response = NextResponse.json({ message: 'No valid loan IDs provided.' }, { status: 400 });
                return addCorsHeaders(response);
            }
            if (validLoanIds.length !== loanIds.length) {
                console.warn('[API Reminders] Some invalid loan ID formats were provided and ignored.');
                // Optionally include this warning in the response
            }
            console.log(`[API Reminders] Targeting specific loans: ${validLoanIds.join(', ')}`);
            loansToRemindQuery = Loan.find({
                _id: { $in: validLoanIds },
                shopkeeper: shopkeeperObjectId,
                status: { $in: ['pending', 'overdue'] }, // Only remind for active loans
                balance: { $gt: 0 }
            });

        } else if (type === 'overdue') {
             console.log('[API Reminders] Targeting all overdue loans.');
            // Ensure statuses are up-to-date before querying overdue
             const todayStart = startOfDay(new Date());
              try {
                 await Loan.updateMany(
                    {
                        shopkeeper: shopkeeperObjectId,
                        status: 'pending',
                        balance: { $gt: 0 },
                        $expr: { $gt: [ todayStart, { $add: [ "$dueDate", { $multiply: [ "$graceDays", 24*60*60*1000 ] } ] } ] }
                    },
                    { $set: { status: "overdue", updatedAt: new Date() } }
                 );
                 console.log(`[API Reminders] Updated overdue statuses for user ${userId}.`);
             } catch (updateError: any) {
                 console.error(`[API Reminders] Error updating overdue status for user ${userId}:`, updateError);
                 // Log but continue, reminders might be slightly stale
                 results.errors.push({ message: `Failed to update loan statuses before sending reminders: ${updateError.message}` });
             }

            loansToRemindQuery = Loan.find({
                shopkeeper: shopkeeperObjectId,
                status: 'overdue',
                balance: { $gt: 0 }
            });
        } else if (type === 'due') {
            console.log('[API Reminders] Targeting loans due soon (next 3 days).');
            const today = startOfDay(new Date());
            const threeDaysLater = addDays(today, 3);
            loansToRemindQuery = Loan.find({
                shopkeeper: shopkeeperObjectId,
                status: 'pending', // Only pending loans are "due soon"
                balance: { $gt: 0 },
                dueDate: { $gte: today, $lte: threeDaysLater }
            });
        } else {
             console.error(`[API Reminders] Invalid reminder type specified: ${type}`);
             response = NextResponse.json({ message: 'Invalid reminder type specified. Use "due" or "overdue", or provide "loanIds".' }, { status: 400 });
             return addCorsHeaders(response);
        }

        // Populate customer details needed for the reminder message
        const loansToRemind = await loansToRemindQuery?.populate<{ customer: ICustomer }>('customer', 'name phone').lean();

        if (!loansToRemind || loansToRemind.length === 0) {
            console.log('[API Reminders] No loans found matching the criteria.');
            response = NextResponse.json({
                message: `No loans found matching the criteria (${loanIds ? 'specific IDs' : type}). No reminders sent.`,
                sentCount: 0,
                failedCount: 0,
                skippedCount: 0,
             });
            return addCorsHeaders(response);
        }




        console.log(`[API Reminders] Found ${loansToRemind.length} loan(s) to potentially remind.`);

        // --- Send Reminders ---
        for (const loan of loansToRemind as LoanDocument[]) {
             const loanIdStr = loan._id.toString();
             const customerName = loan.customer?.name || 'Customer'; // Default name
             const customerPhone = loan.customer?.phone?.replace(/\s+/g, ''); // Clean phone number

            // Validate populated customer data and phone number
            if (!loan.customer || !customerPhone || !customerName) {
                 console.warn(`[API Reminders] Skipping loan ${loanIdStr}: Missing customer data or phone number.`);
                 results.skipped++;
                 results.errors.push({ loanId: loanIdStr, customerName, message: 'Skipped: Missing customer details or phone number.' });
                continue;
            }

            // Basic Indian phone validation (server-side check before potentially sending to external service)
            // Adjust regex if your customer base uses different formats
            if (!/^[6-9]\d{9}$/.test(customerPhone)) {
                 console.warn(`[API Reminders] Skipping loan ${loanIdStr}: Invalid phone number format for customer ${customerName} (${loan.customer.phone}).`);
                 results.skipped++;
                 results.errors.push({ loanId: loanIdStr, customerName, message: `Skipped: Invalid phone format (${loan.customer.phone}).` });
                continue;
            }

            const balanceFormatted = `Rs. ${loan.balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            const dueDateFormatted = format(loan.dueDate, 'PPP'); // e.g., Jun 15, 2024

             const loanDocument: LoanDocument = convertToLoanDocument(loan);
            let message = '';
             const currentStatus = loanDocument.calculateStatus();

            if (currentStatus === 'overdue') {
                message = `Hi ${customerName}, gentle reminder from CrediKhaata: Your payment of ${balanceFormatted} for "${loan.description}" was due on ${dueDateFormatted}. Please pay at your earliest convenience.`;
            } else if (currentStatus === 'pending' && type === 'due') { // Only send 'due' message for pending loans when type is 'due'
                message = `Hi ${customerName}, friendly reminder from CrediKhaata: Your payment of ${balanceFormatted} for "${loan.description}" is due on ${dueDateFormatted}.`;
            } else {
                 // Skip sending if the status/type combination doesn't warrant a message
                 console.log(`[API Reminders] Skipping loan ${loanIdStr}: Status (${currentStatus}) / Type (${type}) combo not suitable for reminder.`);
                 results.skipped++;
                 results.errors.push({ loanId: loanIdStr, customerName, message: `Skipped: Loan status (${currentStatus}) not matching reminder type (${type}).` });
                 continue;
            }

            console.log(`[API Reminders] Preparing to send reminder for Loan ID: ${loanIdStr}, Customer: ${customerName}, Phone: ${customerPhone}`);

            // Call the (simulated) external service
            const result = await sendReminderViaExternalService(customerPhone, message);

            if (result.success) {
                 console.log(`[API Reminders] Reminder sent successfully for Loan ID: ${loanIdStr}. Service Message ID: ${result.messageId}`);
                results.sent++;
                // TODO: Log successful reminder in a ReminderLog collection (optional bonus)
            } else {
                 console.error(`[API Reminders] Failed to send reminder for Loan ID: ${loanIdStr}. Error: ${result.error}`);
                results.failed++;
                results.errors.push({ loanId: loanIdStr, customerName, message: `Failed: ${result.error || 'Unknown external service failure'}` });
                 // TODO: Log failed reminder attempt (optional bonus)
            }
        }

        console.log(`[API Reminders] Process completed for user ${userId}. Results: Sent=${results.sent}, Failed=${results.failed}, Skipped=${results.skipped}`);

        response = NextResponse.json({
            message: `Reminder process finished. Sent: ${results.sent}, Failed: ${results.failed}, Skipped: ${results.skipped}.`,
            sentCount: results.sent,
            failedCount: results.failed,
            skippedCount: results.skipped,
            // Only include errors array if there were actual errors or skips
            errors: results.errors.length > 0 ? results.errors : undefined
        });

    } catch (error: any) {
        console.error('[API Reminders] Unexpected error:', error);
        let status = 500;
        let message = 'Server error processing reminders.';
        let errorDetail = error.message || 'Unknown server error';

        if (error instanceof SyntaxError) { // Handle JSON parsing errors specifically
            status = 400;
            message = 'Invalid request format.';
            errorDetail = 'Could not parse JSON body.';
        } else if (error.message?.startsWith('Not authorized')) {
            status = 401;
            message = error.message;
            errorDetail = message;
        } else if (error.message?.includes('Could not connect to database')) {
            status = 503;
            message = error.message;
            errorDetail = message;
        } else if (error instanceof mongoose.Error) {
            status = 500;
            message = 'Database error during reminder processing.';
            errorDetail = error.message;
        }

        // Ensure the error detail is logged and potentially added to results
        results.errors.push({ message: errorDetail });

        response = NextResponse.json({
            message,
            sentCount: results.sent,
            failedCount: results.failed,
            skippedCount: results.skipped,
            errors: results.errors // Always include errors if catch block is reached
        }, { status });
    }

    return addCorsHeaders(response);
}

// ReminderLog Model (Example - place in src/models/ReminderLog.ts if used)
/*
import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IReminderLog extends Document {
  shopkeeper: Types.ObjectId;
  customer: Types.ObjectId;
  loan: Types.ObjectId;
  type: 'sms' | 'whatsapp';
  status: 'sent' | 'failed' | 'pending';
  sentAt: Date;
  serviceMessageId?: string;
  error?: string;
}

const ReminderLogSchema: Schema<IReminderLog> = new Schema({
  shopkeeper: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  customer: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
  loan: { type: Schema.Types.ObjectId, ref: 'Loan', required: true, index: true },
  type: { type: String, enum: ['sms', 'whatsapp'], required: true },
  status: { type: String, enum: ['sent', 'failed', 'pending'], required: true },
  sentAt: { type: Date, default: Date.now },
  serviceMessageId: { type: String },
  error: { type: String },
}, { timestamps: true });

const ReminderLog = mongoose.models.ReminderLog || mongoose.model<IReminderLog>('ReminderLog', ReminderLogSchema);
export default ReminderLog;
*/