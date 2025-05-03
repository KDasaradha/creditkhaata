const jwt = require('jsonwebtoken');
const User = require('../models/User');
const validator = require('validator');
require('dotenv').config();

// Generate JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '1d', // Default to 1 day
  });
};

// @desc    Register a new shopkeeper
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
  const { email, password } = req.body;

  // Basic validation
  if (!email || !password) {
    return res.status(400).json({ message: 'Please provide email and password' });
  }
  if (!validator.isEmail(email)) {
      return res.status(400).json({ message: 'Please provide a valid email address' });
  }
   if (password.length < 6) {
       return res.status(400).json({ message: 'Password must be at least 6 characters long' });
   }


  try {
    // Check if user already exists
    const userExists = await User.findOne({ email });

    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Create user
    const user = await User.create({
      email,
      password,
    });

    if (user) {
      // Don't send password back, even hashed
      const userResponse = user.toObject();
      delete userResponse.password;

      res.status(201).json({
        _id: user._id,
        email: user.email,
        token: generateToken(user._id),
      });
    } else {
      res.status(400).json({ message: 'Invalid user data' });
    }
  } catch (error) {
    console.error('Registration error:', error);
     if (error.code === 11000) { // Duplicate key error
        return res.status(400).json({ message: 'Email already registered' });
     }
    res.status(500).json({ message: 'Server error during registration', error: error.message });
  }
};

// @desc    Authenticate user & get token (Login)
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
  const { email, password } = req.body;

   // Basic validation
  if (!email || !password) {
    return res.status(400).json({ message: 'Please provide email and password' });
  }
   if (!validator.isEmail(email)) {
      return res.status(400).json({ message: 'Please provide a valid email address' });
  }

  try {
    // Check for user by email, explicitly selecting password
    const user = await User.findOne({ email }).select('+password');

    if (user && (await user.correctPassword(password, user.password))) {
      res.json({
        _id: user._id,
        email: user.email,
        token: generateToken(user._id),
      });
    } else {
      res.status(401).json({ message: 'Invalid email or password' }); // Use 401 Unauthorized
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login', error: error.message });
  }
};

// @desc    Get current user profile (Example protected route)
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
  // req.user is set by the authMiddleware
  res.status(200).json(req.user);
};


module.exports = {
  registerUser,
  loginUser,
  getMe,
};
