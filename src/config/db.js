const mongoose = require('mongoose');
// require('dotenv').config(); // Load environment variables - Removed, should be done in server.js

const connectDB = async () => {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    console.error('MongoDB connection error: MONGODB_URI environment variable is not defined.');
    console.error('Ensure you have a .env file in the root directory with MONGODB_URI=<your_connection_string>');
    process.exit(1); // Exit process with failure
  }

  try {
    await mongoose.connect(mongoUri);
    console.log('MongoDB Connected...');
  } catch (err) {
    // Log the specific mongoose connection error
    console.error('MongoDB connection error:', err.message);
    // Exit process with failure
    process.exit(1);
  }
};

module.exports = connectDB;
