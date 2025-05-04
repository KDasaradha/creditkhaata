// src/models/Loan.ts
import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import { isAfter, startOfDay, addDays, isValid, parseISO } from 'date-fns'; // Use date-fns for reliable date logic

// Type alias for loan status
export type LoanStatus = 'pending' | 'paid' | 'overdue';
export type LoanFrequency = 'bi-weekly' | 'monthly' | 'one-time';

// Interface representing a Loan document in MongoDB.
export interface ILoan extends Document {
  shopkeeper: Types.ObjectId;
  customer: Types.ObjectId;
  description: string;
  amount: number;
  balance: number;
  category?: string; // Added category field
  issueDate: Date;
  dueDate: Date;
  frequency: LoanFrequency;
  interestRate: number;
  graceDays: number;
  status: LoanStatus;
  repayments: Types.ObjectId[]; // Array of Repayment ObjectIds
  createdAt: Date;
  updatedAt: Date;

  // Instance methods
  calculateStatus(): LoanStatus;

  // Virtuals (defined below schema)
  isOverdue: boolean;
}

// Interface representing the static methods of the Loan model.
export interface ILoanModel extends Model<ILoan> {
    // Define static methods here if needed
}

const LoanSchema: Schema<ILoan, ILoanModel> = new Schema({
  shopkeeper: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  customer: {
    type: Schema.Types.ObjectId,
    ref: 'Customer',
    required: true,
    index: true,
  },
  description: {
    type: String,
    required: [true, 'Loan description is required'],
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
    // Default balance will be set in pre-save middleware
  },
  category: { // Added category field schema definition
      type: String,
      trim: true,
      index: true, // Index for potential filtering by category
  },
  issueDate: {
    type: Date,
    required: [true, 'Issue date is required'],
    default: Date.now,
  },
  dueDate: {
    type: Date,
    required: [true, 'Due date is required'],
    validate: {
        validator: function(this: ILoan, value: Date) {
            // Ensure dueDate is not before issueDate
            const issueD = this.issueDate instanceof Date ? this.issueDate : parseISO(String(this.issueDate));
            const dueD = value instanceof Date ? value : parseISO(String(value));
            if (!isValid(issueD) || !isValid(dueD)) return false; // Fail if dates are invalid
            return !isAfter(issueD, dueD);
        },
        message: 'Due date cannot be before the issue date.'
    }
  },
  frequency: {
    type: String,
    enum: ['bi-weekly', 'monthly', 'one-time'],
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
    validate: { // Ensure it's an integer
      validator: Number.isInteger,
      message: '{VALUE} is not an integer value for grace days'
    }
  },
  status: {
    type: String,
    enum: ['pending', 'paid', 'overdue'],
    required: true,
    default: 'pending', // Will be calculated in pre-save
    index: true,
  },
  repayments: [{
    type: Schema.Types.ObjectId,
    ref: 'Repayment',
  }],
}, {
  // Enable virtuals to be included in JSON/object output
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
  timestamps: true // Use Mongoose built-in timestamps for createdAt/updatedAt
});

// --- Methods ---

// Method to calculate the current status based on balance and due date
LoanSchema.methods.calculateStatus = function(): LoanStatus {
  // Ensure balance is treated as a number
  const currentBalance = Number(this.balance);

  if (currentBalance <= 0) {
    return 'paid';
  }

  const today = startOfDay(new Date()); // Compare against the start of today
  const dueD = this.dueDate instanceof Date ? this.dueDate : parseISO(String(this.dueDate));
  if(!isValid(dueD)) {
      console.warn(`Loan ${this._id}: Invalid due date for status calculation.`);
      return 'pending'; // Default to pending if date is invalid
  }

  let effectiveDueDate = startOfDay(dueD); // Compare against the start of the due date

  // Apply grace days if applicable
  if (this.graceDays > 0) {
    effectiveDueDate = addDays(effectiveDueDate, this.graceDays);
  }

  // Check if today is strictly after the effective due date
  if (isAfter(today, effectiveDueDate)) {
    return 'overdue';
  }

  return 'pending';
};

// --- Middleware ---

// Set initial balance and status on creation, update status/timestamp on updates
LoanSchema.pre<ILoan>('save', function(next) {
  if (this.isNew) {
    this.balance = this.amount; // Initial balance is the full amount
  }
   // Always recalculate status on save (new or update) to ensure accuracy
   this.status = this.calculateStatus();

  next();
});


// --- Virtuals ---

// Virtual property to check if the loan is currently overdue
LoanSchema.virtual('isOverdue').get(function(this: ILoan): boolean {
    // Use the calculateStatus method logic for consistency
    return this.calculateStatus() === 'overdue';
});


// Prevent recompilation of model if it already exists
const Loan = (mongoose.models.Loan as ILoanModel || mongoose.model<ILoan, ILoanModel>('Loan', LoanSchema));

export default Loan;
