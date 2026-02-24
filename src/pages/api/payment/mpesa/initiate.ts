import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { prisma } from '@/lib/prisma';
import { generateTimestamp, generatePassword, formatPhoneNumber, isValidSafaricomNumber, getAccessToken, getMpesaApiUrl } from '@/lib/mpesa-utils';
import type { MpesaInitiateRequest, MpesaInitiateResponse } from '@/types/mpesa';

export default async function handler(req: NextApiRequest, res: NextApiResponse<MpesaInitiateResponse>) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session || session.user.role !== 'user') {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const { orderId, phoneNumber, amount } = req.body as MpesaInitiateRequest;

  if (!orderId || !phoneNumber || !amount) {
    return res.status(400).json({ success: false, message: 'orderId, phoneNumber, and amount are required' });
  }

  const formattedPhone = formatPhoneNumber(phoneNumber);
  if (!isValidSafaricomNumber(formattedPhone)) {
    return res.status(400).json({ success: false, message: 'Invalid Safaricom phone number. Use format: 07XXXXXXXX or 254XXXXXXXXX' });
  }

  try {
    const order = await prisma.order.findFirst({
      where: { id: orderId, userId: session.user.id },
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (order.paymentStatus === 'paid') {
      return res.status(400).json({ success: false, message: 'Order already paid' });
    }

    const shortcode = process.env.MPESA_SHORTCODE || '';
    const passkey = process.env.MPESA_PASSKEY || '';
    const callbackUrl = process.env.MPESA_CALLBACK_URL || '';
    const apiUrl = getMpesaApiUrl();

    const timestamp = generateTimestamp();
    const password = generatePassword(shortcode, passkey, timestamp);
    const accessToken = await getAccessToken();

    const stkResponse = await fetch(`${apiUrl}/mpesa/stkpush/v1/processrequest`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: Math.round(amount),
        PartyA: formattedPhone,
        PartyB: shortcode,
        PhoneNumber: formattedPhone,
        CallBackURL: callbackUrl,
        AccountReference: `Felba-${orderId}`,
        TransactionDesc: `Payment for order ${order.orderNumber}`,
      }),
    });

    const stkData = await stkResponse.json() as { ResponseCode: string; CheckoutRequestID: string; ResponseDescription: string };

    if (stkData.ResponseCode !== '0') {
      return res.status(400).json({
        success: false,
        message: stkData.ResponseDescription || 'Failed to initiate STK push',
      });
    }

    // Store the checkout request ID on the order
    await prisma.order.update({
      where: { id: orderId },
      data: { paymentIntentId: stkData.CheckoutRequestID, paymentMethod: 'mpesa' },
    });

    return res.status(200).json({
      success: true,
      checkoutRequestId: stkData.CheckoutRequestID,
      message: 'STK push sent. Please check your phone to complete payment.',
    });
  } catch (error) {
    console.error('[MPesa Initiate] Error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}
