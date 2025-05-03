const mongoose = require('mongoose');
const validator = require('validator');

const CustomerSchema = new mongoose.Schema({
  shopkeeper: { // Link to the User (Shopkeeper) who owns this customer
    type: mongoose.Schema.Types.ObjectId,
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
    validate: {
      validator: function(v) {
        // Basic phone number validation (allows digits, spaces, hyphens, parentheses, +)
        // Adjust regex as needed for stricter validation
        return /^[\d\s\-()+]+$/.test(v);
      },
      message: props => `${props.value} is not a valid phone number!`
    },
    // Consider adding unique constraint scoped to shopkeeper if needed
    // unique: true // Can cause issues if multiple shopkeepers have same customer phone
  },
  address: {
    type: String,
    trim: true,
  },
  trustScore: {
    type: Number,
    min: [0, 'Trust score must be between 0 and 10'],
    max: [10, 'Trust score must be between 0 and 10'],
    default: 5, // Default trust score
  },
  creditLimit: {
    type: Number,
    min: [0, 'Credit limit cannot be negative'],
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  }
});

// Middleware to update `updatedAt` timestamp on save
CustomerSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Middleware to update `updatedAt` timestamp on findOneAndUpdate
CustomerSchema.pre('findOneAndUpdate', function(next) {
  this.set({ updatedAt: Date.now() });
  next();
});


module.exports = mongoose.model('Customer', CustomerSchema);
