const mongoose = require('mongoose');
const { isAfter, startOfDay } = require('date-fns');

const LoanSchema = new mongoose.Schema({
  shopkeeper: { // Link to the User (Shopkeeper)
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  customer: { // Link to the Customer
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true,
    index: true,
  },
  description: {
    type: String,
    required: [true, 'Item description is required'],
    trim: true,
  },
  amount: { // Original loan amount
    type: Number,
    required: [true, 'Loan amount is required'],
    min: [0.01, 'Loan amount must be positive'],
  },
  balance: { // Current outstanding balance
    type: Number,
    required: true,
    min: [0, 'Balance cannot be negative'],
  },
  issueDate: {
    type: Date,
    required: [true, 'Issue date is required'],
    default: Date.now,
  },
  dueDate: {
    type: Date,
    required: [true, 'Due date is required'],
  },
  frequency: { // How often payment is expected
    type: String,
    enum: ['bi-weekly', 'monthly', 'one-time'], // Add more if needed
    required: [true, 'Payment frequency is required'],
    default: 'monthly',
  },
  interestRate: { // Optional annual interest rate percentage
    type: Number,
    min: [0, 'Interest rate cannot be negative'],
    default: 0,
  },
  graceDays: { // Optional number of days after due date before considered overdue
    type: Number,
    min: [0, 'Grace days cannot be negative'],
    default: 0,
  },
  status: {
    type: String,
    enum: ['pending', 'paid', 'overdue'],
    required: true,
    default: 'pending',
    index: true,
  },
  repayments: [{ // Embed or reference repayments (referencing is often better for flexibility)
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Repayment',
  }],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  }
}, {
  // Enable virtuals to be included in toJSON() and toObject() output
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// --- Middleware ---

// Set initial balance and status on creation
LoanSchema.pre('save', function(next) {
  if (this.isNew) {
    this.balance = this.amount; // Initial balance is the full amount
    this.status = this.calculateStatus(); // Calculate initial status
  } else {
     // If updating (e.g., balance changed due to repayment), recalculate status
     if (this.isModified('balance') || this.isModified('dueDate')) {
       this.status = this.calculateStatus();
     }
     this.updatedAt = Date.now();
  }
  next();
});

// Middleware to update `updatedAt` on findOneAndUpdate
LoanSchema.pre('findOneAndUpdate', function(next) {
  // `this` refers to the query object
  const update = this.getUpdate();
  if (update) {
      update.updatedAt = Date.now();
      // If balance or dueDate is being updated, recalculate status (more complex)
      // This might be better handled in the service layer after the update
  }
  next();
});


// --- Methods ---

// Method to calculate the current status based on balance and due date
LoanSchema.methods.calculateStatus = function() {
  if (this.balance <= 0) {
    return 'paid';
  }
  const today = startOfDay(new Date());
  let effectiveDueDate = startOfDay(this.dueDate);

  // Consider grace period if applicable
  // Note: date-fns addDays is recommended over manual date math
  // if (this.graceDays > 0) {
  //   effectiveDueDate.setDate(effectiveDueDate.getDate() + this.graceDays);
  // }
  const { addDays } = require('date-fns'); // Import here or at top
  if (this.graceDays > 0) {
      effectiveDueDate = addDays(effectiveDueDate, this.graceDays);
  }


  if (isAfter(today, effectiveDueDate)) {
    return 'overdue';
  }
  return 'pending';
};

// --- Virtuals ---
// Virtual property to check if the loan is overdue (based on current date)
LoanSchema.virtual('isOverdue').get(function() {
    // Recalculate here for real-time check, doesn't rely on stored status
    if (this.balance <= 0) return false;

    const today = startOfDay(new Date());
    let effectiveDueDate = startOfDay(this.dueDate);
    const { addDays } = require('date-fns');
    if (this.graceDays > 0) {
        effectiveDueDate = addDays(effectiveDueDate, this.graceDays);
    }
    return isAfter(today, effectiveDueDate);
});


module.exports = mongoose.model('Loan', LoanSchema);
