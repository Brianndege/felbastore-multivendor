import { createStripePayment } from '../path/to/your/payment/module'; // adjust the path accordingly
import Stripe from 'stripe';

jest.mock('stripe');

describe('createStripePayment', () => {
    it('should create a Stripe payment successfully', async () => {
        const stripe = new Stripe('your-stripe-secret-key', { apiVersion: '2020-08-27' });

        // Mock the stripe.paymentIntents.create method
        const paymentIntentMock = jest.fn().mockResolvedValue({
            id: 'pi_123',
            status: 'succeeded',
        });

        (stripe.paymentIntents.create as jest.Mock) = paymentIntentMock;

        const paymentData = {
            amount: 1000,
            currency: 'usd',
            payment_method: 'pm_card_visa',
        };

        const response = await createStripePayment(paymentData);

        expect(paymentIntentMock).toHaveBeenCalledWith(paymentData);
        expect(response.id).toBe('pi_123');
        expect(response.status).toBe('succeeded');
    });

    it('should throw an error if payment creation fails', async () => {
        const stripe = new Stripe('your-stripe-secret-key', { apiVersion: '2020-08-27' });

        (stripe.paymentIntents.create as jest.Mock) = jest.fn().mockRejectedValue(new Error('Payment failed'));

        const paymentData = {
            amount: 1000,
            currency: 'usd',
            payment_method: 'pm_card_visa',
        };

        await expect(createStripePayment(paymentData)).rejects.toThrow('Payment failed');
    });
});
