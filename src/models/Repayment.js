const mongoose = require('mongoose');

const RepaymentSchema = new mongoose.Schema({
  shopkeeper: { // Link to the User (Shopkeeper)
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  customer: { // Denormalized for potential direct queries, linked from Loan
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
      index: true,
  },
  loan: { // Link to the specific Loan this repayment is for
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Loan',
    required: true,
    index: true,
  },
  amount: {
    type: Number,
    required: [true, 'Repayment amount is required'],
    min: [0.01, 'Repayment amount must be positive'],
  },
  date: {
    type: Date,
    required: [true, 'Repayment date is required'],
    default: Date.now,
  },
  // Optional: Add a field for method (cash, online, etc.)
  // method: String,
  // Optional: Add a field for notes
  // notes: String,
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Ensure repayment amount doesn't exceed loan balance (best handled in controller/service layer)

module.exports = mongoose.model('Repayment', RepaymentSchema);
