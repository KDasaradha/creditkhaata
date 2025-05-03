# CrediKhaata - Loan Tracker Backend

This is a RESTful backend service for the CrediKhaata application, built with Node.js, Express, and MongoDB.

## Features

- User Authentication (JWT)
- Customer Management (CRUD)
- Loan Management (CRUD)
- Repayment Tracking
- Loan Summaries & Overdue Alerts

## Tech Stack

- Node.js
- Express.js
- MongoDB with Mongoose
- JSON Web Tokens (JWT) for authentication
- date-fns for date manipulation

## Getting Started

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd credikhaata-backend
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Set up environment variables:**
    Create a `.env` file in the root directory and add the following variables (replace placeholders with actual values):
    ```dotenv
    PORT=3001
    MONGODB_URI=<your_mongodb_connection_string>
    JWT_SECRET=<your_super_secret_jwt_key_that_is_at_least_32_chars_long>
    JWT_EXPIRES_IN=1d # Optional: Token expiry duration (e.g., 1d, 7d, 1h)
    # Optional: Set NODE_ENV to 'production' for production deployment
    # NODE_ENV=development
    ```
    **Important:**
    *   Replace `<your_mongodb_connection_string>` with your actual MongoDB connection URI.
    *   Replace `<your_super_secret_jwt_key_that_is_at_least_32_chars_long>` with a strong, unique secret key for signing JWTs. It should be at least 32 characters long. You can generate one using online tools or `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.

4.  **Run the server:**
    ```bash
    npm run dev # For development with nodemon
    # or
    npm start # For production
    ```

## API Endpoints

(Refer to the route files in `src/routes/` for details)

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/customers`
- `POST /api/customers`
- `GET /api/customers/:id`
- `PUT /api/customers/:id`
- `DELETE /api/customers/:id`
- `POST /api/loans`
- `GET /api/loans`
- `GET /api/loans/overdue`
- `GET /api/loans/:id`
- `PUT /api/loans/:id`
- `DELETE /api/loans/:id`
- `POST /api/repayments`
- `GET /api/repayments`
- `GET /api/repayments/loan/:loanId`
- `GET /api/summary`

All routes under `/api/customers`, `/api/loans`, `/api/repayments`, and `/api/summary` require authentication (Bearer Token).
