const Loan = require('../models/Loan');
const Repayment = require('../models/Repayment');
const { differenceInDays, parseISO } = require('date-fns');

// @desc    Get financial and overdue summary for the shopkeeper
// @route   GET /api/summary
// @access  Private
const getShopkeeperSummary = async (req, res) => {
    const shopkeeperId = req.user.id;

    try {
        // --- Calculate Financial Totals ---

        // 1. Total Amount Loaned (Sum of 'amount' for all loans)
        const totalLoanedResult = await Loan.aggregate([
            { $match: { shopkeeper: shopkeeperId } },
            { $group: { _id: null, totalLoaned: { $sum: "$amount" } } }
        ]);
        const totalLoaned = totalLoanedResult.length > 0 ? totalLoanedResult[0].totalLoaned : 0;

        // 2. Total Amount Collected (Sum of 'amount' for all repayments)
        const totalCollectedResult = await Repayment.aggregate([
            { $match: { shopkeeper: shopkeeperId } },
            { $group: { _id: null, totalCollected: { $sum: "$amount" } } }
        ]);
        const totalCollected = totalCollectedResult.length > 0 ? totalCollectedResult[0].totalCollected : 0;


        // 3. Total Outstanding Balance (Sum of 'balance' for non-paid loans)
        // Ensure statuses are up-to-date first (important for accuracy)
         await Loan.updateMany(
            { shopkeeper: shopkeeperId, status: { $in: ['pending', 'overdue'] }, balance: { $gt: 0 } },
            [{ $set: { status: { $cond: {
                if: { $gt: ["$balance", 0] },
                then: { $cond: {
                    if: { $gt: [ new Date(), { $add: [ "$dueDate", { $multiply: [ "$graceDays", 24*60*60*1000 ] } ] } ] },
                    then: "overdue",
                    else: "pending"
                }},
                else: "paid"
            }}}}]
        );

        const totalOutstandingResult = await Loan.aggregate([
            { $match: { shopkeeper: shopkeeperId, status: { $ne: 'paid' } } }, // Can also use balance > 0
            { $group: { _id: null, totalOutstanding: { $sum: "$balance" } } }
        ]);
        const totalOutstanding = totalOutstandingResult.length > 0 ? totalOutstandingResult[0].totalOutstanding : 0;


        // 4. Total Overdue Amount (Sum of 'balance' for loans with status 'overdue')
        const totalOverdueResult = await Loan.aggregate([
            { $match: { shopkeeper: shopkeeperId, status: 'overdue' } },
            { $group: { _id: null, totalOverdue: { $sum: "$balance" } } }
        ]);
        const totalOverdueAmount = totalOverdueResult.length > 0 ? totalOverdueResult[0].totalOverdue : 0;

        // 5. Number of Overdue Loans
        const overdueLoanCount = await Loan.countDocuments({ shopkeeper: shopkeeperId, status: 'overdue' });


        // --- Calculate Average Repayment Time (More Complex) ---
        // This requires finding the first and last repayment for each *fully paid* loan.
        const paidLoans = await Loan.find({ shopkeeper: shopkeeperId, status: 'paid' })
                                    .populate('repayments', 'date'); // Populate repayment dates

        let totalRepaymentDays = 0;
        let paidLoanCountWithRepayments = 0;

        paidLoans.forEach(loan => {
            if (loan.repayments && loan.repayments.length > 0) {
                // Sort repayments by date to find the first one easily (should be sorted already if populated correctly)
                 // const sortedRepayments = loan.repayments.sort((a, b) => a.date - b.date); // Ascending sort
                 // const firstRepaymentDate = sortedRepayments[0].date;
                 // Find the latest repayment date (assuming last repayment completes the loan)
                 const lastRepaymentDate = loan.repayments.reduce((latest, current) =>
                     current.date > latest ? current.date : latest,
                     loan.repayments[0].date // Initial value
                 );

                const daysToRepay = differenceInDays(lastRepaymentDate, loan.issueDate);
                if (daysToRepay >= 0) { // Ensure valid difference
                   totalRepaymentDays += daysToRepay;
                   paidLoanCountWithRepayments++;
                }
            }
             // Handle loans paid in full instantly (issueDate === dueDate, one repayment on same day?) - edge case
             else if (loan.amount === 0 || differenceInDays(loan.dueDate, loan.issueDate) === 0) {
                 // Decide how to handle loans with 0 amount or paid instantly
                 // Maybe exclude them or count as 0 days
             }
        });

        const averageRepaymentTime = paidLoanCountWithRepayments > 0
            ? Math.round(totalRepaymentDays / paidLoanCountWithRepayments)
            : null; // Or return 0 or 'N/A'

        // --- Construct Summary Response ---
        const summary = {
            totalLoaned,
            totalCollected,
            totalOutstanding,
            totalOverdueAmount,
            overdueLoanCount,
            averageRepaymentTimeDays: averageRepaymentTime, // In days
            // Add more stats if needed (e.g., total customers, total active loans)
            totalCustomers: await require('../models/Customer').countDocuments({ shopkeeper: shopkeeperId }),
            activeLoanCount: await Loan.countDocuments({ shopkeeper: shopkeeperId, status: { $ne: 'paid' } }),
        };

        res.json(summary);

    } catch (err) {
        console.error('Get Summary Error:', err);
        res.status(500).send('Server Error');
    }
};

module.exports = {
    getShopkeeperSummary,
};
