require('dotenv').config(); // Load environment variables first
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

// Connect Database
connectDB();

const app = express();

// Init Middleware
app.use(cors()); // Enable CORS for all origins (adjust for production)
app.use(express.json({ extended: false })); // Allow app to accept JSON data

// Define Routes
app.get('/', (req, res) => res.send('CrediKhaata API Running'));
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/customers', require('./routes/customerRoutes'));
app.use('/api/loans', require('./routes/loanRoutes'));
app.use('/api/repayments', require('./routes/repaymentRoutes'));
app.use('/api/summary', require('./routes/summaryRoutes')); // Summary routes

// Global Error Handler (Optional but recommended)
app.use((err, req, res, next) => {
  console.error(err.stack);
  // Send a generic error message in production, or detailed in development
  const statusCode = res.statusCode !== 200 ? res.statusCode : 500;
  res.status(statusCode).send({
     message: err.message || 'Something broke!',
     // Only include stack trace in development
     stack: process.env.NODE_ENV === 'production' ? undefined : err.stack
  });
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
