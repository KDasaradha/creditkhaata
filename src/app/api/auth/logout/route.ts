
// src/app/api/auth/logout/route.ts
import { NextRequest, NextResponse } from 'next/server';

const TOKEN_COOKIE_NAME = process.env.TOKEN_COOKIE_NAME || 'credikhaata_token';

// Helper to add CORS headers
function addCorsHeaders(response: NextResponse): NextResponse {
    // Be specific with origin in production!
    const allowedOrigin = '*'; // Replace with your frontend origin in production
    response.headers.set('Access-Control-Allow-Origin', allowedOrigin);
    response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS'); // Only POST needed for logout
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    return response;
}

export async function OPTIONS(req: NextRequest) {
  const response = new NextResponse(null, { status: 204 });
  return addCorsHeaders(response);
}

export async function POST(req: NextRequest) {
    console.log('Logout API endpoint hit');

    // Create a response to clear the cookie
    let response = NextResponse.json({ message: 'Logged out successfully' });

    // Set the cookie with maxAge=0 or an expiry date in the past
    response.cookies.set(TOKEN_COOKIE_NAME, '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: 0, // Expire the cookie immediately
        // Alternatively: expires: new Date(0) // Set expiry date to the epoch
    });

    console.log('Logout cookie cleared via API.');
    // Add CORS headers
    response = addCorsHeaders(response);
    return response;
}
