// src/models/Customer.ts
import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import validator from 'validator'; // Use validator for more specific checks if needed

// Interface representing a Customer document in MongoDB.
export interface ICustomer extends Document {
  shopkeeper: Types.ObjectId; // Link to the User (Shopkeeper)
  name: string;
  phone: string;
  address?: string;
  notes?: string; // Added notes field
  trustScore: number;
  creditLimit: number;
  createdAt: Date;
  updatedAt: Date;
}

// Interface representing the static methods of the Customer model.
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
        // Basic validation allowing digits, spaces, hyphens, parens, +
        // Consider a more robust library or specific regex for production
        // Example for 10-digit Indian mobile numbers (adjust as needed):
        return /^[6-9]\d{9}$/.test(v.replace(/\s+/g, ''));
      },
      message: (props: { value: string }) => `${props.value} is not a valid 10-digit mobile number!`
    },
    // If you need uniqueness per shopkeeper, a compound index is better:
    // index: { unique: true, partialFilterExpression: { phone: { $type: "string" } } } // Handle carefully
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
    min: [0, 'Trust score must be between 0 and 10'],
    max: [10, 'Trust score must be between 0 and 10'],
    default: 5,
  },
  creditLimit: {
    type: Number,
    min: [0, 'Credit limit cannot be negative'],
    default: 0,
  },
}, {
  timestamps: true // Use Mongoose built-in timestamps
});

// Compound index for shopkeeper and phone for uniqueness check if desired
// CustomerSchema.index({ shopkeeper: 1, phone: 1 }, { unique: true });


const Customer = (mongoose.models.Customer as ICustomerModel || mongoose.model<ICustomer, ICustomerModel>('Customer', CustomerSchema));

export default Customer;
