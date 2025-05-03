// src/lib/db.ts
import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('FATAL ERROR: MONGODB_URI environment variable is not defined.');
  // Throwing an error here will prevent the application from starting without a DB URI
  throw new Error(
    'Please define the MONGODB_URI environment variable inside .env.local'
  );
}

/**
 * Global is used here to maintain a cached connection across hot reloads
 * in development. This prevents connections growing exponentially
 * during API Route usage.
 */
declare global {
    // eslint-disable-next-line no-var
    var mongoose: { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null };
}

// Initialize the cache if it doesn't exist
let cached = global.mongoose;
if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function connectDB(): Promise<typeof mongoose> {
  // If a connection already exists, return it
  if (cached.conn) {
    // console.log('DB: Using cached connection.');
    return cached.conn;
  }

  // If a connection promise doesn't exist, create one
  if (!cached.promise) {
    const opts = {
      bufferCommands: false, // Disable mongoose buffering if not connected (recommended)
      // useNewUrlParser: true, // Deprecated in Mongoose 6+
      // useUnifiedTopology: true, // Deprecated in Mongoose 6+
      // Add other options like serverSelectionTimeoutMS if needed
       serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
    };

    console.log('DB: Creating new connection...');
    cached.promise = mongoose.connect(MONGODB_URI, opts)
      .then((mongooseInstance) => {
        console.log('DB: MongoDB Connected successfully.');
        // Set conn here after successful connection
        cached.conn = mongooseInstance;
        return mongooseInstance;
      })
      .catch((err: Error) => {
        console.error('DB: MongoDB connection error:', err.message);
        // Reset the promise and connection on error so the next attempt can try again
        cached.promise = null;
        cached.conn = null;
        // Propagate the error to the caller
        throw err;
      });
  }

  // Await the connection promise (either the one just created or an existing one)
  try {
     // console.log('DB: Awaiting connection promise...');
     const connection = await cached.promise;
     if (!connection) {
          // This case should theoretically not be reached if the catch block above works,
          // but added as a safeguard.
          throw new Error('DB: Connection promise resolved but connection is null.');
     }
     // console.log('DB: Connection promise resolved successfully.');
     // Ensure cached.conn is set if the promise resolved successfully but wasn't set inside .then()
     if (!cached.conn) {
         cached.conn = connection;
     }
     return connection;
  } catch (error) {
    console.error('DB: Error awaiting connection promise:', error);
    // Ensure promise is cleared on error during await
    cached.promise = null;
    cached.conn = null;
    // Re-throw the error to the caller
    throw error;
  }
}

export default connectDB;

    