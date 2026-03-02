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

const REQUIRED = [
  'MPESA_CONSUMER_KEY',
  'MPESA_CONSUMER_SECRET',
];

const missing = REQUIRED.filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.error(`Daraja config missing: ${missing.join(', ')}`);
  process.exit(1);
}

const optionalMissing = ['MPESA_PASSKEY', 'MPESA_SHORTCODE', 'MPESA_CALLBACK_URL']
  .filter((key) => !process.env[key]);

if (optionalMissing.length > 0) {
  console.warn(`Daraja STK fields still missing (OAuth can still run): ${optionalMissing.join(', ')}`);
}

const auth = Buffer.from(`${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`).toString('base64');

(async () => {
  try {
    const response = await fetch('https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials', {
      method: 'GET',
      headers: {
        Authorization: `Basic ${auth}`,
      },
    });

    if (!response.ok) {
      console.error(`Daraja OAuth failed: ${response.status} ${response.statusText}`);
      process.exit(1);
    }

    const data = await response.json();

    if (!data.access_token) {
      console.error('Daraja OAuth failed: access_token missing in response');
      process.exit(1);
    }

    console.log(`Daraja OAuth OK: token received (expires_in=${data.expires_in})`);
  } catch (error) {
    console.error('Daraja OAuth request error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
})();
