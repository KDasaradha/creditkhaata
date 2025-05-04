// src/app/api/loans/[id]/receipt/route.ts
import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import PDFDocument from 'pdfkit'; // Using pdfkit for PDF generation
import { WritableStream } from 'stream'; // Node.js stream

import connectDB from '@/lib/db';
import Loan from '@/models/Loan';
import Repayment from '@/models/Repayment';
import Customer from '@/models/Customer';
import User from '@/models/User'; // To get shopkeeper details
import { getUserIdFromRequest } from '@/lib/server-utils';
import { format } from 'date-fns';

interface Params {
    params: { id: string }; // Loan ID
}

// Helper function to handle database connection errors
async function ensureDbConnection() {
    try {
        await connectDB();
    } catch (dbError: any) {
        console.error('Database connection failed in /api/loans/[id]/receipt:', dbError);
        throw new Error('Server error: Could not connect to database.');
    }
}

// Helper to add CORS headers
function addCorsHeaders(response: NextResponse): NextResponse {
    response.headers.set('Access-Control-Allow-Origin', '*'); // Adjust for production
    response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    // Add headers needed for file download
    response.headers.set('Access-Control-Expose-Headers', 'Content-Disposition, Content-Type');
    return response;
}

// Handle OPTIONS requests for CORS preflight
export async function OPTIONS(req: NextRequest) {
  const response = new NextResponse(null, { status: 204 });
  return addCorsHeaders(response);
}


// Helper to format currency for PDF
const formatCurrency = (amount: number): string => {
    return `Rs. ${Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// GET /api/loans/:id/receipt - Generate PDF receipt for the latest repayment (or specified repayment)
export async function GET(req: NextRequest, { params }: Params) {
    let userId;
    let response: NextResponse;

    try {
        userId = await getUserIdFromRequest(req);
        await ensureDbConnection();
        const shopkeeperObjectId = new mongoose.Types.ObjectId(userId);
        const { id: loanId } = params; // Loan ID from URL

        if (!mongoose.Types.ObjectId.isValid(loanId)) {
             response = NextResponse.json({ message: 'Invalid loan ID format' }, { status: 400 });
             return addCorsHeaders(response);
        }
        const loanObjectId = new mongoose.Types.ObjectId(loanId);

        // Fetch loan, customer, shopkeeper (user), and the latest repayment
        const loan = await Loan.findOne({ _id: loanObjectId, shopkeeper: shopkeeperObjectId }).lean();
        if (!loan) {
             response = NextResponse.json({ message: 'Loan not found or not authorized' }, { status: 404 });
             return addCorsHeaders(response);
        }

        const customer = await Customer.findById(loan.customer).lean();
        if (!customer) {
             response = NextResponse.json({ message: 'Customer associated with loan not found' }, { status: 404 });
             return addCorsHeaders(response);
        }

        const shopkeeper = await User.findById(shopkeeperObjectId).select('email').lean(); // Fetch shopkeeper email
        if (!shopkeeper) {
            response = NextResponse.json({ message: 'Shopkeeper details not found' }, { status: 404 });
            return addCorsHeaders(response);
        }


        // Fetch the *latest* repayment for this loan
        const latestRepayment = await Repayment.findOne({ loan: loanObjectId, shopkeeper: shopkeeperObjectId })
                                            .sort({ date: -1 }) // Get the most recent one
                                            .lean();

        if (!latestRepayment) {
             response = NextResponse.json({ message: 'No repayments found for this loan to generate a receipt.' }, { status: 400 });
             return addCorsHeaders(response);
        }

        // --- Generate PDF ---
        const doc = new PDFDocument({ margin: 50, size: 'A5' }); // Use A5 for a smaller receipt
        const buffers: Buffer[] = [];

        // Pipe PDF content to buffer
        doc.on('data', buffers.push.bind(buffers));


        // --- PDF Content ---
        // Header
        doc.fontSize(18).font('Helvetica-Bold').text('Payment Receipt', { align: 'center' });
        doc.fontSize(10).font('Helvetica').text(`Shopkeeper: ${shopkeeper.email}`, { align: 'center' });
        doc.moveDown(2);

        // Receipt Details Table-like Structure
        const detailStartY = doc.y;
        const labelX = 50;
        const valueX = 170;
        const lineGap = 15;

        doc.fontSize(11).font('Helvetica-Bold');
        doc.text('Receipt No:', labelX, detailStartY);
        doc.text('Date:', labelX, detailStartY + lineGap);
        doc.moveDown(0.5);
        doc.text('Customer:', labelX, doc.y);
        doc.text('Loan Desc:', labelX, doc.y + lineGap);
        doc.moveDown(0.5);
        doc.text('Amount Paid:', labelX, doc.y);
        doc.text('Payment Date:', labelX, doc.y + lineGap);
        doc.moveDown(0.5);
        doc.text('Original Loan:', labelX, doc.y);
        doc.text('Remaining Bal:', labelX, doc.y + lineGap);


        doc.font('Helvetica'); // Switch back to regular font for values
        doc.text(`${latestRepayment._id.toString().slice(-6)}`, valueX, detailStartY); // Short ID
        doc.text(`${format(new Date(), 'PPP')}`, valueX, detailStartY + lineGap); // Receipt generation date

        doc.text(`${customer.name} (${customer.phone})`, valueX, detailStartY + (lineGap * 2.5));
        doc.text(`${loan.description}`, valueX, detailStartY + (lineGap * 3.5));

        doc.font('Helvetica-Bold').text(`${formatCurrency(latestRepayment.amount)}`, valueX, detailStartY + (lineGap * 5));
        doc.font('Helvetica').text(`${format(latestRepayment.date, 'PPP')}`, valueX, detailStartY + (lineGap * 6));

        doc.text(`${formatCurrency(loan.amount)} (Issued: ${format(loan.issueDate, 'dd/MM/yy')})`, valueX, detailStartY + (lineGap * 7.5));
        doc.font('Helvetica-Bold').text(`${formatCurrency(loan.balance)}`, valueX, detailStartY + (lineGap * 8.5));

        // Footer
        doc.moveDown(3);
        doc.fontSize(9).text('Thank you for your payment!', { align: 'center' });
        doc.text('Generated by CrediKhaata', { align: 'center' });


        // Finalize the PDF and end the stream
        doc.end();

        // --- Create Response ---
        // Wait for the stream to finish writing to the buffer
        return new Promise<void>((resolve) => {
            doc.on('end', () => {
                const pdfData = Buffer.concat(buffers);
                response = new NextResponse(pdfData, {
                    status: 200,
                    headers: {
                        'Content-Type': 'application/pdf',
                        'Content-Disposition': `attachment; filename="receipt-${loanId}-${latestRepayment._id.toString().slice(-6)}.pdf"`
                    },
                });
                 // Add CORS headers before resolving
                 addCorsHeaders(response);
                resolve();
            });
             doc.on('error', (err) => {
                 console.error("Error generating PDF:", err);
                 response = NextResponse.json({ message: 'Failed to generate PDF receipt.' }, { status: 500 });
                 // Add CORS headers before resolving
                 addCorsHeaders(response);
                 resolve(); // Resolve even on error to send the error response
             });

        }).then(() => response); // Return the response after the promise resolves


    } catch (error: any) {
        console.error('GET /api/loans/[id]/receipt error:', error);
        if (error.message.startsWith('Not authorized')) {
            response = NextResponse.json({ message: error.message }, { status: 401 });
        } else if (error.message.includes('Could not connect to database')) {
            response = NextResponse.json({ message: error.message }, { status: 503 });
        } else {
            response = NextResponse.json({ message: 'Server error generating receipt.', error: error.message || 'Unknown error' }, { status: 500 });
        }
        return addCorsHeaders(response);
    }
}