# CrediKhaata - Loan Tracker (Full-Stack Next.js App)

This is a full-stack web application for the CrediKhaata loan tracking system, built with Next.js (App Router), TypeScript, Tailwind CSS, Shadcn UI, and MongoDB.

## Features

- **Shopkeeper Authentication:** Secure registration and login using JWT.
- **Customer Management:** Add, view, edit, and delete customer profiles with details like name, phone, address, trust score, and credit limit.
- **Loan Management:** Record credit sales (loans) with details like amount, due dates, frequency, interest, and grace periods. Track loan status (pending, paid, overdue).
- **Repayment Tracking:** Log full or partial repayments, automatically updating loan balances.
- **Dashboard Summary:** View key metrics like total loaned, collected, outstanding balance, and overdue amounts.
- **Overdue Loan Tracking:** Easily identify and manage loans past their due date.
- **Modern UI:** Built with Tailwind CSS and Shadcn UI components for a clean and responsive user experience.

## Tech Stack

- **Framework:** Next.js (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **UI Components:** Shadcn UI
- **Database:** MongoDB with Mongoose
- **Authentication:** JWT (using `jose` for verification, `jsonwebtoken` for signing if needed in API routes, `bcryptjs` for hashing)
- **Date Handling:** date-fns
- **Client-side State/API:** React Hooks (useState, useEffect, useCallback), Fetch API

## Getting Started

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd credikhaata-next # Or your project directory name
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    # or
    yarn install
    # or
    pnpm install
    ```
3.  **Set up environment variables:**
    Create a `.env.local` file in the root directory and add the following variables (replace placeholders with actual values):

    ```dotenv
    # Database Connection
    MONGODB_URI=<your_mongodb_connection_string>

    # JWT Secret (MUST be a strong, unique key - at least 32 characters)
    # Generate one using: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
    JWT_SECRET=<your_super_secret_jwt_key_that_is_at_least_32_chars_long>

    # JWT Expiry (Optional, defaults to '1d' in auth logic if not set)
    # Examples: '1d', '7d', '1h', '30m'
    JWT_EXPIRES_IN=1d

    # Next.js API Base URL (for client-side fetch calls)
    # Should point to your running application's API base
    NEXT_PUBLIC_API_URL=http://localhost:3000/api

    # Optional: Node Environment
    # NODE_ENV=development
    ```
    **Important:**
    *   Replace `<your_mongodb_connection_string>` with your actual MongoDB connection URI (make sure your IP is whitelisted if using Atlas).
    *   Replace `<your_super_secret_jwt_key_that_is_at_least_32_chars_long>` with a strong secret.

4.  **Run the development server:**
    ```bash
    npm run dev
    # or
    yarn dev
    # or
    pnpm dev
    ```
    The application will be available at `http://localhost:3000`.

## Project Structure

- `src/app/`: Main application routes (using App Router).
    - `(auth)/`: Route group for login/register pages.
    - `dashboard/`: Protected routes for the main application dashboard.
        - `layout.tsx`: Layout specifically for the dashboard section (includes sidebar, header).
        - `page.tsx`: Dashboard overview page.
        - `customers/`: Customer management pages.
        - `loans/`: Loan management pages.
        - `summary/`: Business summary page.
    - `api/`: API routes handled by Next.js Route Handlers.
        - `auth/`: Authentication endpoints.
        - `customers/`: Customer CRUD endpoints.
        - `loans/`: Loan CRUD endpoints.
        - `repayments/`: Repayment endpoints.
        - `summary/`: Summary data endpoint.
    - `globals.css`: Global styles and Tailwind directives.
    - `layout.tsx`: Root layout for the entire application.
- `src/components/`: Reusable UI components.
    - `layout/`: Components like Sidebar, Header.
    - `ui/`: Shadcn UI components.
- `src/lib/`: Utility functions, constants, helpers.
    - `auth.ts`: Authentication logic (token handling, API calls, validation).
    - `db.ts`: Database connection logic (Mongoose).
    - `utils.ts`: General utility functions (like `cn` from Shadcn).
- `src/models/`: Mongoose schema definitions (User, Customer, Loan, Repayment).
- `src/middleware.ts`: Next.js middleware for authentication checks and redirects.
- `public/`: Static assets.
- `.env.local`: Environment variables (ignored by git).
- `next.config.mjs`: Next.js configuration.
- `tailwind.config.ts`: Tailwind CSS configuration.
- `tsconfig.json`: TypeScript configuration.

## API Endpoints (Handled by Next.js API Routes)

The backend logic previously handled by Express is now integrated within the Next.js application under `src/app/api/`.

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/customers`
- `POST /api/customers`
- `GET /api/customers/[id]`
- `PUT /api/customers/[id]`
- `DELETE /api/customers/[id]`
- `POST /api/loans`
- `GET /api/loans`
- `GET /api/loans/overdue`
- `GET /api/loans/[id]`
- `PUT /api/loans/[id]`
- `DELETE /api/loans/[id]`
- `POST /api/repayments`
- `GET /api/repayments`
- `GET /api/repayments/loan/[loanId]`
- `GET /api/summary`

All API routes (except `/api/auth/register` and `/api/auth/login`) are protected and require a valid JWT Bearer token passed in the `Authorization` header. The frontend automatically handles this using the `getAuthHeaders` utility function.
