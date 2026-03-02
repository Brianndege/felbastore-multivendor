const fs = require('fs');
const path = require('path');

const loadEnvFile = (fileName) => {
  const filePath = path.join(process.cwd(), fileName);
  if (!fs.existsSync(filePath)) {
    return;
  }

  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const equalIndex = trimmed.indexOf('=');
    if (equalIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, equalIndex).trim();
    let value = trimmed.slice(equalIndex + 1).trim();

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
};

loadEnvFile('.env.local');
loadEnvFile('.env');

const required = [
  'MPESA_CONSUMER_KEY',
  'MPESA_CONSUMER_SECRET',
  'MPESA_PASSKEY',
  'MPESA_SHORTCODE',
  'MPESA_CALLBACK_URL',
];

const missing = required.filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.error(`Daraja config missing: ${missing.join(', ')}`);
  process.exit(1);
}

const phone = process.env.MPESA_TEST_PHONE || process.argv[2];
if (!phone || !/^2547\d{8}$/.test(phone)) {
  console.error('Provide a Safaricom test phone in 2547XXXXXXXX format via MPESA_TEST_PHONE or first CLI arg.');
  process.exit(1);
}

const amountValue = Number(process.env.MPESA_TEST_AMOUNT || process.argv[3] || '1');
if (!Number.isFinite(amountValue) || amountValue <= 0) {
  console.error('Provide a valid positive MPESA_TEST_AMOUNT (or second CLI arg).');
  process.exit(1);
}

const accountRef = process.env.MPESA_TEST_ACCOUNT_REF || 'Felba-Test';
const transactionDesc = process.env.MPESA_TEST_TRANSACTION_DESC || 'Daraja STK sandbox test';

const generateTimestamp = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}${hours}${minutes}${seconds}`;
};

const getAccessToken = async () => {
  const pair = `${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`;
  const auth = Buffer.from(pair).toString('base64');

  const response = await fetch('https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials', {
    method: 'GET',
    headers: {
      Authorization: `Basic ${auth}`,
    },
  });

  if (!response.ok) {
    throw new Error(`OAuth failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  if (!data.access_token) {
    throw new Error('OAuth response missing access_token');
  }

  return data.access_token;
};

(async () => {
  try {
    const timestamp = generateTimestamp();
    const password = Buffer.from(`${process.env.MPESA_SHORTCODE}${process.env.MPESA_PASSKEY}${timestamp}`).toString('base64');
    const token = await getAccessToken();

    const callbackBase = process.env.MPESA_CALLBACK_URL.replace(/\/+$/, '');
    const callbackUrl = `${callbackBase}/api/payment/mpesa/callback`;

    const payload = {
      BusinessShortCode: process.env.MPESA_SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: Math.round(amountValue),
      PartyA: phone,
      PartyB: process.env.MPESA_SHORTCODE,
      PhoneNumber: phone,
      CallBackURL: callbackUrl,
      AccountReference: accountRef,
      TransactionDesc: transactionDesc,
    };

    const response = await fetch('https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const rawBody = await response.text();
    let data;
    try {
      data = JSON.parse(rawBody);
    } catch {
      console.error(`Daraja STK non-JSON response (status ${response.status}): ${rawBody}`);
      process.exit(1);
    }

    if (!response.ok) {
      console.error(`Daraja STK HTTP error ${response.status}: ${JSON.stringify(data)}`);
      process.exit(1);
    }

    if (data.ResponseCode === '0') {
      console.log('Daraja STK push initiated successfully.');
      console.log(`MerchantRequestID: ${data.MerchantRequestID}`);
      console.log(`CheckoutRequestID: ${data.CheckoutRequestID}`);
      console.log(`CustomerMessage: ${data.CustomerMessage}`);
      process.exit(0);
    }

    console.error('Daraja STK push failed:', JSON.stringify(data));
    process.exit(1);
  } catch (error) {
    console.error('Daraja STK test error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
})();
