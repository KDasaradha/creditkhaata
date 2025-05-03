const express = require('express');
const router = express.Router();
const {
    recordRepayment,
    getRepaymentsForLoan,
    getAllRepayments,
} = require('../controllers/repaymentController');
const { protect } = require('../middleware/authMiddleware'); // Import auth middleware

// Apply protect middleware to all routes in this file
router.use(protect);

// @route   POST /api/repayments
// @desc    Record a new repayment for a loan
// @access  Private
router.post('/', recordRepayment);

// @route   GET /api/repayments
// @desc    Get all repayments for the logged-in user
// @access  Private
router.get('/', getAllRepayments);

// @route   GET /api/repayments/loan/:loanId
// @desc    Get all repayments for a specific loan
// @access  Private
router.get('/loan/:loanId', getRepaymentsForLoan);


module.exports = router;
