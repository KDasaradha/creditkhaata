# CrediKhaata - Loan Tracker (Full-Stack Next.js App)

CrediKhaata is a full-stack web application designed for shopkeepers to track customer loans efficiently. It is built using a modern tech stack, including Next.js (App Router), TypeScript, Tailwind CSS, Shadcn UI, and MongoDB.

## Features

- **Shopkeeper Authentication:** Secure registration and login using JWT.
- **Customer Management:** Add, view, edit, and delete customer profiles with details like name, phone, address, trust score, and credit limit.
- **Loan Management:** Record credit sales (loans) with details like amount, description, issue/due dates, frequency, interest, and grace periods. Track loan status (pending, paid, overdue).
- **Repayment Tracking:** Log full or partial repayments, automatically updating loan balances.
- **Dashboard Summary:** View key metrics like total loaned, collected, outstanding balance, overdue amounts, and average repayment time.
- **Overdue Loan Tracking:** Easily identify and manage loans past their due date via automated status updates and dedicated views.
- **Modern UI:** Built with Tailwind CSS and Shadcn UI components for a clean, responsive, and mobile-first user experience.

## Tech Stack

This project utilizes the following technologies:

*   **Framework:** Next.js (App Router) - Handles both frontend rendering and backend API routes.
*   **Language:** TypeScript
*   **Runtime:** Node.js
*   **Database:** MongoDB with Mongoose ODM
*   **Authentication:** JWT (using `jose` for verification, `jsonwebtoken` for signing) + `bcryptjs` for password hashing.
*   **Styling:** Tailwind CSS
*   **UI Components:** Shadcn UI
*   **Date Handling:** `date-fns`
*   **API:** Next.js API Route Handlers

**(Note:** This application uses Next.js API routes for its backend logic, replacing the need for a separate Express server as originally specified in some requirements. It fulfills the objective of a Node.js-based backend.)

## Getting Started

These instructions will get you a copy of the project up and running on your local machine for development and testing purposes.

### Prerequisites

*   Node.js (v18 or later recommended)
*   npm, yarn, or pnpm package manager
*   MongoDB instance (local or cloud-based like MongoDB Atlas)

### Installation & Setup

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd credikhaata-next # Or your project directory name
    ```

2.  **Install dependencies:**
    Choose your preferred package manager:
    ```bash
    npm install
    # or
    yarn install
    # or
    pnpm install
    ```

3.  **Set up environment variables:**
    Create a `.env.local` file in the root directory of the project. Copy the contents of `.env.example` (if provided) or add the following variables, replacing placeholders with your actual values:

    ```dotenv
    # Database Connection (Required)
    # Replace with your actual MongoDB connection string.
    # Example for local MongoDB: mongodb://admin:secret123@localhost:27017/credikhaata?authSource=admin
    # Example for Atlas: mongodb+srv://<username>:<password>@<cluster-url>/credikhaata?retryWrites=true&w=majority
    MONGODB_URI=mongodb+srv://dasaradhinstade:6nv4jdptCmB5uq9C@cluster0.nlgivbo.mongodb.net/credikhaata?retryWrites=true&w=majority&appName=Cluster0

    # JWT Secret (Required)
    # MUST be a strong, unique key - at least 32 characters long.
    # Generate one using: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
    JWT_SECRET=YOUR_SUPER_SECRET_JWT_KEY_THAT_IS_AT_LEAST_32_CHARS_LONG

    # JWT Expiry (Optional, defaults to '1d' in auth logic if not set)
    # Examples: '1d', '7d', '1h', '30m'
    JWT_EXPIRES_IN=1d

    # Next.js API Base URL (Required for client-side fetch calls)
    # This should point to your running application's base URL.
    # For local development, it's usually http://localhost:3000
    NEXT_PUBLIC_API_URL=http://localhost:3000/api

    # Optional: Node Environment (usually set automatically by Next.js)
    # NODE_ENV=development
    ```
    **Important:**
    *   Ensure your MongoDB instance is running and accessible. If using a cloud service like Atlas, make sure your current IP address is whitelisted.
    *   Replace `YOUR_SUPER_SECRET_JWT_KEY_THAT_IS_AT_LEAST_32_CHARS_LONG` with a securely generated secret. **Do not commit your actual secrets to Git.**

4.  **Run the development server:**
    ```bash
    npm run dev
    # or
    yarn dev
    # or
    pnpm dev
    ```
    The application (both frontend and backend API) will start, typically available at `http://localhost:3000`.

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
        - `auth/`: Authentication endpoints (login, register).
        - `customers/`: Customer CRUD endpoints.
        - `loans/`: Loan CRUD endpoints.
        - `repayments/`: Repayment endpoints.
        - `summary/`: Summary data endpoint.
    - `globals.css`: Global styles and Tailwind CSS directives/theme.
    - `layout.tsx`: Root layout for the entire application.
- `src/components/`: Reusable UI components.
    - `layout/`: Components like Sidebar, Header.
    - `ui/`: Shadcn UI components (Button, Card, Input, etc.).
- `src/lib/`: Utility functions, constants, helpers.
    - `auth.ts`: Client-side authentication logic (token handling, API calls).
    - `db.ts`: Database connection logic (Mongoose).
    - `server-utils.ts`: Server-side utility functions (e.g., JWT verification in API routes).
    - `utils.ts`: General utility functions (like `cn` from Shadcn).
- `src/models/`: Mongoose schema definitions (User, Customer, Loan, Repayment).
- `src/middleware.ts`: Next.js middleware for authentication checks and route protection.
- `public/`: Static assets (images, etc.).
- `.env.local`: Environment variables (ignored by git).
- `next.config.mjs`: Next.js configuration.
- `tailwind.config.ts`: Tailwind CSS configuration.
- `tsconfig.json`: TypeScript configuration.
- `package.json`: Project dependencies and scripts.

## API Endpoints (Handled by Next.js API Routes)

The backend logic is integrated within the Next.js application under `src/app/api/`.

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

All API routes (except `/api/auth/register` and `/api/auth/login`) are protected and require a valid JWT Bearer token passed in the `Authorization` header. The frontend automatically handles this using the `getAuthHeaders` utility function from `src/lib/auth.ts`. Middleware (`src/middleware.ts`) enforces this protection for both API routes and protected frontend pages.
