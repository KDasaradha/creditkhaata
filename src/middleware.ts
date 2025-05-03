
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = process.env.JWT_SECRET;
// !! IMPORTANT !! Storing JWT in cookies is necessary for middleware access.
// LocalStorage is NOT accessible server-side.
// Ensure the login function ALSO stores the token in a cookie.
const TOKEN_COOKIE_NAME = 'credikhaata_token';

async function verifyToken(token: string): Promise<boolean> {
    if (!JWT_SECRET) {
        console.error('CRITICAL: JWT_SECRET is not set in environment variables. Authentication disabled.');
        return false; // Cannot verify without secret
    }
    try {
        const secret = new TextEncoder().encode(JWT_SECRET);
        // Verify token signature and expiry (built-in)
        await jwtVerify(token, secret);
        return true;
    } catch (error: any) {
         // Log specific errors for debugging
         if (error.code === 'ERR_JWT_EXPIRED') {
             console.log('Token expired.');
         } else if (error.code === 'ERR_JWS_INVALID') {
            console.warn('Invalid token structure or signature.');
         } else {
            console.error('Token verification failed:', error.message);
         }
        return false; // Invalid token (expired, wrong signature, etc.)
    }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Define public paths (accessible without login)
  const publicPaths = ['/login', '/register'];

   // Define API paths that handle authentication
   const authApiPaths = ['/api/auth/login', '/api/auth/register'];

  // Allow Next.js internal requests and static files
   if (pathname.startsWith('/_next/') || pathname.includes('.') || pathname === '/favicon.ico') {
     return NextResponse.next();
   }

   // Allow authentication API calls
   if (authApiPaths.some(path => pathname.startsWith(path))) {
        return NextResponse.next();
   }

   // Get token from cookie
   const token = request.cookies.get(TOKEN_COOKIE_NAME)?.value;
   let isTokenValid = false;

   if (token) {
       isTokenValid = await verifyToken(token);
   }


   // Handle redirects for logged-in users accessing public pages
   if (isTokenValid && publicPaths.includes(pathname)) {
     console.log(`Middleware: Redirecting logged-in user from ${pathname} to /dashboard`);
     return NextResponse.redirect(new URL('/dashboard', request.url));
   }

   // Handle access control for protected routes
   if (!publicPaths.includes(pathname) && pathname !== '/') { // Protect all other routes except root
     if (!isTokenValid) {
       console.log(`Middleware: Redirecting unauthenticated user from ${pathname} to /login`);
       const loginUrl = new URL('/login', request.url);
       loginUrl.searchParams.set('redirect', pathname); // Keep original path
        if (token) { // If a token existed but was invalid (e.g., expired)
            loginUrl.searchParams.set('sessionExpired', 'true');
        }
       // Clear invalid/expired cookie
       const response = NextResponse.redirect(loginUrl);
       if (token) {
            response.cookies.set(TOKEN_COOKIE_NAME, '', { maxAge: -1 }); // Expire the cookie
       }
       return response;
     }
   }

   // Special handling for root path ('/')
   if (pathname === '/') {
        if (isTokenValid) {
             return NextResponse.rewrite(new URL('/dashboard', request.url)); // Show dashboard content at root URL
        } else {
             return NextResponse.redirect(new URL('/login', request.url)); // Redirect root to login if not authenticated
        }
   }


  // If authenticated or accessing a public path, allow request
  return NextResponse.next();
}

// Configuration for middleware matching paths
export const config = {
    matcher: [
      /*
       * Match all request paths except for the ones starting with:
       * - _next/static (static files)
       * - _next/image (image optimization files)
       * - favicon.ico (favicon file)
       * - Anything containing a '.' (likely a file asset)
       *
       * BUT explicitly include '/', '/login', '/register', '/dashboard/:path*'
       * and '/api/:path*' that are not auth APIs.
       */
      '/((?!_next/static|_next/image|favicon.ico|.*\\.).*)',
      '/', // Match root specifically
    ],
};
