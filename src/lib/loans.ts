// src/lib/loans.ts
'use server'; // Mark this module for server-side execution

import { differenceInDays, startOfDay, addDays, parseISO, isValid, differenceInMonths, isAfter } from 'date-fns';
import mongoose from 'mongoose';
import connectDB from '@/lib/db';
import Loan, { ILoan, LoanDocument } from '@/models/Loan';
import Customer from '@/models/Customer';

/**
 * Calculates the simple interest accrued on an overdue loan balance.
 * Interest is calculated daily based on the annual rate.
 *
 * @param balance The current outstanding balance.
 * @param annualRate The annual interest rate (as a percentage, e.g., 12 for 12%).
 * @param daysOverdue The number of days the loan payment is overdue.
 * @returns The calculated simple interest amount. Returns 0 if rate is 0 or days are non-positive.
 */
export async function calculateSimpleOverdueInterest(balance: number, annualRate: number, daysOverdue: number): Promise<number> {
    if (annualRate <= 0 || daysOverdue <= 0 || balance <= 0) {
        return 0;
    }
    const dailyRate = annualRate / 365 / 100; // Convert annual percentage to daily decimal rate
    const interest = balance * dailyRate * daysOverdue;
    return parseFloat(interest.toFixed(2)); // Return rounded to 2 decimal places
}

/**
 * Calculates the number of full months a loan has been overdue.
 *
 * @param effectiveDueDate The date the loan became overdue (due date + grace days).
 * @param calculationDate The date up to which the overdue period is calculated (usually today).
 * @returns The number of full months overdue. Returns 0 if not overdue or dates invalid.
 */
 function calculateMonthsOverdue(effectiveDueDate: Date, calculationDate: Date): number | null {
    if (!isValid(effectiveDueDate) || !isValid(calculationDate) || !isAfter(calculationDate, effectiveDueDate)) {
        return null;
    }
    return differenceInMonths(calculationDate, effectiveDueDate);
}

import { Types } from 'mongoose';

/**
 * Processes loans to calculate and potentially apply overdue interest.
 * Updates loan balances and customer trust scores based on overdue status.
 * This function should be called periodically (e.g., daily via a cron job or on specific triggers).
 *
 * IMPORTANT: This modifies data. Use with caution and consider transactional safety if needed.
 *
 * @param shopkeeperId The ID of the shopkeeper whose loans to process.
 * @returns An object summarizing the processing results.
 */
export async function processOverdueLoansAndInterest(shopkeeperId: string | Types.ObjectId): Promise<{
    processed: number;
    interestAdded: number;
    trustScoreUpdates: number;
    errors: { loanId: string; error: string }[];
}> {
    await connectDB();
    const shopkeeperObjectId = new mongoose.Types.ObjectId(shopkeeperId);
    const today = startOfDay(new Date());
    const results = { processed: 0, interestAdded: 0, trustScoreUpdates: 0, errors: [] as { loanId: string; error: string }[] };

    // Find potentially overdue loans for the shopkeeper
    const loansToProcess: LoanDocument[] = await Loan.find({
        shopkeeper: shopkeeperObjectId,
        status: { $in: ['pending', 'overdue'] }, // Process pending and already overdue loans
        balance: { $gt: 0 },
    }).populate('customer'); // Populate customer for trust score updates

    for (const loan of loansToProcess) {
        const loanIdStr = loan._id.toString();
        try {
            results.processed++;
            const initialStatus = loan.status;
            const currentStatus = loan.calculateStatus(); // Recalculate based on current date

            let interestCalculated = 0;
            let trustScoreChange = 0;

            // --- Status Update ---
            if (currentStatus !== initialStatus) {
                loan.status = currentStatus;
                 // If transitioning to overdue, potentially decrement trust score
                 if (currentStatus === 'overdue' && loan.customer && typeof loan.customer === 'object' && 'trustScore' in loan.customer) {
                    if (loan.customer.trustScore > 0) {
                         loan.customer.trustScore = Math.max(0, loan.customer.trustScore - 1); // Decrement, min 0
                         trustScoreChange = -1;
                         results.trustScoreUpdates++;
                         // Need to save the customer document separately
                         await (loan.customer as any).save(); // Assuming customer is populated Mongoose doc
                     }
                 }
            }


            // --- Overdue Interest Calculation ---
             if (currentStatus === 'overdue' && loan.interestRate > 0) {
                const dueD = parseISO(String(loan.dueDate));
                if(isValid(dueD) ) {
                     const effectiveDueDate = addDays(startOfDay(dueD), loan.graceDays);
                     // Determine the start date for interest calculation
                     // It's the later of the last calculation date or the effective due date
                     const lastCalcDate = loan.lastInterestCalculationDate ? startOfDay(parseISO(String(loan.lastInterestCalculationDate))) : null;
                     const interestStartDate = (lastCalcDate && isAfter(lastCalcDate, effectiveDueDate)) ? lastCalcDate : effectiveDueDate;


                     // Calculate interest only if today is after the interest start date
                     if (isAfter(today, interestStartDate)) {
                        const daysForInterest = differenceInDays(today, interestStartDate);
                        if (daysForInterest > 0) {
                             // Calculate simple interest based on the current balance
                             interestCalculated = await calculateSimpleOverdueInterest(loan.balance, loan.interestRate, daysForInterest);

                             if (interestCalculated > 0) {
                                 
                                 // Add the overdue interest to the balance


                                 loan.balance = parseFloat((loan.balance + interestCalculated).toFixed(2));
                                 results.interestAdded += interestCalculated;

                                 // Update the last calculation date ONLY IF interest was added
                                 loan.lastInterestCalculationDate = today;
                             }
                         }
                     }
                 } else {
                     console.warn(`Loan ${loanIdStr}: Invalid due date for interest calculation.`);
                 }
            }


            // Save loan if status, balance, or calculation date changed
            if (loan.isModified('status') || loan.isModified('balance') || loan.isModified('lastInterestCalculationDate')) {
                await loan.save();
                 console.log(`Processed Loan ${loanIdStr}: Status=${loan.status}, Balance=${loan.balance.toFixed(2)}, Interest Added=${interestCalculated.toFixed(2)}, Trust Score Change=${trustScoreChange}`);
            }


        } catch (error: any) {
            console.error(`Error processing loan ${loanIdStr}:`, error);
            results.errors.push({ loanId: loanIdStr, error: error.message || 'Unknown processing error' });
        }
    }

    console.log(`Overdue processing finished for shopkeeper ${shopkeeperId}. Results:`, results);
    return results;
}

/**
 * Adjusts a customer's trust score based on repayment timeliness.
 * Should be called after a repayment is successfully recorded.
 *
 * @param loanId The ID of the loan the repayment was for.
 */
export async function adjustTrustScoreOnRepayment(loanId: string | Types.ObjectId): Promise<void> {
     await connectDB();
     const loanObjectId = new mongoose.Types.ObjectId(loanId);

     try {
         const loan = await Loan.findById(loanObjectId).populate('customer').select('dueDate graceDays status customer');

         if (!loan || !loan.customer || typeof loan.customer !== 'object' || !('trustScore' in loan.customer)) {
             console.warn(`Cannot adjust trust score: Loan ${loanId} or customer not found/populated correctly.`);
             return;
         }

         // Check if the loan *was* overdue before this payment made it 'paid' or 'pending'
         // This requires knowing the status *before* the repayment was applied, which is tricky here.
         // A simpler logic: If the repayment makes the loan fully paid ('paid' status),
         // and the repayment date is *on or before* the effective due date, increase score.
         // This doesn't penalize early payment for overdue loans, but rewards on-time full payment.

         // Recalculate status based on potentially updated balance (though this function might be called *after* balance update)
         const currentStatus = loan.calculateStatus();

         if (currentStatus === 'paid') {
             // Fetch the *last* repayment to check its date
             const lastRepayment = await mongoose.model('Repayment').findOne({ loan: loanObjectId }).sort({ date: -1 }).select('date');

             if (lastRepayment) {
                 const repaymentDate = startOfDay(parseISO(String(lastRepayment.date)));
                 const dueD = parseISO(String(loan.dueDate));
                 if(isValid(dueD)){
                    const effectiveDueDate = addDays(startOfDay(dueD), loan.graceDays);

                    // If repayment date is on or before the effective due date
                    if (!isAfter(repaymentDate, effectiveDueDate)) {
                        if (loan.customer.trustScore < 10) {
                             loan.customer.trustScore = Math.min(10, loan.customer.trustScore + 1); // Increment, max 10
                             await (loan.customer as any).save();
                             console.log(`Increased trust score for customer ${loan.customer._id} due to on-time full repayment of loan ${loanId}.`);
                         }
                    }
                    // Note: We are not decrementing score here. That's handled by the periodic `processOverdueLoansAndInterest` function.
                 }
             }
         }

     } catch (error: any) {
         console.error(`Error adjusting trust score for loan ${loanId}:`, error);
     }
}
