# Payment System Documentation

This document provides a comprehensive overview of the payment system architecture and implementation for the Felbastore multivendor marketplace.

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Payment Providers](#payment-providers)
3. [Payment Flow](#payment-flow)
4. [Security & Reliability Features](#security--reliability-features)
5. [Error Handling](#error-handling)
6. [Webhook Handling](#webhook-handling)
7. [API Reference](#api-reference)
8. [Frontend Components](#frontend-components)
9. [Troubleshooting](#troubleshooting)
10. [Future Improvements](#future-improvements)

## Architecture Overview

The payment system follows a clean architecture pattern with:

1. **Provider Abstraction Layer**: Common interface for all payment methods with normalized responses
2. **Idempotent Transaction Processing**: Prevents duplicate payments
3. **Asynchronous Payment Workflow**: Supports both direct and webhook-based payment confirmations
4. **Cart-Payment Integrity**: Server-side recalculation of totals to prevent tampering
5. **Comprehensive Error Handling**: Robust error recovery and logging

The system is designed around the following key principles:
- **Separation of concerns**: Payment processing is isolated from business logic
- **Provider agnosticism**: Easy to add new payment providers
- **Robust error handling**: Payment failures are handled gracefully
- **Audit logging**: All payment operations are logged for tracking

## Payment Providers

### Supported Payment Methods

1. **Stripe** (Card Payments)
   - Credit/Debit cards processing
   - Uses Stripe Elements for secure collection of card details
   - Supports synchronous and asynchronous confirmation via webhooks

2. **M-Pesa** (Mobile Money)
   - Mobile money integration for African markets
   - Initiates STK push to customer phone
   - Asynchronous confirmation via callbacks

### Provider Implementation

All payment providers implement a common interface:

```typescript
interface PaymentProvider {
  id: string;                // Unique identifier for the provider
  name: string;              // User-friendly name
  isAvailable: () => boolean; // Checks if provider is configured and available
  createPaymentIntent: (params: CreatePaymentIntent) => Promise<PaymentResponse>;
  verifyPayment: (paymentId: string) => Promise<PaymentVerifyResponse>;
  handleCallback?: (data: any) => Promise<PaymentVerifyResponse>;
}
```

This allows for consistent handling of different payment methods across the application.

## Payment Flow

### 1. Order Creation

1. Customer completes checkout form with shipping & billing information
2. System creates an order record with status `pending`
3. Order items are created and linked to the order
4. Cart is validated and totals recalculated server-side

### 2. Payment Intent Creation

1. Based on selected payment method, a payment intent is created
2. For Stripe: Creates a PaymentIntent with idempotency key
3. For M-Pesa: Initiates an STK push request to customer's phone
4. Payment intent ID is stored with the order

### 3. Payment Authorization

1. Customer authorizes payment (enters card details or confirms on phone)
2. Frontend UI shows waiting state during processing
3. System validates payment with provider

### 4. Payment Confirmation

Two paths for confirmation:

**Synchronous (Frontend):**
1. Frontend receives confirmation from payment provider
2. API call is made to update order status
3. Inventory is updated and notifications sent

**Asynchronous (Webhooks):**
1. Provider sends webhook/callback to our server
2. System verifies the webhook authenticity
3. Order status is updated based on payment result
4. Inventory is updated and notifications sent

### 5. Order Completion

1. Order status is updated to `confirmed`
2. Inventory is reduced by purchased quantities
3. Low stock alerts generated if needed
4. Notifications sent to both customer and vendors
5. Customer is redirected to success page

## Security & Reliability Features

### Idempotency

- **Idempotency Keys**: Used for all payment operations to prevent duplicate processing
- **Transaction Tokens**: Each payment attempt gets a unique token
- **Duplicate Detection**: Webhooks are checked for duplicate processing

### Data Integrity

- **Server-Side Validation**: Order totals recalculated before payment to prevent tampering
- **Database Transactions**: Used to ensure atomic operations (payment status + inventory updates)

### Security Measures

- **No Card Data Storage**: Card details never touch our servers (uses Stripe Elements)
- **Webhook Signatures**: All webhooks are verified using cryptographic signatures
- **HTTPS Only**: All payment communications use secure connections
- **Environment Variables**: Sensitive credentials stored in environment variables only

## Error Handling

The payment system implements comprehensive error handling at multiple levels:

### Payment Initiation Errors

- Connection failures to payment providers
- Invalid payment details
- Configuration errors

### Processing Errors

- Payment declined by provider
- Timeout during processing
- Insufficient funds

### System Recovery

- **Abandoned Carts**: Ability to resume payment from orders page
- **Failed Payments**: Notifications for retry with alternate methods
- **Partial Payments**: Support for handling partial payment scenarios

## Webhook Handling

### Stripe Webhooks

- Endpoint: `/api/payment/stripe/webhook`
- Secured with Stripe signing secret
- Handles payment successes, failures, and disputes

### M-Pesa Callbacks

- Endpoint: `/api/payment/mpesa/callback`
- Validates request source
- Processes STK push results

## API Reference

### Payment Creation

```
POST /api/payment/create
```

**Request Body:**
```json
{
  "orderId": "order_123",
  "paymentMethod": "stripe|mpesa",
  "returnUrl": "https://example.com/success"
}
```

**Response:**
```json
{
  "success": true,
  "paymentId": "pi_123456",
  "clientSecret": "pi_123456_secret_789",
  "status": "PENDING",
  "message": "Payment initiated"
}
```

### Payment Verification

```
POST /api/payment/verify
```

**Request Body:**
```json
{
  "paymentId": "pi_123456",
  "paymentMethod": "stripe|mpesa"
}
```

**Response:**
```json
{
  "success": true,
  "status": "SUCCESS",
  "orderId": "order_123",
  "orderNumber": "ORD-123456",
  "paymentStatus": "paid"
}
```

### Order Status Update

```
PUT /api/orders/:id/payment
```

**Request Body:**
```json
{
  "paymentIntentId": "pi_123456",
  "paymentStatus": "paid|failed"
}
```

## Frontend Components

### 1. PaymentMethodSelector

Provides a UI for selecting different payment methods:
- Renders available payment options
- Handles selection and displays relevant payment forms

### 2. CheckoutForm (Stripe)

Renders Stripe Elements for card payments:
- Securely collects card information
- Handles payment submission and authorization
- Shows loading states and error messages

### 3. MpesaPaymentForm

Handles M-Pesa mobile money payments:
- Collects phone number
- Initiates STK push
- Shows status updates and verification

### 4. Payment Recovery

For abandoned carts or failed payments:
- Allows resuming payment from orders page
- Pre-populates order information
- Handles verification of order ownership

## Troubleshooting

### Common Issues and Solutions

1. **Payment Not Processing**
   - Check network connectivity
   - Verify payment provider credentials
   - Ensure webhook endpoints are accessible

2. **Webhook Failures**
   - Verify webhook signatures
   - Check endpoint URLs in provider dashboard
   - Ensure correct API versions

3. **Order Status Discrepancies**
   - Check payment provider dashboard for transaction status
   - Verify webhook logs for missed callbacks
   - Check database for transaction records

### Debugging

- All payment operations include comprehensive logging
- Check server logs for entries with these prefixes:
  - `[Payment]` - General payment operations
  - `[Stripe]` - Stripe-specific operations
  - `[MPesa]` - M-Pesa specific operations
  - `[Webhook]` - Webhook processing

## Future Improvements

1. **Additional Payment Methods**
   - PayPal integration
   - Bank transfer options
   - Cryptocurrency payments

2. **Enhanced Features**
   - Subscription payment support
   - Split payments for multi-vendor orders
   - Automated reconciliation process

3. **Performance Optimizations**
   - Caching of payment provider status
   - Background processing for webhook handling
   - Rate limiting for payment attempts

---

## Development Guidelines

When extending the payment system:

1. Create a new provider implementation in `src/lib/payments/[provider]-provider.ts`
2. Implement the `PaymentProvider` interface
3. Register the provider in `src/lib/payments/index.ts`
4. Create webhook/callback handlers if needed
5. Update the frontend to support the new payment method

All modifications should maintain the separation of concerns and follow the established patterns for error handling, logging, and security.
