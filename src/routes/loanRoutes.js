const express = require('express');
const router = express.Router();
const {
    createLoan,
    getLoans,
    getLoanById,
    updateLoan,
    deleteLoan,
    getOverdueLoans,
} = require('../controllers/loanController');
const { protect } = require('../middleware/authMiddleware'); // Import auth middleware

// Apply protect middleware to all routes in this file
router.use(protect);

// Specific route first: /overdue before /:id
// @route   GET /api/loans/overdue
// @desc    Get all overdue loans for the logged-in user
// @access  Private
router.get('/overdue', getOverdueLoans);

// @route   POST /api/loans
// @desc    Create a new loan
// @access  Private
router.post('/', createLoan);

// @route   GET /api/loans
// @desc    Get all loans for the logged-in user (can filter by query params: ?status=overdue&customerId=...)
// @access  Private
router.get('/', getLoans);

// @route   GET /api/loans/:id
// @desc    Get a single loan by ID
// @access  Private
router.get('/:id', getLoanById);

// @route   PUT /api/loans/:id
// @desc    Update a loan's details (not balance)
// @access  Private
router.put('/:id', updateLoan);

// @route   DELETE /api/loans/:id
// @desc    Delete a loan (use with caution)
// @access  Private
router.delete('/:id', deleteLoan);


module.exports = router;
