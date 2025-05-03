// src/app/api/loans/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db';
import Loan, { ILoan } from '@/models/Loan'; // Import ILoan interface
import Repayment from '@/models/Repayment'; // Import Repayment model for delete check
import { getUserIdFromRequest } from '@/lib/server-utils';
import { isAfter, parseISO, isValid } from 'date-fns'; // Import necessary date-fns functions

interface Params {
    params: { id: string };
}

// Helper function to handle database connection errors
async function ensureDbConnection() {
    try {
        await connectDB();
    } catch (dbError: any) {
        console.error('Database connection failed in /api/loans/[id]:', dbError);
        throw new Error('Server error: Could not connect to database.'); // Throw specific error
    }
}

// GET a single loan by ID
export async function GET(req: NextRequest, { params }: Params) {
   let userId;
  try {
     // Authenticate and connect to DB
    userId = await getUserIdFromRequest(req);
    await ensureDbConnection();
    const { id } = params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return NextResponse.json({ message: 'Invalid loan ID format' }, { status: 400 });
    }

    // Fetch loan and populate related data
    const loan = await Loan.findById(id)
                           .populate('customer', 'name phone address') // Populate customer details
                           .populate({ // Populate repayments, sorted by date descending
                               path: 'repayments',
                               options: { sort: { 'date': -1 } } // Or createdAt: -1
                           })
                           .lean(); // Use lean for potentially better performance

    if (!loan) {
      return NextResponse.json({ message: 'Loan not found' }, { status: 404 });
    }

    // Check ownership (Important!)
    // Convert ObjectId to string for comparison
    if (loan.shopkeeper.toString() !== userId) {
       console.warn(`Unauthorized attempt: User ${userId} tried to access loan ${id} owned by ${loan.shopkeeper.toString()}`);
      return NextResponse.json({ message: 'Not authorized to view this loan' }, { status: 403 });
    }

    // Note: Instance methods like `calculateStatus` are not available on lean objects.
    // If status calculation is complex or relies on methods, fetch without `.lean()`.
    // For simple cases, calculate status manually if needed based on lean object data.
     // const currentStatus = calculateLoanStatus(loan); // Manual calculation if needed
     // loan.status = currentStatus;


    return NextResponse.json(loan);

  } catch (error: any) {
     console.error(`GET Loan ${params?.id || 'invalid ID'} API error:`, error);
      // Handle specific errors
     if (error.message.startsWith('Not authorized')) {
         return NextResponse.json({ message: error.message }, { status: 401 });
     }
     if (error.message.includes('Could not connect to database')) {
          return NextResponse.json({ message: error.message }, { status: 503 }); // Service Unavailable
     }
      if (error instanceof mongoose.Error.CastError && error.path === '_id') {
         return NextResponse.json({ message: 'Invalid loan ID format' }, { status: 400 });
     }
     if (error instanceof mongoose.Error) { // Catch other Mongoose errors during find/populate
        console.error('Mongoose error fetching loan details:', error);
        return NextResponse.json({ message: 'Database error fetching loan details.' }, { status: 500 });
     }
     // Generic error
     return NextResponse.json({ message: 'Server error fetching loan details', error: error.message || 'Unknown error' }, { status: 500 });
  }
}

// PUT (update) a loan by ID
export async function PUT(req: NextRequest, { params }: Params) {
   let userId;
  try {
     // Authenticate and connect to DB
    userId = await getUserIdFromRequest(req);
    await ensureDbConnection();
    const { id } = params;

     if (!mongoose.Types.ObjectId.isValid(id)) {
        return NextResponse.json({ message: 'Invalid loan ID format' }, { status: 400 });
    }

    const body = await req.json();
    // Destructure only the fields that are allowed to be updated
    const { description, dueDate, frequency, interestRate, graceDays } = body;

    // Find existing loan (without lean(), as we need instance methods/middleware)
    let loan = await Loan.findById(id);

    if (!loan) {
      return NextResponse.json({ message: 'Loan not found' }, { status: 404 });
    }

    // Check ownership
    if (loan.shopkeeper.toString() !== userId) {
      console.warn(`Unauthorized attempt: User ${userId} tried to update loan ${id} owned by ${loan.shopkeeper.toString()}`);
      return NextResponse.json({ message: 'Not authorized to update this loan' }, { status: 403 });
    }

     // --- Build update object & Validate ---
     const updateFields: Partial<Pick<ILoan, 'description' | 'dueDate' | 'frequency' | 'interestRate' | 'graceDays'>> = {};
     const validationErrors: string[] = [];

     if (description !== undefined) {
         if (typeof description !== 'string' || description.trim().length === 0) validationErrors.push('Description cannot be empty.');
         else updateFields.description = description.trim();
     }
      if (frequency !== undefined) {
         if (!['one-time', 'bi-weekly', 'monthly'].includes(frequency)) validationErrors.push('Invalid frequency value.');
         else updateFields.frequency = frequency;
      }

     if (dueDate !== undefined) {
          const parsedDueDate = parseISO(dueDate); // Use parseISO for robust ISO string parsing
          if (!isValid(parsedDueDate)) {
              validationErrors.push('Invalid date format for dueDate. Please use ISO 8601 format.');
          } else if (isAfter(loan.issueDate, parsedDueDate)) { // Ensure dueDate is not before issueDate
              validationErrors.push('Due date cannot be before the issue date.');
          } else {
              updateFields.dueDate = parsedDueDate;
          }
     }

     if (interestRate !== undefined) {
         const numInterest = Number(interestRate);
         if (isNaN(numInterest) || numInterest < 0) {
             validationErrors.push('Interest rate must be a non-negative number.');
         } else {
             updateFields.interestRate = numInterest;
         }
     }

     if (graceDays !== undefined) {
         const numGraceDays = Number(graceDays); // Use Number() which handles integers and potentially floats before validation
         if (!Number.isInteger(numGraceDays) || numGraceDays < 0) {
             validationErrors.push('Grace days must be a non-negative integer.');
         } else {
             updateFields.graceDays = numGraceDays;
         }
     }

      if (validationErrors.length > 0) {
          return NextResponse.json({ message: validationErrors.join(' ') }, { status: 400 });
      }

      // Check if there are any fields to update
      if (Object.keys(updateFields).length === 0) {
          return NextResponse.json({ message: 'No valid fields provided for update.' }, { status: 400 });
      }


    // --- Perform Update ---
    // Apply the changes to the Mongoose document
    Object.assign(loan, updateFields);

    // The pre-save middleware in the Loan model will recalculate status if needed and update `updatedAt`
    const updatedLoan = await loan.save(); // This triggers validation and middleware

    // Populate customer details for the response
    const populatedLoan = await Loan.findById(updatedLoan._id)
                                      .populate('customer', 'name phone')
                                      .lean(); // Use lean for the final response


    return NextResponse.json(populatedLoan);

  } catch (error: any) {
     console.error(`PUT Loan ${params?.id || 'invalid ID'} API error:`, error);
      // Handle specific errors
     if (error.message.startsWith('Not authorized')) {
         return NextResponse.json({ message: error.message }, { status: 401 });
     }
      if (error.message.includes('Could not connect to database')) {
           return NextResponse.json({ message: error.message }, { status: 503 }); // Service Unavailable
      }
      if (error instanceof SyntaxError) { // JSON parsing error
         return NextResponse.json({ message: 'Invalid request body format.' }, { status: 400 });
     }
     if (error instanceof mongoose.Error.ValidationError) { // Mongoose validation error during save
        const messages = Object.values(error.errors).map((val: any) => val.message);
        return NextResponse.json({ message: messages.join('. ') }, { status: 400 });
     }
     if (error instanceof mongoose.Error.CastError) { // Invalid data type during find or update
          return NextResponse.json({ message: `Invalid data type provided for field ${error.path}. Expected ${error.kind}.` }, { status: 400 });
     }
     // Generic error
     return NextResponse.json({ message: 'Server error updating loan', error: error.message || 'Unknown error' }, { status: 500 });
  }
}


// DELETE a loan by ID
export async function DELETE(req: NextRequest, { params }: Params) {
   let userId;
  try {
     // Authenticate and connect to DB
    userId = await getUserIdFromRequest(req);
    await ensureDbConnection();
    const { id } = params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return NextResponse.json({ message: 'Invalid loan ID format' }, { status: 400 });
    }

    // Find loan first to check ownership
    const loan = await Loan.findById(id);

    if (!loan) {
      return NextResponse.json({ message: 'Loan not found' }, { status: 404 });
    }

    // Check ownership
    if (loan.shopkeeper.toString() !== userId) {
      console.warn(`Unauthorized attempt: User ${userId} tried to delete loan ${id} owned by ${loan.shopkeeper.toString()}`);
      return NextResponse.json({ message: 'Not authorized to delete this loan' }, { status: 403 });
    }

    // ** Deletion Policy Check **
     // Check if any repayments exist for this loan before allowing deletion
     const repaymentCount = await Repayment.countDocuments({ loan: id, shopkeeper: userId });
     if (repaymentCount > 0) {
          console.log(`Deletion prevented: Loan ${id} has ${repaymentCount} associated repayments.`);
         // Option 1: Prevent deletion if repayments exist
         return NextResponse.json({ message: `Cannot delete a loan with ${repaymentCount} repayment(s). Consider archiving or voiding features if needed.` }, { status: 400 }); // 400 Bad Request

         // Option 2: Delete associated repayments (use with extreme caution, generally not recommended for financial data)
         // await Repayment.deleteMany({ loan: id, shopkeeper: userId });
         // console.warn(`Deleted ${repaymentCount} repayments associated with loan ${id} during loan deletion.`);
     }
     // Add other checks if needed (e.g., prevent deleting non-zero balance loans?)

    // Perform delete
    const deleteResult = await Loan.findByIdAndDelete(id);

     if (!deleteResult) {
         // Should ideally not happen if initial findById succeeded, but handle race conditions
         console.warn(`Loan ${id} not found during delete operation, possibly deleted already.`);
         return NextResponse.json({ message: 'Loan not found during delete operation' }, { status: 404 });
     }

     console.log(`Loan ${id} deleted successfully by user ${userId}.`);
    return NextResponse.json({ message: 'Loan removed successfully' });

  } catch (error: any) {
      console.error(`DELETE Loan ${params?.id || 'invalid ID'} API error:`, error);
      // Handle specific errors
      if (error.message.startsWith('Not authorized')) {
          return NextResponse.json({ message: error.message }, { status: 401 });
      }
       if (error.message.includes('Could not connect to database')) {
           return NextResponse.json({ message: error.message }, { status: 503 }); // Service Unavailable
       }
       if (error instanceof mongoose.Error.CastError && error.path === '_id') {
         return NextResponse.json({ message: 'Invalid loan ID format' }, { status: 400 });
     }
        if (error instanceof mongoose.Error) { // Catch other Mongoose errors during count/delete
            console.error('Mongoose error during loan delete operation:', error);
            return NextResponse.json({ message: 'Database error during delete operation.' }, { status: 500 });
       }
      // Generic error
      return NextResponse.json({ message: 'Server error deleting loan', error: error.message || 'Unknown error' }, { status: 500 });
  }
}

    