// src/app/api/webhooks/repayments/route.ts
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto'; // For signature verification (example)

// --- Mock External System ---
async function notifyExternalSystem(payload: any): Promise<boolean> {
    console.log('--- MOCK WEBHOOK RECEIVED ---');
    console.log('Payload:', JSON.stringify(payload, null, 2));
    console.log('---------------------------');
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 100));
    // Assume success for mock
    return true;
}

// --- Webhook Security (Example: HMAC Signature Verification) ---
const WEBHOOK_SECRET = process.env.REPAYMENT_WEBHOOK_SECRET || 'your_super_secret_webhook_key'; // Replace with a strong secret in .env

// Function to verify the webhook signature (adapt based on the sender's method)
function verifyWebhookSignature(req: NextRequest, rawBody: string): boolean {
    const signatureHeader = req.headers.get('x-webhook-signature'); // Example header name
    if (!signatureHeader) {
        console.warn('Webhook verification failed: Missing signature header.');
        return false;
    }

    try {
        const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
        const expectedSignature = hmac.update(rawBody).digest('hex');

        // Secure comparison to prevent timing attacks
        const signaturesMatch = crypto.timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(expectedSignature));

        if (!signaturesMatch) {
            console.warn('Webhook verification failed: Invalid signature.');
            return false;
        }
        return true;
    } catch (error) {
        console.error('Error during webhook signature verification:', error);
        return false;
    }
}

// Helper to add CORS headers - Typically less strict for webhooks, but added for consistency
function addCorsHeaders(response: NextResponse): NextResponse {
    response.headers.set('Access-Control-Allow-Origin', '*'); // Often '*' for webhooks
    response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, x-webhook-signature'); // Include signature header
    return response;
}

// Handle OPTIONS requests for CORS preflight (though less common for server-to-server webhooks)
export async function OPTIONS(req: NextRequest) {
  const response = new NextResponse(null, { status: 204 });
  return addCorsHeaders(response);
}


// POST /api/webhooks/repayments - Receive notifications about repayments
export async function POST(req: NextRequest) {
    let response: NextResponse;

    try {
        // 1. Read the raw body for signature verification
        const rawBody = await req.text(); // Read body as text first

        // 2. Verify Signature (Implement proper security based on the webhook sender)
        // if (!verifyWebhookSignature(req, rawBody)) {
        //     response = NextResponse.json({ message: 'Unauthorized: Invalid signature.' }, { status: 401 });
        //     return addCorsHeaders(response);
        // }
         console.warn('Webhook signature verification is disabled/mocked. Enable for production!'); // Remove this line in production


        // 3. Parse the JSON payload after verification
        let payload;
        try {
            payload = JSON.parse(rawBody);
        } catch (e) {
            response = NextResponse.json({ message: 'Invalid JSON payload.' }, { status: 400 });
            return addCorsHeaders(response);
        }

        // 4. Validate Payload Structure (Basic Example)
        if (!payload.loanId || !payload.amount || !payload.date) {
            response = NextResponse.json({ message: 'Missing required fields in payload (loanId, amount, date).' }, { status: 400 });
            return addCorsHeaders(response);
        }

        // 5. Process the Webhook Payload (Mock Implementation)
        // In a real app:
        // - Find the corresponding loan in your DB.
        // - Verify the repayment doesn't already exist.
        // - Create a new Repayment record.
        // - Update the Loan balance and status.
        // - Potentially trigger other actions (e.g., send confirmation).
        const processingSuccess = await notifyExternalSystem(payload);

        if (processingSuccess) {
            response = NextResponse.json({ message: 'Webhook received and processed successfully.' });
        } else {
            // If processing failed, return a 500 error so the sender might retry
            response = NextResponse.json({ message: 'Webhook received but failed during internal processing.' }, { status: 500 });
        }

    } catch (error: any) {
        console.error('POST /api/webhooks/repayments error:', error);
        // Avoid revealing too much detail in error responses for webhooks
        response = NextResponse.json({ message: 'Server error handling webhook.' }, { status: 500 });
    }

    return addCorsHeaders(response);
}