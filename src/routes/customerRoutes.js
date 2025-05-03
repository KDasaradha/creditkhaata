const express = require('express');
const router = express.Router();
const {
  getCustomers,
  getCustomerById,
  addCustomer,
  updateCustomer,
  deleteCustomer,
} = require('../controllers/customerController');
const { protect } = require('../middleware/authMiddleware'); // Import auth middleware

// Apply protect middleware to all routes in this file
router.use(protect);

// @route   GET /api/customers
// @desc    Get all customers for logged-in user
// @access  Private
router.get('/', getCustomers);

// @route   GET /api/customers/:id
// @desc    Get single customer by ID
// @access  Private
router.get('/:id', getCustomerById);

// @route   POST /api/customers
// @desc    Add a new customer
// @access  Private
router.post('/', addCustomer);

// @route   PUT /api/customers/:id
// @desc    Update a customer
// @access  Private
router.put('/:id', updateCustomer);

// @route   DELETE /api/customers/:id
// @desc    Delete a customer
// @access  Private
router.delete('/:id', deleteCustomer);


module.exports = router;
