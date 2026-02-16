import {
  PaymentProvider,
  CreatePaymentIntent,
  PaymentResponse,
  PaymentVerifyResponse
} from './types';
import crypto from 'crypto';

// M-Pesa configuration
const MPESA_CONSUMER_KEY = process.env.MPESA_CONSUMER_KEY || '';
const MPESA_CONSUMER_SECRET = process.env.MPESA_CONSUMER_SECRET || '';
const MPESA_PASSKEY = process.env.MPESA_PASSKEY || '';
const MPESA_SHORTCODE = process.env.MPESA_SHORTCODE || '';
const MPESA_CALLBACK_URL = process.env.MPESA_CALLBACK_URL || '';
const MPESA_API_URL = 'https://sandbox.safaricom.co.ke'; // Use live URL in production

// Helper functions
const generateTimestamp = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}${hours}${minutes}${seconds}`;
};

const generatePassword = (timestamp: string): string => {
  const passwordString = `${MPESA_SHORTCODE}${MPESA_PASSKEY}${timestamp}`;
  return Buffer.from(passwordString).toString('base64');
};

const getAccessToken = async (): Promise<string> => {
  try {
    const auth = Buffer.from(`${MPESA_CONSUMER_KEY}:${MPESA_CONSUMER_SECRET}`).toString('base64');

    const response = await fetch(`${MPESA_API_URL}/oauth/v1/generate?grant_type=client_credentials`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to get M-Pesa access token: ${response.statusText}`);
    }

    const data = await response.json();
    return data.access_token;
  } catch (error) {
    console.error('[MPesaProvider] Error getting access token:', error);
    throw error;
  }
};

export const MPesaPaymentProvider: PaymentProvider = {
  id: 'mpesa',
  name: 'M-Pesa',

  isAvailable: () => {
    return !!MPESA_CONSUMER_KEY &&
           !!MPESA_CONSUMER_SECRET &&
           !!MPESA_PASSKEY &&
           !!MPESA_SHORTCODE;
  },

  createPaymentIntent: async (params: CreatePaymentIntent): Promise<PaymentResponse> => {
    try {
      const { amount, metadata, idempotencyKey } = params;
      const customerPhone = metadata.customerPhone as string || '';

      if (!customerPhone || !customerPhone.match(/^2547\d{8}$/)) {
        return {
          success: false,
          status: 'FAILED',
          message: 'Valid Safaricom phone number required (format: 254XXXXXXXXX)'
        };
      }

      // Generate timestamp for this transaction
      const timestamp = generateTimestamp();
      const password = generatePassword(timestamp);

      // Get access token
      const accessToken = await getAccessToken();

      // Unique transaction reference - use the idempotencyKey if provided
      const transactionRef = idempotencyKey ||
                              `FBP${timestamp}-${Math.floor(Math.random() * 1000000)}`;

      // M-Pesa STK Push Request
      const response = await fetch(`${MPESA_API_URL}/mpesa/stkpush/v1/processrequest`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          BusinessShortCode: MPESA_SHORTCODE,
          Password: password,
          Timestamp: timestamp,
          TransactionType: 'CustomerPayBillOnline',
          Amount: Math.round(amount.total),
          PartyA: customerPhone,
          PartyB: MPESA_SHORTCODE,
          PhoneNumber: customerPhone,
          CallBackURL: `${MPESA_CALLBACK_URL}/api/payment/mpesa/callback`,
          AccountReference: `Felba-${metadata.orderId}`,
          TransactionDesc: `Order #${metadata.orderId}`
        })
      });

      const responseData = await response.json();

      if (responseData.ResponseCode === '0') {
        // Successfully initiated STK push
        return {
          success: true,
          status: 'PENDING',
          message: 'Please check your phone to complete payment',
          paymentId: responseData.CheckoutRequestID,
          providerReference: transactionRef,
          rawResponse: responseData
        };
      } else {
        // STK push initiation failed
        return {
          success: false,
          status: 'FAILED',
          message: responseData.ResponseDescription || 'Failed to initiate M-Pesa payment',
          rawResponse: responseData
        };
      }
    } catch (error: any) {
      console.error('[MPesaProvider] Error initiating payment:', error);

      return {
        success: false,
        status: 'FAILED',
        message: error.message || 'Failed to initiate M-Pesa payment'
      };
    }
  },

  verifyPayment: async (checkoutRequestId: string): Promise<PaymentVerifyResponse> => {
    try {
      // Get access token
      const accessToken = await getAccessToken();

      // Generate timestamp for this request
      const timestamp = generateTimestamp();
      const password = generatePassword(timestamp);

      const response = await fetch(`${MPESA_API_URL}/mpesa/stkpushquery/v1/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          BusinessShortCode: MPESA_SHORTCODE,
          Password: password,
          Timestamp: timestamp,
          CheckoutRequestID: checkoutRequestId
        })
      });

      const responseData = await response.json();

      if (responseData.ResponseCode === '0') {
        const resultCode = parseInt(responseData.ResultCode);

        return {
          success: resultCode === 0,
          status: resultCode === 0 ? 'SUCCESS' : 'FAILED',
          message: responseData.ResultDesc || 'Payment query completed',
          paymentId: checkoutRequestId,
          providerReference: responseData.MpesaReceiptNumber || '',
          rawResponse: responseData
        };
      } else {
        return {
          success: false,
          status: 'FAILED',
          message: responseData.ResponseDescription || 'Failed to verify M-Pesa payment',
          paymentId: checkoutRequestId,
          rawResponse: responseData
        };
      }
    } catch (error: any) {
      console.error('[MPesaProvider] Error verifying payment:', error);

      return {
        success: false,
        status: 'FAILED',
        message: error.message || 'Failed to verify M-Pesa payment',
        paymentId: checkoutRequestId
      };
    }
  },

  handleCallback: async (callbackData: any): Promise<PaymentVerifyResponse> => {
    try {
      // Extract the STK callback data
      const resultCode = callbackData.Body.stkCallback.ResultCode;
      const resultDesc = callbackData.Body.stkCallback.ResultDesc;
      const checkoutRequestId = callbackData.Body.stkCallback.CheckoutRequestID;

      if (resultCode === 0) {
        // Payment successful
        // Extract payment details from callback data
        const callbackMetadata = callbackData.Body.stkCallback.CallbackMetadata;

        // Find amount and transaction ID in the Items array
        const getItem = (name: string) => {
          const item = callbackMetadata.Item.find((i: any) => i.Name === name);
          return item ? item.Value : null;
        };

        const amount = getItem('Amount');
        const mpesaReceiptNumber = getItem('MpesaReceiptNumber');
        const transactionDate = getItem('TransactionDate');
        const phoneNumber = getItem('PhoneNumber');

        return {
          success: true,
          status: 'SUCCESS',
          message: resultDesc || 'Payment completed successfully',
          paymentId: checkoutRequestId,
          amount: amount,
          paymentMethod: 'mpesa',
          providerReference: mpesaReceiptNumber,
          rawResponse: callbackData
        };
      } else {
        // Payment failed
        return {
          success: false,
          status: 'FAILED',
          message: resultDesc || 'Payment failed',
          paymentId: checkoutRequestId,
          rawResponse: callbackData
        };
      }
    } catch (error: any) {
      console.error('[MPesaProvider] Error processing callback:', error);

      return {
        success: false,
        status: 'FAILED',
        message: error.message || 'Failed to process M-Pesa callback',
        paymentId: callbackData.Body?.stkCallback?.CheckoutRequestID || ''
      };
    }
  }
};
