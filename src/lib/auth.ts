
'use client'; // Mark functions intended for client-side use

import { jwtDecode } from 'jwt-decode';
import Cookies from 'js-cookie'; // Import js-cookie for easier cookie management client-side

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
const TOKEN_KEY = 'credikhaata_token'; // Key for both localStorage and cookie
const COOKIE_OPTIONS = {
    // secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
    // sameSite: 'strict', // Recommended for security
    path: '/',
    // expires: 1 // Example: expire cookie in 1 day (adjust as needed)
};


interface DecodedToken {
  id: string;
  email: string;
  iat: number;
  exp: number;
}

// --- Client-Side Token Management (Cookie + LocalStorage) ---

export function storeToken(token: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(TOKEN_KEY, token);
    Cookies.set(TOKEN_KEY, token, COOKIE_OPTIONS); // Store in cookie as well
     console.log('Token stored in localStorage and cookie.');
  }
}

export function getToken(): string | null {
  // Prefer cookie for consistency with middleware, fallback to localStorage
  let token = Cookies.get(TOKEN_KEY);
  if (!token && typeof window !== 'undefined') {
    token = localStorage.getItem(TOKEN_KEY) || undefined; // Get from localStorage if cookie missing
     if (token) {
         // If found in localStorage but not cookie, re-sync cookie (e.g., after browser restart)
         Cookies.set(TOKEN_KEY, token, COOKIE_OPTIONS);
         console.log('Token retrieved from localStorage and synced to cookie.');
     }
  }
//   console.log(`getToken called, returning: ${token ? 'token found' : 'no token'}`);
  return token || null;
}

export function removeToken(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(TOKEN_KEY);
    Cookies.remove(TOKEN_KEY, { path: '/' }); // Ensure cookie is removed correctly
    console.log('Token removed from localStorage and cookie.');
  }
}

export function getDecodedToken(): DecodedToken | null {
   // Relies on getToken which handles cookie/localStorage retrieval
   const token = getToken();
   if (token) {
       try {
           return jwtDecode<DecodedToken>(token);
       } catch (error) {
           console.error('Failed to decode token:', error);
           removeToken(); // Remove invalid token
           return null;
       }
   }
   return null;
}

export function isTokenExpired(): boolean {
   const decoded = getDecodedToken(); // Uses the token from cookie/localStorage
   if (decoded && decoded.exp) {
       const isExpired = decoded.exp < Date.now() / 1000;
    //    console.log(`isTokenExpired check: ${isExpired ? 'Expired' : 'Valid'} (Expiry: ${new Date(decoded.exp * 1000).toLocaleString()})`);
       return isExpired;
   }
//    console.log('isTokenExpired check: No token or expiry info, assuming expired.');
   return true; // No token or no expiry means it's effectively expired/invalid
}

// --- API Interaction ---

export async function login(email: string, password: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `Login failed with status ${response.status}`);
    }

    const data = await response.json();
    if (data.token) {
      storeToken(data.token); // Store in both cookie and localStorage
      return true;
    }
    return false;
  } catch (error) {
    console.error('Login API error:', error);
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
      const errorData = await response.json();
       if (response.status === 400 && errorData.message === 'User already exists') {
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

export function logout(): void {
   removeToken(); // Removes from both cookie and localStorage
   // Redirect should be handled by the component calling logout or by middleware
}

// Function to get auth headers for protected API calls
export function getAuthHeaders(): HeadersInit {
    const token = getToken(); // Gets token from cookie/localStorage
    return token ? { 'Authorization': `Bearer ${token}` } : {};
}

// Function to check authentication status client-side
export function isAuthenticated(): boolean {
    // Checks token presence AND validity (expiry)
    const hasToken = !!getToken();
    const isExpired = isTokenExpired();
    // console.log(`isAuthenticated check: hasToken=${hasToken}, isExpired=${isExpired}`);
    return hasToken && !isExpired;
}
