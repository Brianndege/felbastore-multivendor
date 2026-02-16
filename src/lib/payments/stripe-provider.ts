import Stripe from 'stripe';
import {
  PaymentProvider,
  CreatePaymentIntent,
  PaymentResponse,
  PaymentVerifyResponse
} from './types';

// Server-side Stripe instance
const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-11-20.acacia",
});

export const StripePaymentProvider: PaymentProvider = {
  id: 'stripe',
  name: 'Credit/Debit Card',

  isAvailable: () => {
    return !!process.env.STRIPE_SECRET_KEY &&
           !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  },

  createPaymentIntent: async (params: CreatePaymentIntent): Promise<PaymentResponse> => {
    try {
      const { amount, metadata, idempotencyKey } = params;

      // Convert amount to smallest currency unit (cents for USD)
      const amountInCents = Math.round(amount.total * 100);

      // Create payment intent with idempotency key to prevent duplicates
      const paymentIntent = await stripeClient.paymentIntents.create(
        {
          amount: amountInCents,
          currency: amount.currency.toLowerCase(),
          metadata: {
            orderId: metadata.orderId,
            userId: metadata.userId,
            itemCount: metadata.itemCount.toString(),
            paymentMethod: 'stripe',
            ...metadata
          },
        },
        idempotencyKey ? { idempotencyKey } : undefined
      );

      return {
        success: true,
        status: 'PENDING',
        message: 'Payment intent created',
        paymentId: paymentIntent.id,
        clientSecret: paymentIntent.client_secret,
        providerReference: paymentIntent.id
      };
    } catch (error: any) {
      console.error('[StripeProvider] Error creating payment intent:', error);

      return {
        success: false,
        status: 'FAILED',
        message: error.message || 'Failed to create payment intent',
        rawResponse: error
      };
    }
  },

  verifyPayment: async (paymentId: string): Promise<PaymentVerifyResponse> => {
    try {
      const paymentIntent = await stripeClient.paymentIntents.retrieve(paymentId);

      const isSuccessful = paymentIntent.status === 'succeeded';

      return {
        success: isSuccessful,
        status: isSuccessful ? 'SUCCESS' :
                paymentIntent.status === 'canceled' ? 'FAILED' : 'PENDING',
        message: `Payment ${isSuccessful ? 'completed' : 'not completed'}`,
        paymentId: paymentIntent.id,
        amount: paymentIntent.amount / 100, // Convert cents back to dollars
        currency: paymentIntent.currency,
        paymentMethod: 'stripe',
        providerReference: paymentIntent.id
      };
    } catch (error: any) {
      console.error('[StripeProvider] Error verifying payment:', error);

      return {
        success: false,
        status: 'FAILED',
        message: error.message || 'Failed to verify payment',
        paymentId: paymentId
      };
    }
  }
};

// Export for client-side usage
export const STRIPE_APPEARANCE = {
  theme: 'stripe',
  variables: {
    colorPrimary: '#e16b22',
    colorBackground: '#ffffff',
    colorText: '#30313d',
    colorDanger: '#df1b41',
    fontFamily: 'Ideal Sans, system-ui, sans-serif',
    borderRadius: '4px',
  }
};
