
// src/app/api/auth/login/route.ts
import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import validator from 'validator';
import connectDB from '@/lib/db';
import User from '@/models/User';
import mongoose from 'mongoose'; // Import mongoose

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1d'; // Default to 1 day

if (!JWT_SECRET) {
  console.error('FATAL ERROR: JWT_SECRET environment variable is not defined.');
  // Stop server start or handle appropriately in a real scenario
  // Consider throwing an error during build or startup
}

// Generate JWT
const generateToken = (id: string, email: string): string => {
  if (!JWT_SECRET) {
    console.error('JWT Secret is not configured. Cannot generate token.');
    throw new Error('JWT Secret is not configured.');
  }
  return jwt.sign({ id, email }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
};

// Function to calculate cookie expiry in seconds
const getCookieMaxAge = (expiresIn: string): number => {
  try {
    const matchDays = expiresIn.match(/^(\d+)d$/);
    const matchHours = expiresIn.match(/^(\d+)h$/);
    const matchMinutes = expiresIn.match(/^(\d+)m$/);

    if (matchDays) {
      return parseInt(matchDays[1]) * 24 * 60 * 60; // Days to seconds
    } else if (matchHours) {
      return parseInt(matchHours[1]) * 60 * 60; // Hours to seconds
    } else if (matchMinutes) {
      return parseInt(matchMinutes[1]) * 60; // Minutes to seconds
    }
    // Default: Attempt to parse as seconds or default to 1 day
    const seconds = parseInt(expiresIn);
    if (!isNaN(seconds)) return seconds;

  } catch (e) {
    console.warn("Could not parse JWT_EXPIRES_IN for cookie maxAge. Defaulting.");
  }
  return 24 * 60 * 60; // Default to 1 day in seconds
};

// Helper to add CORS headers
function addCorsHeaders(response: NextResponse): NextResponse {
  response.headers.set('Access-Control-Allow-Origin', '*'); // Adjust for production
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  response.headers.set('Access-Control-Allow-Credentials', 'true');
  return response;
}

export async function OPTIONS(req: NextRequest) {
  const response = new NextResponse(null, { status: 204 });
  return addCorsHeaders(response);
}


export async function POST(req: NextRequest) {
  console.log('Login API endpoint hit');
  try {
    await connectDB();
    console.log('Database connected successfully');
  } catch (dbError: any) {
    console.error('Database connection failed in /api/auth/login:', dbError);
    let response = NextResponse.json({ message: 'Server error: Could not connect to database.' }, { status: 503 });
    return addCorsHeaders(response);
  }

  try {
    const { email, password } = await req.json();
    console.log(`Received login attempt for email: ${email}`);

    // Basic validation
    if (!email || !password) {
      console.log('Validation failed: Missing email or password');
      let response = NextResponse.json({ message: 'Please provide email and password' }, { status: 400 });
      return addCorsHeaders(response);
    }
    if (!validator.isEmail(email)) {
      console.log('Validation failed: Invalid email format');
      let response = NextResponse.json({ message: 'Please provide a valid email address' }, { status: 400 });
      return addCorsHeaders(response);
    }

    // Fetch user, explicitly selecting the password field which is usually excluded
    console.log('Fetching user from database...');
    const user = await User.findOne({ email }).select('+password');

    if (!user || !user.password) {
      console.log(`Login attempt failed for email: ${email}. User not found or password missing.`);
      let response = NextResponse.json({ message: 'Invalid email or password' }, { status: 401 });
      return addCorsHeaders(response);
    }
    console.log(`User found: ${user.email}`);

    // Verify password using the instance method from the User model
    console.log('Verifying password...');
    const isMatch = await user.correctPassword(password, user.password);
    console.log(`Password verification result: ${isMatch}`);

    if (!isMatch) {
      console.log(`Login attempt failed for email: ${email}. Password mismatch.`);
      let response = NextResponse.json({ message: 'Invalid email or password' }, { status: 401 });
      return addCorsHeaders(response);
    }

    console.log(`Login successful for email: ${email}.`);

    // Generate token
    let token: string;
    try {
      token = generateToken(user._id.toString(), user.email);
      console.log('JWT token generated successfully.');
    } catch (tokenError: any) {
      console.error('Error generating JWT token:', tokenError);
      let response = NextResponse.json({ message: 'Server error during authentication.' }, { status: 500 });
      return addCorsHeaders(response);
    }


    // Prepare response body - INCLUDE THE TOKEN HERE for client-side storage
    const responseBody = {
      _id: user._id,
      email: user.email,
      token: token, // Include the token in the response body
    };

    console.log('Preparing successful response...');
    let response = NextResponse.json(responseBody);

    // --- Set HttpOnly Cookie ---
    const cookieMaxAgeSeconds = getCookieMaxAge(JWT_EXPIRES_IN);

    // Set token in HTTPOnly cookie for security (middleware relies on this)
    response.cookies.set(process.env.TOKEN_COOKIE_NAME || 'credikhaata_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: cookieMaxAgeSeconds,
    });
    console.log(`Set HttpOnly cookie with maxAge: ${cookieMaxAgeSeconds} seconds.`);

    // Add CORS headers to the final response
    response = addCorsHeaders(response);
    console.log('Login successful response sent.');
    return response;

  } catch (error: any) {
    console.error('Login API error:', error);
    let response: NextResponse;
    if (error instanceof SyntaxError) {
      response = NextResponse.json({ message: 'Invalid request format. Please provide valid JSON.' }, { status: 400 });
    } else if (error instanceof mongoose.Error) {
      console.error('Mongoose error during login:', error);
      response = NextResponse.json({ message: 'Server error: Could not retrieve user data.' }, { status: 500 });
    } else {
      response = NextResponse.json({ message: 'Server error during login', error: error.message || 'Unknown error' }, { status: 500 });
    }
    return addCorsHeaders(response);
  }
}

// Add a simple logout route to clear the cookie server-side
export async function POST_LOGOUT(req: NextRequest) { // Changed name to avoid conflict, use separate endpoint or method
  console.log('Logout API endpoint hit');
  // Create a response to clear the cookie
  const response = NextResponse.json({ message: 'Logged out successfully' });

  // Set the cookie with maxAge=0 or an expiry date in the past
  response.cookies.set(process.env.TOKEN_COOKIE_NAME || 'credikhaata_token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 0, // Expire the cookie immediately
  });

  console.log('Logout cookie cleared.');
  return addCorsHeaders(response);
}

// Note: To use the POST_LOGOUT, you'd need to rename the file or handle routing differently.
// A common pattern is to have a dedicated `/api/auth/logout` route.
// For now, the clearing logic is added here for reference. The client `logout` function
// already tries to call `/api/auth/logout`. We need that route file.

