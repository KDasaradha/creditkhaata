// src/models/Repayment.ts
import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import { isBefore } from 'date-fns';
import Loan from './Loan'; // Import Loan model to potentially access issueDate

// Interface representing a Repayment document in MongoDB.
export interface IRepayment extends Document {
  shopkeeper: Types.ObjectId;
  customer: Types.ObjectId;
  loan: Types.ObjectId; // Link to the Loan
  amount: number;
  date: Date;
  // Optional fields can be added here
  // method?: string;
  // notes?: string;
  createdAt: Date;
  updatedAt: Date; // Mongoose timestamps handle this
}

// Interface representing the static methods of the Repayment model.
export interface IRepaymentModel extends Model<IRepayment> {
    // Define static methods here if needed
}

const RepaymentSchema: Schema<IRepayment, IRepaymentModel> = new Schema({
  shopkeeper: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  customer: { // Denormalized from Loan for potential direct queries
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
      index: true,
  },
  loan: { // Link to the specific Loan this repayment is for
    type: Schema.Types.ObjectId,
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
    // Add validation to ensure repayment date is not before loan issue date
     validate: {
         async validator(this: IRepayment, value: Date): Promise<boolean> {
            // Need to fetch the associated loan to check its issueDate
            // Use populate or a separate query. Using `this.loan` assumes it's populated or fetched before save.
            // A cleaner approach might be validation at the controller/service layer before saving.
            try {
                // Ensure 'loan' field contains a valid ObjectId before querying
                if (!mongoose.Types.ObjectId.isValid(this.loan)) {
                    // This should ideally be caught earlier, but handle defensively
                    console.warn('Repayment validation: Invalid loan ObjectId');
                    return false; // Or throw an error specific to invalid ID
                }

                 // Fetch the loan if not already populated (careful about performance)
                 // let loanDoc = this.populated('loan') ? this.loan : await mongoose.model('Loan').findById(this.loan);

                 // A more direct way if `this.loan` holds the ObjectId
                 const loanDoc = await Loan.findById(this.loan).select('issueDate'); // Fetch only issueDate

                 if (!loanDoc) {
                     // Loan not found, validation technically passes but indicates data inconsistency
                     console.warn(`Repayment validation: Loan ${this.loan} not found.`);
                     return true; // Or false/throw depending on desired strictness
                 }
                 // Check if repayment date is before the loan's issue date
                 return !isBefore(value, loanDoc.issueDate);
             } catch (error) {
                 console.error('Error during repayment date validation:', error);
                 return false; // Fail validation on error
             }
         },
         message: 'Repayment date cannot be before the loan issue date.'
     }
  },
  // Optional fields:
  // method: { type: String, trim: true },
  // notes: { type: String, trim: true },
}, {
    timestamps: true // Automatically add createdAt and updatedAt fields
});

// Middleware (Optional): Could be used for complex checks or side effects on save/update
// RepaymentSchema.pre<IRepayment>('save', function(next) {
//   // Example: Log repayment details
//   console.log(`Saving repayment of ${this.amount} for loan ${this.loan}`);
//   next();
// });

const Repayment = (mongoose.models.Repayment as IRepaymentModel || mongoose.model<IRepayment, IRepaymentModel>('Repayment', RepaymentSchema));

export default Repayment;
