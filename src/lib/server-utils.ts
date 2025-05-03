// src/lib/server-utils.ts
import { NextRequest } from 'next/server';
import { jwtVerify, JWTPayload } from 'jose';

const JWT_SECRET = process.env.JWT_SECRET;

interface UserPayload extends JWTPayload {
    id: string; // Assuming your JWT payload has an 'id' field for the user ID
    email?: string;
}


/**
 * Verifies the JWT token from the Authorization header and returns the user ID.
 * Throws an error if the token is missing, invalid, or expired.
 * Intended for use in Next.js API Route Handlers or Server Components accessing request headers.
 *
 * @param req - The NextRequest object.
 * @returns The user ID from the token payload.
 * @throws Error if authentication fails.
 */
export async function getUserIdFromRequest(req: NextRequest): Promise<string> {
    if (!JWT_SECRET) {
        console.error('CRITICAL: JWT_SECRET is not set. Authentication check failed.');
        throw new Error('Authentication configuration error.');
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new Error('Not authorized: No token provided.');
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
         throw new Error('Not authorized: Malformed token.');
    }

    try {
        const secret = new TextEncoder().encode(JWT_SECRET);
        const { payload } = await jwtVerify<UserPayload>(token, secret);

        if (!payload.id) {
            throw new Error('Not authorized: Invalid token payload (missing user ID).');
        }

        return payload.id; // Return the user ID

    } catch (error: any) {
        console.error('Token verification error in API route:', error.message);
        if (error.code === 'ERR_JWT_EXPIRED') {
            throw new Error('Not authorized: Token expired.');
        } else if (error.code === 'ERR_JWS_INVALID' || error.code === 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED') {
           throw new Error('Not authorized: Invalid token.');
        } else {
           throw new Error('Not authorized: Token verification failed.');
        }
    }
}
