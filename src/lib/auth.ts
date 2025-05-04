
'use client'; // Mark functions intended for client-side use

import { jwtDecode } from 'jwt-decode';
import Cookies from 'js-cookie'; // Import js-cookie for easier cookie management client-side

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api'; // Use port 3000 as Next.js default
const TOKEN_KEY = 'credikhaata_token'; // Key for both localStorage and cookie
const COOKIE_OPTIONS = {
    // secure: process.env.NODE_ENV === 'production', // Enable in production if using HTTPS
    // sameSite: 'strict', // Recommended for security
    path: '/',
    // Note: Cookie expiry is now primarily controlled by the backend (maxAge/expires)
};


interface DecodedToken {
  id: string;
  email: string;
  iat: number;
  exp: number;
}

// --- Client-Side Token Management (Cookie + LocalStorage) ---

/**
 * Stores the JWT token in both localStorage and an HttpOnly cookie (set by the server).
 * This client-side function mainly manages the localStorage copy for easier access
 * by client components, while relying on the server-set cookie for middleware/API auth.
 * @param token The JWT token string.
 */
export function storeTokenClientSide(token: string): void {
  if (typeof window !== 'undefined') {
    try {
        localStorage.setItem(TOKEN_KEY, token);
        console.log('Token stored in localStorage successfully.');
    } catch (error) {
         console.error('Failed to store token in localStorage:', error);
         // Optionally, inform the user or trigger alternative flow
    }
    // We no longer set the cookie client-side here, assuming the server sets an HttpOnly cookie.
    // Cookies.set(TOKEN_KEY, token, COOKIE_OPTIONS);
  } else {
      console.warn('storeTokenClientSide called outside of browser environment.');
  }
}

/**
 * Retrieves the JWT token, primarily checking localStorage for client-side use.
 * @returns The token string or null if not found.
 */
export function getTokenClientSide(): string | null {
   if (typeof window === 'undefined') return null;
   const token = localStorage.getItem(TOKEN_KEY);
   // We don't check cookies here as the HttpOnly cookie isn't accessible via JS.
   // Middleware relies on the browser sending the cookie automatically.
//    console.log(`getTokenClientSide called, returning from localStorage: ${token ? 'token found' : 'no token'}`);
   return token || null;
}


/**
 * Removes the token from localStorage. The HttpOnly cookie is managed by the server
 * (e.g., by setting an expired cookie on logout or via middleware).
 */
export function removeTokenClientSide(): void {
   if (typeof window !== 'undefined') {
     try {
       localStorage.removeItem(TOKEN_KEY);
       console.log('Token removed from localStorage.');
     } catch (error) {
        console.error('Failed to remove token from localStorage:', error);
     }
     // We cannot remove the HttpOnly cookie directly from JS.
     // Rely on server sending an expired cookie or middleware handling.
     // Cookies.remove(TOKEN_KEY, { path: '/' }); // Remove this line
   } else {
       console.warn('removeTokenClientSide called outside of browser environment.');
   }
}

/**
 * Decodes the JWT token stored in localStorage.
 * @returns The decoded token payload or null if token is invalid or missing.
 */
export function getDecodedTokenClientSide(): DecodedToken | null {
   const token = getTokenClientSide();
   if (token) {
       try {
           const decoded = jwtDecode<DecodedToken>(token);
           console.log('Token decoded successfully:', decoded);
           return decoded;
       } catch (error) {
           console.error('Failed to decode token from localStorage:', error);
           removeTokenClientSide(); // Remove invalid token from localStorage
           return null;
       }
   }
   console.log('No token found in localStorage to decode.');
   return null;
}

/**
 * Checks if the token stored in localStorage is expired.
 * @returns True if the token is expired or missing, false otherwise.
 */
export function isTokenExpiredClientSide(): boolean {
   const decoded = getDecodedTokenClientSide();
   if (decoded && decoded.exp) {
       const isExpired = decoded.exp < Date.now() / 1000;
    //    console.log(`isTokenExpiredClientSide check: ${isExpired ? 'Expired' : 'Valid'} (Expiry: ${new Date(decoded.exp * 1000).toLocaleString()})`);
       return isExpired;
   }
//    console.log('isTokenExpiredClientSide check: No token or expiry info, assuming expired.');
   return true; // No token or no expiry means it's effectively expired/invalid
}

// --- API Interaction ---

export async function login(email: string, password: string): Promise<boolean> {
  console.log(`Attempting login for email: ${email}`);
  try {
    console.log(`Sending login request to: ${API_URL}/auth/login`);
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    console.log(`Login API response status: ${response.status}`);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Login failed - could not parse error JSON' }));
      console.error('Login API request failed:', response.status, errorData);
      throw new Error(errorData.message || `Login failed with status ${response.status}`);
    }

    // Log the raw response body for inspection
    const responseBodyText = await response.text();
    console.log('Login API response body (raw):', responseBodyText);

    let data;
    try {
        data = JSON.parse(responseBodyText); // Manually parse after logging
        console.log('Login API response data (parsed):', data);
    } catch (parseError) {
        console.error('Failed to parse login API response JSON:', parseError);
        throw new Error('Login failed: Invalid response format from server.');
    }


    // Check specifically for the token in the response body
    // The backend might send the token in the body for localStorage storage,
    // even if it also sets an HttpOnly cookie.
    if (data && data.token) {
      console.log('Token found in API response body.');
      // The server sets the HttpOnly cookie. We store the body token in localStorage.
      storeTokenClientSide(data.token);
       // Verify token immediately after storing
       if (isAuthenticated()) {
            console.log('Token verified successfully immediately after login.');
            return true; // Success
        } else {
             console.error('Login succeeded according to API, but token validation failed immediately after storing.');
             // Consider removing the invalid token if validation fails right away
             removeTokenClientSide();
             throw new Error("Authentication succeeded, but token validation failed.");
        }
    } else {
        // If the API was successful (status 200) but no token in body,
        // it might rely *only* on the HttpOnly cookie.
        // This scenario is harder to verify directly from JS.
        // We might assume success if status is 200 OK, but it's less certain.
        console.warn('Login API response OK, but no token found in the response body. Relying on HttpOnly cookie.');
        // Let's tentatively return true, but be aware this isn't fully verifiable here.
        // The subsequent page load/navigation and middleware check will be the real test.
        // You could try decoding any token from localStorage *again* here as a sanity check,
        // but if the backend *only* set HttpOnly, localStorage would be empty.
         const checkTokenAgain = getTokenClientSide();
         if (checkTokenAgain) {
             console.log("Token found in localStorage after API call (unexpectedly?), proceeding as success.");
             return true;
         } else {
             console.warn("No token in localStorage after supposed successful login. Frontend cannot fully confirm success without body token.");
             // Decide how to handle this. Returning true relies on the cookie working.
             // Returning false might be safer if you expect a body token.
             // Let's return false for now to match the original error behavior.
             throw new Error("Login response OK, but no token received for client-side confirmation.");
             // return true; // Alternative: Assume cookie was set and proceed
         }
    }
  } catch (error) {
    console.error('Login API error in catch block:', error);
    if (error instanceof Error) { throw error; }
    throw new Error('An unknown error occurred during login.');
  }
}

export async function register(email: string, password: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

     if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Registration failed' }));
       if (response.status === 400 && errorData.message?.toLowerCase().includes('email is already registered')) {
         throw new Error('Email already registered.');
       } else if (response.status === 400) {
           throw new Error(errorData.message || 'Invalid registration data.');
       }
       throw new Error(errorData.message || `Registration failed with status ${response.status}`);
     }
    // No token stored on registration, user needs to login separately
    return true;
  } catch (error) {
    console.error('Register API error:', error);
     if (error instanceof Error) { throw error; }
     throw new Error('An unknown error occurred during registration.');
  }
}

/**
 * Clears the client-side token (localStorage) and initiates redirection.
 * Relies on the server/middleware to clear the HttpOnly cookie.
 * @param router - The Next.js router instance for redirection.
 * @param sessionExpired - Optional flag to indicate if logout is due to expiry.
 */
export function logout(router: any, sessionExpired = false): void { // Accept router instance
   console.log(`logout function called (sessionExpired: ${sessionExpired})`);
   removeTokenClientSide(); // Removes from localStorage

   // Perform client-side redirect to login
   const redirectUrl = sessionExpired ? '/login?sessionExpired=true' : '/login';
   // Use replace to prevent going back to the dashboard after logout
   router.replace(redirectUrl);
   console.log(`Redirecting to ${redirectUrl}`);

   // Optionally, trigger a request to a backend logout endpoint if you need server-side cleanup
   // This endpoint should clear the HttpOnly cookie by setting its expiry to the past.
   fetch(`${API_URL}/auth/logout`, { method: 'POST', headers: getAuthHeaders() })
      .then(res => console.log('Backend logout request sent, status:', res.status))
      .catch(err => console.error('Error sending backend logout request:', err));
}


// Function to get auth headers for protected API calls (uses localStorage token)
export function getAuthHeaders(): HeadersInit {
    const token = getTokenClientSide();
    return token ? { 'Authorization': `Bearer ${token}` } : {};
}

// Function to check authentication status client-side (uses localStorage token)
export function isAuthenticated(): boolean {
    const hasToken = !!getTokenClientSide();
    const isExpired = isTokenExpiredClientSide();
    // console.log(`isAuthenticated check (client): hasToken=${hasToken}, isExpired=${isExpired}`);
    return hasToken && !isExpired;
}
