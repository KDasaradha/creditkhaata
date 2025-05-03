// src/app/api/auth/login/route.ts
import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import validator from 'validator';
import connectDB from '@/lib/db';
import User from '@/models/User';
import mongoose from 'mongoose'; // Import mongoose

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1d';

if (!JWT_SECRET) {
    console.error('FATAL ERROR: JWT_SECRET environment variable is not defined.');
    // Potentially throw an error or handle appropriately, but the server shouldn't really run without it.
    // For now, log and proceed, but login will fail if JWT_SECRET is missing.
}

// Generate JWT
const generateToken = (id: string, email: string): string => {
    if (!JWT_SECRET) {
        console.error('JWT Secret is not configured. Cannot generate token.');
        throw new Error('JWT Secret is not configured.');
    }
  return jwt.sign({ id, email }, JWT_SECRET, { // Include email in payload if needed client-side
    expiresIn: JWT_EXPIRES_IN,
  });
};

export async function POST(req: NextRequest) {
  try {
    await connectDB(); // Ensure database is connected
  } catch (dbError: any) {
      console.error('Database connection failed in /api/auth/login:', dbError);
      return NextResponse.json({ message: 'Server error: Could not connect to database.' }, { status: 500 });
  }

  try {
    const { email, password } = await req.json();

    // Basic validation
    if (!email || !password) {
      return NextResponse.json({ message: 'Please provide email and password' }, { status: 400 });
    }
    if (!validator.isEmail(email)) {
       return NextResponse.json({ message: 'Please provide a valid email address' }, { status: 400 });
    }

    // Check for user by email, explicitly selecting password
    // Note: User model should have `select: false` on password field
    const user = await User.findOne({ email }).select('+password');

    // Check if user exists AND password field was successfully retrieved
    if (!user || !user.password) {
        console.log(`Login attempt failed for email: ${email}. User not found or password field missing.`);
        return NextResponse.json({ message: 'Invalid email or password' }, { status: 401 }); // User not found or query issue
    }

    // Check password by passing both the candidate password and the retrieved hash
    const isMatch = await user.correctPassword(password, user.password);

    if (!isMatch) {
        console.log(`Login attempt failed for email: ${email}. Password mismatch.`);
        return NextResponse.json({ message: 'Invalid email or password' }, { status: 401 }); // Password incorrect
    }

    console.log(`Login successful for email: ${email}.`);

    // Generate token
    let token: string;
    try {
         token = generateToken(user._id.toString(), user.email);
    } catch (tokenError: any) {
        console.error('Error generating JWT token:', tokenError);
        return NextResponse.json({ message: 'Server error during authentication.' }, { status: 500 });
    }


    // Return user info (excluding password) and token
    const response = NextResponse.json({
      _id: user._id,
      email: user.email,
      token: token,
    });

    // --- Set HttpOnly Cookie ---
    // Calculate expiry date for the cookie based on JWT_EXPIRES_IN
    let cookieExpires: Date | undefined;
    try {
        if (JWT_EXPIRES_IN) {
            const matchDays = JWT_EXPIRES_IN.match(/^(\d+)d$/);
            const matchHours = JWT_EXPIRES_IN.match(/^(\d+)h$/);
            const matchMinutes = JWT_EXPIRES_IN.match(/^(\d+)m$/);

            const now = Date.now();
            if (matchDays) {
                cookieExpires = new Date(now + parseInt(matchDays[1]) * 24 * 60 * 60 * 1000);
            } else if (matchHours) {
                cookieExpires = new Date(now + parseInt(matchHours[1]) * 60 * 60 * 1000);
            } else if (matchMinutes) {
                 cookieExpires = new Date(now + parseInt(matchMinutes[1]) * 60 * 1000);
            } else {
                // Default or fallback if format is unexpected (e.g., 1d)
                cookieExpires = new Date(now + 24 * 60 * 60 * 1000); // Default to 1 day
            }
        }
    } catch (e) {
        console.warn("Could not parse JWT_EXPIRES_IN for cookie expiry. Defaulting.");
        cookieExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // Default to 1 day
    }


    // Set token in HTTPOnly cookie for security (recommended)
     // The client-side code will primarily use localStorage/sessionStorage for convenience,
     // but the cookie is essential for the middleware to work reliably.
     response.cookies.set('credikhaata_token', token, {
        httpOnly: true, // Prevents client-side JavaScript access
        secure: process.env.NODE_ENV === 'production', // Only send over HTTPS in production
        sameSite: 'strict', // Mitigates CSRF attacks
        path: '/',
        expires: cookieExpires, // Set expiry based on JWT_EXPIRES_IN
     });

    return response;

  } catch (error: any) {
    console.error('Login API error:', error);
    if (error instanceof SyntaxError) {
        // Handle JSON parsing errors specifically
        return NextResponse.json({ message: 'Invalid request format. Please provide valid JSON.' }, { status: 400 });
    }
     if (error instanceof mongoose.Error) {
        // Handle potential Mongoose/database query errors during findOne
        console.error('Mongoose error during login:', error);
        return NextResponse.json({ message: 'Server error: Could not retrieve user data.' }, { status: 500 });
    }
    // Generic server error
    return NextResponse.json({ message: 'Server error during login', error: error.message || 'Unknown error' }, { status: 500 });
  }
}

    