/**
 * Shared payment types for all payment providers
 */

export type PaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED';

export interface PaymentMetadata {
  orderId: string;
  userId: string;
  itemCount: number;
  paymentMethod: string;
  [key: string]: string | number | boolean;
}

export interface PaymentAmount {
  total: number;
  currency: string;
  subtotal: number;
  tax?: number;
  shipping?: number;
  discount?: number;
}

export interface CreatePaymentIntent {
  amount: PaymentAmount;
  metadata: PaymentMetadata;
  returnUrl?: string;
  idempotencyKey?: string;
}

export interface PaymentResponse {
  success: boolean;
  status: PaymentStatus;
  message: string;
  paymentId?: string;
  clientSecret?: string;
  redirectUrl?: string;
  providerReference?: string;
  rawResponse?: any;
}

export interface PaymentVerifyResponse extends PaymentResponse {
  amount?: number;
  currency?: string;
  paymentMethod?: string;
}

export interface PaymentProvider {
  id: string;
  name: string;
  isAvailable: () => boolean;
  createPaymentIntent: (params: CreatePaymentIntent) => Promise<PaymentResponse>;
  verifyPayment: (paymentId: string) => Promise<PaymentVerifyResponse>;
  handleCallback?: (data: any) => Promise<PaymentVerifyResponse>;
}

export interface PaymentRequestBody {
  orderId: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  returnUrl?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  metadata?: Record<string, string | number | boolean>;
}

export interface PaymentServiceRequest {
  amount: PaymentAmount;
  metadata: PaymentMetadata;
  paymentMethod: string;
  returnUrl?: string;
  customerInfo?: {
    name?: string;
    email?: string;
    phone?: string;
  };
  idempotencyKey?: string;
}
