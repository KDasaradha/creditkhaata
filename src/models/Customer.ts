// src/models/Customer.ts
import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import validator from 'validator'; // Use validator for more specific checks if needed

/**
 * Represents a Customer document in MongoDB.
 * Contains details about the shopkeeper's customers, including contact info,
 * trust score, and credit limit.
 */
export interface ICustomer extends Document {
  /** Reference to the User (Shopkeeper) who owns this customer record. */
  shopkeeper: Types.ObjectId;
  /** Full name of the customer. */
  name: string;
  /** Customer's primary phone number (used for identification and communication). */
  phone: string;
  /** Optional: Customer's physical address. */
  address?: string;
  /** Optional: General notes about the customer. */
  notes?: string;
  /**
   * A score from 0 to 10 indicating the shopkeeper's trust level in the customer.
   * Can be manually set or automatically adjusted based on repayment history.
   */
  trustScore: number;
  /** The maximum amount of credit the shopkeeper is willing to extend to this customer. */
  creditLimit: number;
  /** Timestamp when the customer record was created. */
  createdAt: Date;
  /** Timestamp when the customer record was last updated. */
  updatedAt: Date;
}

// Interface representing the static methods of the Customer model (currently none).
export interface ICustomerModel extends Model<ICustomer> {
    // Define static methods here if needed
}

const CustomerSchema: Schema<ICustomer, ICustomerModel> = new Schema({
  shopkeeper: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true, // Index for efficient querying by shopkeeper
  },
  name: {
    type: String,
    required: [true, 'Customer name is required'],
    trim: true,
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    trim: true,
    validate: {
      validator: function(v: string) {
        // Basic validation for 10-digit Indian mobile numbers (starting 6-9)
        return /^[6-9]\d{9}$/.test(v.replace(/\s+/g, ''));
      },
      message: (props: { value: string }) => `${props.value} is not a valid 10-digit mobile number!`
    },
    // Compound index for uniqueness per shopkeeper can be added if strict uniqueness is required:
    // index: { unique: true, partialFilterExpression: { phone: { $type: "string" } } }
  },
  address: {
    type: String,
    trim: true,
    default: '',
  },
  notes: { // Added notes field schema definition
    type: String,
    trim: true,
    default: '',
  },
  trustScore: {
    type: Number,
    min: [0, 'Trust score cannot be less than 0'],
    max: [10, 'Trust score cannot be more than 10'],
    default: 5,
     validate: { // Ensure it's an integer or reasonable decimal if needed
       validator: (v: number) => Number.isInteger(v) || (v % 1 === 0.5), // Allow integers or .5 steps
       message: 'Trust score must be a whole or half number between 0 and 10.'
     }
  },
  creditLimit: {
    type: Number,
    min: [0, 'Credit limit cannot be negative'],
    default: 0,
  },
}, {
  timestamps: true // Use Mongoose built-in timestamps
});

// Example of a compound index for unique phone number per shopkeeper
// CustomerSchema.index({ shopkeeper: 1, phone: 1 }, { unique: true });


const Customer = (mongoose.models.Customer as ICustomerModel || mongoose.model<ICustomer, ICustomerModel>('Customer', CustomerSchema));

export default Customer;
