// src/app/api/auth/register/route.ts
import { NextRequest, NextResponse } from 'next/server';
import validator from 'validator';
import connectDB from '@/lib/db';
import User from '@/models/User';
import mongoose from 'mongoose'; // Import mongoose

export async function POST(req: NextRequest) {
   try {
     await connectDB(); // Ensure database is connected
   } catch (dbError: any) {
       console.error('Database connection failed in /api/auth/register:', dbError);
       return NextResponse.json({ message: 'Server error: Could not connect to database.' }, { status: 500 });
   }

  try {
    const { email, password } = await req.json();

    // --- Input Validation ---
    const validationErrors: string[] = [];
    if (!email) validationErrors.push('Email is required');
    else if (!validator.isEmail(email)) validationErrors.push('Please provide a valid email address');

    if (!password) validationErrors.push('Password is required');
    else if (password.length < 6) validationErrors.push('Password must be at least 6 characters long');

    if (validationErrors.length > 0) {
      return NextResponse.json({ message: validationErrors.join('. ') }, { status: 400 });
    }

    // --- Check if user already exists ---
    // Use try-catch specifically for database operations
    let userExists;
    try {
        userExists = await User.findOne({ email });
    } catch (findError: any) {
         console.error('Error checking for existing user:', findError);
         return NextResponse.json({ message: 'Server error checking user existence.' }, { status: 500 });
    }

    if (userExists) {
      return NextResponse.json({ message: 'Email is already registered' }, { status: 400 }); // Changed status to 400 (Bad Request) or 409 (Conflict)
    }

    // --- Create User ---
    // Password hashing is handled by the pre-save middleware in the User model
    let newUser;
    try {
        newUser = new User({
           email,
           password, // Pass plain password, middleware will hash it
        });
        const user = await newUser.save(); // This triggers the pre-save hook

        // Don't send password back
        const userResponse = {
            _id: user._id,
            email: user.email,
            registeredAt: user.registeredAt,
        };
        // Note: No token is generated on registration, user must log in.
        return NextResponse.json(userResponse, { status: 201 });

    } catch (saveError: any) {
        console.error('Error saving new user:', saveError);
        if (saveError instanceof mongoose.Error.ValidationError) {
            // Handle Mongoose validation errors (e.g., if required fields are missing, although checked above)
            const messages = Object.values(saveError.errors).map((val: any) => val.message);
            return NextResponse.json({ message: messages.join('. ') }, { status: 400 });
        }
         if (saveError.code === 11000) { // Duplicate key error (email uniqueness constraint)
            return NextResponse.json({ message: 'Email already registered' }, { status: 400 }); // Or 409 Conflict
         }
         // Handle other potential errors during save (like DB connection drop)
         return NextResponse.json({ message: 'Server error creating user account.' }, { status: 500 });
    }


  } catch (error: any) {
    // Catch errors from req.json() or other unexpected issues
    console.error('Registration API error (outer catch):', error);
     if (error instanceof SyntaxError) {
         // Handle JSON parsing errors
         return NextResponse.json({ message: 'Invalid request format. Please provide valid JSON.' }, { status: 400 });
     }
    // Generic server error
    return NextResponse.json({ message: 'Server error during registration', error: error.message || 'Unknown error' }, { status: 500 });
  }
}

    