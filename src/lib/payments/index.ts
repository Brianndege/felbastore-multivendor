import {
  PaymentProvider,
  PaymentServiceRequest,
  PaymentResponse,
  PaymentAmount,
  PaymentMetadata,
} from './types';
import { StripePaymentProvider } from './stripe-provider';
import { MPesaPaymentProvider } from './mpesa-provider';

// Registry of available payment providers
const paymentProviders: Record<string, PaymentProvider> = {
  stripe: StripePaymentProvider,
  mpesa: MPesaPaymentProvider,
};

// Get all available payment providers
export const getAvailablePaymentProviders = (): PaymentProvider[] => {
  return Object.values(paymentProviders)
    .filter(provider => provider.isAvailable());
};

// Find a specific payment provider
export const getPaymentProvider = (providerId: string): PaymentProvider | null => {
  const provider = paymentProviders[providerId];
  return provider && provider.isAvailable() ? provider : null;
};

// Generate a unique idempotency key based on order ID and payment method
export const generateIdempotencyKey = (orderId: string, paymentMethod: string): string => {
  return `${orderId}-${paymentMethod}-${Date.now()}`;
};

// Calculate the total amount from cart items with validation
export const calculateOrderAmount = (
  items: Array<{product: {price: number | string}, quantity: number}>,
  additionalFees: {tax?: number, shipping?: number, discount?: number} = {}
): PaymentAmount => {
  // Calculate subtotal
  let subtotal = 0;

  if (!items || items.length === 0) {
    throw new Error('Cannot calculate total for empty cart');
  }

  items.forEach(item => {
    const price = typeof item.product.price === 'number'
      ? item.product.price
      : parseFloat(item.product.price.toString());

    if (isNaN(price)) {
      throw new Error(`Invalid price for product: ${JSON.stringify(item.product)}`);
    }

    if (item.quantity <= 0) {
      throw new Error(`Invalid quantity (${item.quantity}) for product`);
    }

    subtotal += price * item.quantity;
  });

  // Calculate additional fees
  const tax = additionalFees.tax || 0;
  const shipping = additionalFees.shipping || 0;
  const discount = additionalFees.discount || 0;

  // Calculate final total
  const total = subtotal + tax + shipping - discount;

  if (total <= 0) {
    throw new Error('Total amount must be greater than zero');
  }

  return {
    subtotal,
    tax,
    shipping,
    discount,
    total,
    currency: 'USD', // Default currency
  };
};

// Core payment service that handles the payment process
export const processPayment = async (
  request: PaymentServiceRequest
): Promise<PaymentResponse> => {
  const { paymentMethod, amount, metadata, returnUrl, customerInfo, idempotencyKey } = request;

  // 1. Validate the request
  if (!paymentMethod) {
    return {
      success: false,
      status: 'FAILED',
      message: 'Payment method is required'
    };
  }

  if (!amount || amount.total <= 0) {
    return {
      success: false,
      status: 'FAILED',
      message: 'Valid payment amount is required'
    };
  }

  if (!metadata || !metadata.orderId) {
    return {
      success: false,
      status: 'FAILED',
      message: 'Order ID is required in metadata'
    };
  }

  // 2. Get payment provider
  const provider = getPaymentProvider(paymentMethod);

  if (!provider) {
    return {
      success: false,
      status: 'FAILED',
      message: `Payment method '${paymentMethod}' is not available`
    };
  }

  // 3. Prepare specific metadata for the provider
  const providerMetadata: PaymentMetadata = {
    ...metadata,
    paymentMethod,
  };

  // Add customer info to metadata for providers that need it (like M-Pesa)
  if (customerInfo) {
    if (customerInfo.phone) providerMetadata.customerPhone = customerInfo.phone;
    if (customerInfo.email) providerMetadata.customerEmail = customerInfo.email;
    if (customerInfo.name) providerMetadata.customerName = customerInfo.name;
  }

  // 4. Create payment intent with the provider
  try {
    return await provider.createPaymentIntent({
      amount,
      metadata: providerMetadata,
      returnUrl,
      idempotencyKey
    });
  } catch (error: any) {
    console.error(`[PaymentService] Error processing payment with ${paymentMethod}:`, error);

    return {
      success: false,
      status: 'FAILED',
      message: error.message || `Payment processing failed with ${paymentMethod}`
    };
  }
};

// Verify payment status
export const verifyPayment = async (
  paymentId: string,
  paymentMethod: string
): Promise<PaymentResponse> => {
  const provider = getPaymentProvider(paymentMethod);

  if (!provider) {
    return {
      success: false,
      status: 'FAILED',
      message: `Payment method '${paymentMethod}' is not available`
    };
  }

  try {
    return await provider.verifyPayment(paymentId);
  } catch (error: any) {
    console.error(`[PaymentService] Error verifying payment with ${paymentMethod}:`, error);

    return {
      success: false,
      status: 'FAILED',
      message: error.message || `Payment verification failed with ${paymentMethod}`
    };
  }
};
