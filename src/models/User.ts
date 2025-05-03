// src/models/User.ts
import mongoose, { Schema, Document, Model } from 'mongoose';
import bcrypt from 'bcryptjs';

// Interface representing a document in MongoDB.
export interface IUser extends Document {
  email: string;
  password?: string; // Optional because it's excluded by default and during hashing
  registeredAt: Date;
  // Method declaration for Mongoose instance methods
  correctPassword(candidatePassword: string, userPassword?: string): Promise<boolean>;
}

// Interface representing the static methods of the model.
export interface IUserModel extends Model<IUser> {
  // Define static methods here if needed in the future
}

const UserSchema: Schema<IUser, IUserModel> = new Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    // Basic email validation using Mongoose match
    match: [/\S+@\S+\.\S+/, 'Please use a valid email address.'],
    index: true, // Index for faster queries
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters long'],
    select: false, // Don't return password by default when querying User documents
  },
  registeredAt: {
    type: Date,
    default: Date.now,
  },
});

// Password hashing middleware - Runs before saving a new document
UserSchema.pre<IUser>('save', async function (next) {
  // Only run this function if password was actually modified (or is new)
  if (!this.isModified('password') || !this.password) {
    return next(); // Skip hashing if password isn't modified or is missing
  }

  // Hash the password with cost factor 12
   try {
     this.password = await bcrypt.hash(this.password, 12);
     next();
   } catch (error: any) {
     // Pass error to Mongoose error handling
     console.error('Error hashing password:', error);
     next(error);
   }

});

// Instance method to compare candidate password with the user's password hash
// Note: The 'userPassword' parameter might be undefined if '+password' wasn't selected in the query.
UserSchema.methods.correctPassword = async function (
  candidatePassword: string,
  userPassword?: string // The hashed password, potentially retrieved from the database
): Promise<boolean> {

    let hashToCompare = userPassword;

    // If userPassword wasn't passed (meaning it wasn't selected in the initial query), fetch it now.
    if (!hashToCompare) {
        console.log(`Password not selected for user ${this.email}, fetching now for comparison.`);
        const userWithPassword = await mongoose.model<IUser>('User').findById(this._id).select('+password').lean(); // Use lean for plain object
        if (!userWithPassword || !userWithPassword.password) {
            // Handle case where user or password cannot be retrieved
            console.error(`Could not retrieve password hash for user ${this.email} for comparison.`);
            return false;
        }
        hashToCompare = userWithPassword.password;
    }

    // Ensure candidatePassword is a string and hashToCompare is available
    if (typeof candidatePassword !== 'string' || !hashToCompare) {
        console.error(`Invalid input for password comparison: candidate type=${typeof candidatePassword}, hash available=${!!hashToCompare}`);
        return false;
    }

    // Perform the comparison
    try {
         const isMatch = await bcrypt.compare(candidatePassword, hashToCompare);
        //  console.log(`Password comparison result for ${this.email}: ${isMatch}`);
         return isMatch;
    } catch (compareError) {
        console.error(`Error during bcrypt comparison for user ${this.email}:`, compareError);
        return false; // Return false on comparison error
    }
};


// Prevent recompilation of model if it already exists
const User = (mongoose.models.User as IUserModel || mongoose.model<IUser, IUserModel>('User', UserSchema));

export default User;

    