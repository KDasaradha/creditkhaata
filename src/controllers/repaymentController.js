const Repayment = require('../models/Repayment');
const Loan = require('../models/Loan');
const mongoose = require('mongoose');

// @desc    Record a new repayment for a loan
// @route   POST /api/repayments
// @access  Private
const recordRepayment = async (req, res) => {
    const { loanId, amount, date } = req.body; // Expect date as ISO string or parsable

    // --- Validation ---
    if (!loanId || !amount) {
        return res.status(400).json({ message: 'loanId and amount are required' });
    }
     if (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
        return res.status(400).json({ message: 'Repayment amount must be a positive number' });
    }
     const parsedDate = date ? new Date(date) : new Date();
     if (isNaN(parsedDate.getTime())) {
         return res.status(400).json({ message: 'Invalid date format for repayment date' });
     }


    const session = await mongoose.startSession(); // Use transactions for atomicity
    session.startTransaction();

    try {
        // Find the loan and lock it for update
        const loan = await Loan.findById(loanId).session(session);

        if (!loan) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ message: 'Loan not found' });
        }

        // Check ownership
        if (loan.shopkeeper.toString() !== req.user.id) {
             await session.abortTransaction();
             session.endSession();
            return res.status(401).json({ message: 'Not authorized to record repayment for this loan' });
        }

        // Check if loan is already paid
        if (loan.balance <= 0) {
            await session.abortTransaction();
            session.endSession();
             return res.status(400).json({ message: 'This loan is already fully paid' });
        }

        const repaymentAmount = parseFloat(amount);

        // Ensure repayment doesn't exceed balance
        if (repaymentAmount > loan.balance) {
             await session.abortTransaction();
             session.endSession();
            return res.status(400).json({ message: `Repayment amount (${repaymentAmount.toFixed(2)}) cannot exceed the current balance (${loan.balance.toFixed(2)})` });
        }

        // Create the repayment record
        const newRepayment = new Repayment({
            shopkeeper: req.user.id,
            customer: loan.customer, // Get customer ID from the loan
            loan: loanId,
            amount: repaymentAmount,
            date: parsedDate,
        });

        const savedRepayment = await newRepayment.save({ session });

        // Update the loan balance and add repayment reference
        loan.balance -= repaymentAmount;
        loan.repayments.push(savedRepayment._id);

        // Recalculate and update loan status
        loan.status = loan.calculateStatus(); // Use the method defined in the model

        await loan.save({ session });

        // Commit the transaction
        await session.commitTransaction();
        session.endSession();

        // Populate necessary fields for the response
        const populatedRepayment = await Repayment.findById(savedRepayment._id)
            .populate('loan', 'description amount balance status') // Populate some loan details
            .populate('customer', 'name'); // Populate customer name

        res.status(201).json(populatedRepayment);

    } catch (err) {
        // If an error occurred, abort the transaction
        await session.abortTransaction();
        session.endSession();

        console.error('Record Repayment Error:', err);
        if (err.name === 'ValidationError') {
            const messages = Object.values(err.errors).map(val => val.message);
            return res.status(400).json({ message: messages.join('. ') });
        }
        if (err.kind === 'ObjectId') {
            return res.status(400).json({ message: 'Invalid loan ID format' });
        }
        res.status(500).send('Server Error');
    }
};

// @desc    Get all repayments for a specific loan
// @route   GET /api/repayments/loan/:loanId
// @access  Private
const getRepaymentsForLoan = async (req, res) => {
    const { loanId } = req.params;

    try {
        // First, verify the loan exists and belongs to the user
        const loan = await Loan.findById(loanId);
         if (!loan || loan.shopkeeper.toString() !== req.user.id) {
            return res.status(404).json({ message: 'Loan not found or you are not authorized' });
         }

        // Find repayments for this loan, sorted by date descending
        const repayments = await Repayment.find({ loan: loanId, shopkeeper: req.user.id })
                                          .sort({ date: -1 }); // Most recent first

        res.json(repayments);
    } catch (err) {
        console.error('Get Repayments Error:', err);
         if (err.kind === 'ObjectId') {
            return res.status(404).json({ message: 'Invalid loan ID format' });
         }
        res.status(500).send('Server Error');
    }
};


// @desc    Get all repayments (across all loans) for the shopkeeper
// @route   GET /api/repayments
// @access  Private
const getAllRepayments = async (req, res) => {
     try {
         const repayments = await Repayment.find({ shopkeeper: req.user.id })
                                           .populate('loan', 'description') // Add loan description
                                           .populate('customer', 'name')   // Add customer name
                                           .sort({ date: -1 }); // Most recent first
         res.json(repayments);
     } catch (err) {
         console.error('Get All Repayments Error:', err);
         res.status(500).send('Server Error');
     }
 };


module.exports = {
    recordRepayment,
    getRepaymentsForLoan,
    getAllRepayments,
};
