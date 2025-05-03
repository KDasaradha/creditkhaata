const Loan = require('../models/Loan');
const Customer = require('../models/Customer');
const { startOfDay, isAfter } = require('date-fns');


// Helper function to check ownership
const checkLoanOwnership = (loan, userId) => {
    if (!loan) return false;
    return loan.shopkeeper.toString() === userId;
};


// @desc    Create a new loan (credit sale)
// @route   POST /api/loans
// @access  Private
const createLoan = async (req, res) => {
    const {
        customerId,
        description,
        amount,
        issueDate, // Expect ISO string or parsable date format
        dueDate,   // Expect ISO string or parsable date format
        frequency = 'monthly', // Default if not provided
        interestRate = 0,
        graceDays = 0
    } = req.body;

    // --- Validation ---
    if (!customerId || !description || !amount || !dueDate) {
        return res.status(400).json({ message: 'customerId, description, amount, and dueDate are required' });
    }
    if (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
        return res.status(400).json({ message: 'Amount must be a positive number' });
    }
     if (interestRate && (isNaN(parseFloat(interestRate)) || parseFloat(interestRate) < 0)) {
        return res.status(400).json({ message: 'Interest rate must be a non-negative number' });
    }
    if (graceDays && (isNaN(parseInt(graceDays)) || parseInt(graceDays) < 0)) {
        return res.status(400).json({ message: 'Grace days must be a non-negative integer' });
    }

    const parsedIssueDate = issueDate ? new Date(issueDate) : new Date();
    const parsedDueDate = new Date(dueDate);

    if (isNaN(parsedIssueDate.getTime()) || isNaN(parsedDueDate.getTime())) {
        return res.status(400).json({ message: 'Invalid date format for issueDate or dueDate' });
    }
     if (isAfter(parsedIssueDate, parsedDueDate)) {
         return res.status(400).json({ message: 'Due date must be on or after the issue date' });
     }


    try {
        // Verify customer exists and belongs to the shopkeeper
        const customer = await Customer.findById(customerId);
        if (!customer || customer.shopkeeper.toString() !== req.user.id) {
            return res.status(404).json({ message: 'Customer not found or does not belong to you' });
        }

        // // Optional: Check against credit limit
        // const existingLoans = await Loan.find({ customer: customerId, shopkeeper: req.user.id, status: { $ne: 'paid' } });
        // const currentDebt = existingLoans.reduce((sum, loan) => sum + loan.balance, 0);
        // if (customer.creditLimit > 0 && (currentDebt + parseFloat(amount)) > customer.creditLimit) {
        //     return res.status(400).json({
        //         message: `This loan exceeds the customer's credit limit of ${customer.creditLimit}. Current debt: ${currentDebt}.`
        //     });
        // }

        const newLoan = new Loan({
            shopkeeper: req.user.id,
            customer: customerId,
            description,
            amount: parseFloat(amount),
            balance: parseFloat(amount), // Initial balance
            issueDate: parsedIssueDate,
            dueDate: parsedDueDate,
            frequency,
            interestRate: parseFloat(interestRate),
            graceDays: parseInt(graceDays),
            // Status will be set by pre-save middleware
        });

        const savedLoan = await newLoan.save();

         // Populate customer details before sending response
        const populatedLoan = await Loan.findById(savedLoan._id).populate('customer', 'name phone'); // Populate with specific fields


        res.status(201).json(populatedLoan);

    } catch (err) {
        console.error('Create Loan Error:', err);
        if (err.name === 'ValidationError') {
            const messages = Object.values(err.errors).map(val => val.message);
            return res.status(400).json({ message: messages.join('. ') });
        }
         if (err.kind === 'ObjectId') {
             return res.status(400).json({ message: 'Invalid customer ID format' });
         }
        res.status(500).send('Server Error');
    }
};


// @desc    Get all loans for the logged-in shopkeeper (optionally filter by status or customer)
// @route   GET /api/loans
// @access  Private
const getLoans = async (req, res) => {
    const { status, customerId } = req.query;
    const filter = { shopkeeper: req.user.id };

    if (status && ['pending', 'paid', 'overdue'].includes(status)) {
        filter.status = status;
    }
    if (customerId) {
        // Optional: Validate customerId format if needed
        filter.customer = customerId;
    }

    try {
        // Update status for all pending/overdue loans before querying
        // This ensures the status reflects the current date
        await Loan.updateMany(
            { shopkeeper: req.user.id, status: { $in: ['pending', 'overdue'] }, balance: { $gt: 0 } },
            [{ $set: { status: { $cond: {
                if: { $gt: ["$balance", 0] }, // Only check if balance > 0
                then: { $cond: {
                    // Check if today is after dueDate + graceDays
                    if: { $gt: [ startOfDay(new Date()), { $add: [ "$dueDate", { $multiply: [ "$graceDays", 24*60*60*1000 ] } ] } ] },
                    then: "overdue",
                    else: "pending"
                }},
                else: "paid" // Should already be paid if balance is 0, but for safety
            }}}}]
        );


        const loans = await Loan.find(filter)
            .populate('customer', 'name phone') // Populate customer details
            .sort({ dueDate: 1 }); // Sort by due date ascending

        res.json(loans);
    } catch (err) {
        console.error('Get Loans Error:', err.message);
        res.status(500).send('Server Error');
    }
};

// @desc    Get a single loan by ID
// @route   GET /api/loans/:id
// @access  Private
const getLoanById = async (req, res) => {
    try {
        const loan = await Loan.findById(req.params.id)
                               .populate('customer', 'name phone address')
                               .populate({ // Populate repayments, sorted by date descending
                                   path: 'repayments',
                                   options: { sort: { 'date': -1 } }
                               });

        if (!checkLoanOwnership(loan, req.user.id)) {
            return res.status(404).json({ message: 'Loan not found or you are not authorized' });
        }

         // Ensure status is up-to-date before sending
        const currentStatus = loan.calculateStatus();
        if (loan.status !== currentStatus) {
            loan.status = currentStatus;
            // Optionally save the updated status, but it might trigger middleware again
            // await loan.save({ validateBeforeSave: false }); // Avoid re-running all validations if just updating status
        }


        res.json(loan);
    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') {
            return res.status(404).json({ message: 'Loan not found (Invalid ID format)' });
        }
        res.status(500).send('Server Error');
    }
};

// @desc    Update a loan (e.g., description, due date - NOT balance directly)
// @route   PUT /api/loans/:id
// @access  Private
const updateLoan = async (req, res) => {
    const { description, dueDate, frequency, interestRate, graceDays } = req.body;

    const loanFields = {};
    if (description) loanFields.description = description;
    if (dueDate) {
        const parsedDueDate = new Date(dueDate);
         if (isNaN(parsedDueDate.getTime())) {
            return res.status(400).json({ message: 'Invalid date format for dueDate' });
         }
        loanFields.dueDate = parsedDueDate;
    }
    if (frequency) loanFields.frequency = frequency;
    if (interestRate !== undefined) {
         if (isNaN(parseFloat(interestRate)) || parseFloat(interestRate) < 0) {
            return res.status(400).json({ message: 'Interest rate must be a non-negative number' });
         }
        loanFields.interestRate = parseFloat(interestRate);
    }
    if (graceDays !== undefined) {
         if (isNaN(parseInt(graceDays)) || parseInt(graceDays) < 0) {
            return res.status(400).json({ message: 'Grace days must be a non-negative integer' });
         }
        loanFields.graceDays = parseInt(graceDays);
    }
     // Note: Balance updates should happen via repayments, not directly here.
     // If allowing direct balance edits, add stringent checks.

    try {
        let loan = await Loan.findById(req.params.id);

         if (!checkLoanOwnership(loan, req.user.id)) {
            return res.status(404).json({ message: 'Loan not found or you are not authorized' });
        }

        // Prevent editing fully paid loans? Optional.
        // if (loan.status === 'paid') {
        //     return res.status(400).json({ message: 'Cannot edit a fully paid loan' });
        // }

         // Due date validation against issue date
         if (loanFields.dueDate && isAfter(loan.issueDate, loanFields.dueDate)) {
             return res.status(400).json({ message: 'Due date cannot be before the issue date' });
         }

        // Update the loan
        loan = await Loan.findByIdAndUpdate(
            req.params.id,
            { $set: loanFields },
            { new: true, runValidators: true } // Return updated doc, run validators
        ).populate('customer', 'name phone');

        // findByIdAndUpdate doesn't trigger 'save' middleware by default,
        // so status might need manual recalculation/update if dueDate changed
        const updatedStatus = loan.calculateStatus();
        if (loan.status !== updatedStatus) {
            loan.status = updatedStatus;
            await loan.save({ validateBeforeSave: false }); // Save the recalculated status
        }

        res.json(loan);

    } catch (err) {
        console.error('Update Loan Error:', err);
        if (err.name === 'ValidationError') {
            const messages = Object.values(err.errors).map(val => val.message);
            return res.status(400).json({ message: messages.join('. ') });
        }
         if (err.kind === 'ObjectId') {
             return res.status(404).json({ message: 'Loan not found (Invalid ID format)' });
         }
        res.status(500).send('Server Error');
    }
};


// @desc    Delete a loan (Use with caution!)
// @route   DELETE /api/loans/:id
// @access  Private
const deleteLoan = async (req, res) => {
    try {
        const loan = await Loan.findById(req.params.id);

         if (!checkLoanOwnership(loan, req.user.id)) {
            return res.status(404).json({ message: 'Loan not found or you are not authorized' });
        }

        // **Important:** Decide deletion policy. Can loans with repayments be deleted?
        // Generally, it's better to mark as 'cancelled' or 'void' instead of deleting.
        if (loan.repayments && loan.repayments.length > 0) {
             return res.status(400).json({ message: 'Cannot delete a loan that has repayments recorded. Consider voiding or archiving.' });
        }
         if (loan.balance > 0 && loan.balance < loan.amount) {
              return res.status(400).json({ message: 'Cannot delete a partially repaid loan. Consider voiding or archiving.' });
         }

         // If you proceed with deletion:
         // You might also need to delete associated repayments if they are stored separately
         // await Repayment.deleteMany({ loan: req.params.id, shopkeeper: req.user.id });

        await Loan.findByIdAndDelete(req.params.id);

        res.json({ message: 'Loan removed' });
    } catch (err) {
        console.error('Delete Loan Error:', err);
        if (err.kind === 'ObjectId') {
            return res.status(404).json({ message: 'Loan not found (Invalid ID format)' });
        }
        res.status(500).send('Server Error');
    }
};

// @desc    Get overdue loans for the shopkeeper
// @route   GET /api/loans/overdue
// @access  Private
const getOverdueLoans = async (req, res) => {
    try {
        // Ensure statuses are up-to-date first
         await Loan.updateMany(
            { shopkeeper: req.user.id, status: 'pending', balance: { $gt: 0 } },
             [{ $set: { status: { $cond: {
                if: { $gt: ["$balance", 0] },
                then: { $cond: {
                    if: { $gt: [ startOfDay(new Date()), { $add: [ "$dueDate", { $multiply: [ "$graceDays", 24*60*60*1000 ] } ] } ] },
                    then: "overdue",
                    else: "pending"
                }},
                else: "paid"
            }}}}]
        );

        const overdueLoans = await Loan.find({ shopkeeper: req.user.id, status: 'overdue' })
            .populate('customer', 'name phone')
            .sort({ dueDate: 1 }); // Sort by oldest due date first

        res.json(overdueLoans);
    } catch (err) {
        console.error('Get Overdue Loans Error:', err.message);
        res.status(500).send('Server Error');
    }
};


module.exports = {
    createLoan,
    getLoans,
    getLoanById,
    updateLoan,
    deleteLoan,
    getOverdueLoans,
};
