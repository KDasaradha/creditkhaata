const express = require('express');
const router = express.Router();
const { getShopkeeperSummary } = require('../controllers/summaryController');
const { protect } = require('../middleware/authMiddleware');

// Apply protect middleware to this route
router.use(protect);

// @route   GET /api/summary
// @desc    Get financial and overdue summary for the logged-in shopkeeper
// @access  Private
router.get('/', getShopkeeperSummary);

module.exports = router;
