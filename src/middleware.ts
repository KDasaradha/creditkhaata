
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = process.env.JWT_SECRET;
const TOKEN_COOKIE_NAME = 'credikhaata_token'; // Ensure this matches the cookie name set on login

async function verifyToken(token: string): Promise<boolean> {
    if (!JWT_SECRET) {
        console.error('CRITICAL: JWT_SECRET is not set in environment variables for middleware verification.');
        return false; // Cannot verify without secret
    }
    try {
        const secret = new TextEncoder().encode(JWT_SECRET);
        await jwtVerify(token, secret);
        // console.log('Middleware: Token verified successfully.');
        return true; // Token is valid (signature and expiry)
    } catch (error: any) {
         if (error.code === 'ERR_JWT_EXPIRED') {
             console.log('Middleware: Token expired.');
         } else if (error.code === 'ERR_JWS_INVALID' || error.code === 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED') {
            console.warn('Middleware: Invalid token structure or signature.');
         } else {
            console.error('Middleware: Token verification failed:', error.message);
         }
        return false; // Invalid token
    }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requestHeaders = new Headers(request.headers); // For potentially adding headers

  // 1. Define Public Paths (accessible without login)
  const publicPaths = ['/login', '/register'];

  // 2. Define API paths related to authentication (should generally be accessible)
  const authApiPaths = ['/api/auth/login', '/api/auth/register'];

  // 3. Allow Next.js internal requests and static assets
   if (
       pathname.startsWith('/_next/') ||
       pathname.startsWith('/static/') || // Adjust if you use a different static folder name
       pathname.includes('.') || // Generally allows files with extensions (images, css, etc.)
       pathname === '/favicon.ico'
   ) {
       // console.log(`Middleware: Allowing asset/internal path: ${pathname}`);
       return NextResponse.next();
   }

   // 4. Allow Authentication API Calls
   if (authApiPaths.some(path => pathname.startsWith(path))) {
       // console.log(`Middleware: Allowing auth API path: ${pathname}`);
       return NextResponse.next();
   }

   // 5. Get token from the cookie (Primary source for middleware)
   const token = request.cookies.get(TOKEN_COOKIE_NAME)?.value;
   let isTokenValid = false;

   if (token) {
       isTokenValid = await verifyToken(token);
   } else {
       // console.log('Middleware: No token cookie found.');
   }

   const isAccessingPublicPath = publicPaths.includes(pathname);
   const isAccessingRoot = pathname === '/';

    // 6. Handle Redirects for Logged-in Users accessing Public Pages
    if (isTokenValid && (isAccessingPublicPath || isAccessingRoot)) {
        const targetUrl = new URL('/dashboard', request.url);
        console.log(`Middleware: Redirecting logged-in user from ${pathname} to ${targetUrl.pathname}`);
        return NextResponse.redirect(targetUrl);
    }

    // 7. Handle Access Control for Protected Routes (Non-public, Non-root)
    if (!isAccessingPublicPath && !isAccessingRoot) {
        if (!isTokenValid) {
            const loginUrl = new URL('/login', request.url);
            loginUrl.searchParams.set('redirect', pathname); // Remember where the user was going
            if (token) { // If a token existed but was invalid (e.g., expired)
                loginUrl.searchParams.set('sessionExpired', 'true');
                console.log(`Middleware: Redirecting to login (session expired) from protected path: ${pathname}`);
            } else {
                console.log(`Middleware: Redirecting to login (no valid token) from protected path: ${pathname}`);
            }

            // Clear the invalid/expired cookie by setting maxAge to -1
            const response = NextResponse.redirect(loginUrl);
            if (token) {
                response.cookies.set(TOKEN_COOKIE_NAME, '', { path: '/', maxAge: -1 });
            }
            return response;
        }
        // If token IS valid, allow access to the protected route
         // console.log(`Middleware: Allowing access to protected path: ${pathname}`);
    }

    // 8. Handle Root Path ('/') for Unauthenticated Users (redirects to login)
    // (Logged-in users accessing root are handled in step 6)
    if (isAccessingRoot && !isTokenValid) {
        const loginUrl = new URL('/login', request.url);
        console.log(`Middleware: Redirecting unauthenticated user from root to login.`);
        return NextResponse.redirect(loginUrl);
    }


  // 9. If none of the above conditions caused a redirect, allow the request to proceed.
  // This covers:
  // - Unauthenticated users accessing public paths.
  // - Authenticated users accessing protected paths (after verification).
  // console.log(`Middleware: Allowing request to proceed for path: ${pathname}`);
  return NextResponse.next({
      request: {
        // Pass request headers
        headers: requestHeaders,
      },
  });
}

// Configuration for middleware matching paths
export const config = {
    matcher: [
      /*
       * Match all request paths except for the ones starting with:
       * - _next/static (static files)
       * - _next/image (image optimization files)
       * - favicon.ico (favicon file)
       * - Specific files likely containing extensions (e.g., .png, .jpg) - handled by pathname.includes('.') check above
       *
       * Match root ('/'), public paths, dashboard paths, and API paths.
       */
      '/',
      '/login',
      '/register',
      '/dashboard/:path*',
      '/api/:path*', // Match all API routes - specific checks happen inside middleware
       // The general matcher below helps catch edge cases but might be too broad if not careful.
       // '/((?!_next/static|_next/image|favicon.ico).*)',
    ],
};
