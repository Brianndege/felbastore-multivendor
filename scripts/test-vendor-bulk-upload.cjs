const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const loadEnvFile = (fileName) => {
  const filePath = path.join(process.cwd(), fileName);
  if (!fs.existsSync(filePath)) return;

  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const equalIndex = trimmed.indexOf('=');
    if (equalIndex === -1) continue;

    const key = trimmed.slice(0, equalIndex).trim();
    let value = trimmed.slice(equalIndex + 1).trim();

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) process.env[key] = value;
  }
};

loadEnvFile('.env.local');
loadEnvFile('.env');

const baseUrl = (process.env.NEXTAUTH_URL || 'http://localhost:3000').replace(/\/$/, '');
const cookieJar = new Map();

const storeCookies = (response) => {
  if (typeof response.headers.getSetCookie === 'function') {
    const cookies = response.headers.getSetCookie();
    for (const cookie of cookies) {
      const pair = cookie.split(';')[0];
      const idx = pair.indexOf('=');
      if (idx > -1) cookieJar.set(pair.slice(0, idx), pair.slice(idx + 1));
    }
    return;
  }

  const fallback = response.headers.get('set-cookie');
  if (!fallback) return;
  const pair = fallback.split(';')[0];
  const idx = pair.indexOf('=');
  if (idx > -1) cookieJar.set(pair.slice(0, idx), pair.slice(idx + 1));
};

const cookieHeader = () => Array.from(cookieJar.entries()).map(([k, v]) => `${k}=${v}`).join('; ');

const request = async (url, options = {}) => {
  const headers = new Headers(options.headers || {});
  if (cookieJar.size > 0) headers.set('cookie', cookieHeader());

  const response = await fetch(url, {
    ...options,
    headers,
    redirect: options.redirect || 'manual',
  });

  storeCookies(response);
  return response;
};

const parseJson = async (response) => {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
};

(async () => {
  const email = `e2e-vendor-bulk-${Date.now()}@felba.test`;
  const password = 'Passw0rd!234';
  let vendorId = null;
  const createdProductIds = [];

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const vendor = await prisma.vendor.create({
      data: {
        name: 'Bulk Test Vendor',
        email,
        password: passwordHash,
        storeName: `Bulk Test Store ${Date.now()}`,
        role: 'vendor',
      },
      select: { id: true, email: true },
    });
    vendorId = vendor.id;

    const csrfRes = await request(`${baseUrl}/api/auth/csrf`);
    const csrf = await parseJson(csrfRes);
    if (!csrfRes.ok || !csrf?.csrfToken) {
      throw new Error('Failed to get CSRF token for vendor login');
    }

    const loginBody = new URLSearchParams({
      csrfToken: csrf.csrfToken,
      email,
      password,
      userType: 'vendor',
      callbackUrl: `${baseUrl}/vendors/dashboard/products`,
      json: 'true',
    }).toString();

    const loginRes = await request(`${baseUrl}/api/auth/callback/credentials?json=true`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: loginBody,
    });

    if (!(loginRes.ok || loginRes.status === 302)) {
      const payload = await parseJson(loginRes);
      throw new Error(`Vendor login failed: ${loginRes.status} ${JSON.stringify(payload)}`);
    }

    const sessionRes = await request(`${baseUrl}/api/auth/session`);
    const session = await parseJson(sessionRes);
    if (!sessionRes.ok || session?.user?.email !== email || session?.user?.role !== 'vendor') {
      throw new Error('Vendor session validation failed');
    }

    const duplicateSku = `BULK-SKU-${Date.now()}`;
    const headers = {
      Origin: baseUrl,
      Referer: `${baseUrl}/vendors/dashboard/products`,
      'Content-Type': 'application/json',
    };

    const payload = [
      {
        name: 'Bulk Valid Product',
        description: 'Valid product row for bulk upload',
        price: 1250,
        currency: 'KES',
        category: 'Electronics',
        inventory: 10,
        sku: duplicateSku,
        status: 'active',
      },
      {
        name: '',
        description: 'Missing name row',
        price: 250,
        currency: 'KES',
        category: 'Fashion',
        inventory: 4,
        sku: `MISS-NAME-${Date.now()}`,
        status: 'active',
      },
      {
        name: 'Bulk Duplicate SKU',
        description: 'Duplicate sku in same file',
        price: 999,
        currency: 'KES',
        category: 'Electronics',
        inventory: 3,
        sku: duplicateSku,
        status: 'active',
      },
      {
        name: 'Bulk Invalid Status',
        description: 'Status should fail validation',
        price: 500,
        currency: 'KES',
        category: 'Electronics',
        inventory: 2,
        sku: `BAD-STATUS-${Date.now()}`,
        status: 'archived',
      },
    ];

    const bulkRes = await request(`${baseUrl}/api/vendor/products/bulk`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    const bulkResult = await parseJson(bulkRes);

    if (!bulkRes.ok) {
      throw new Error(`Bulk API failed: ${bulkRes.status} ${JSON.stringify(bulkResult)}`);
    }

    const errorCodes = new Set((bulkResult?.errors || []).map((e) => e.errorCode));

    if (!errorCodes.has('REQUIRED_NAME')) {
      throw new Error(`Expected REQUIRED_NAME errorCode not found: ${JSON.stringify(bulkResult?.errors || [])}`);
    }

    if (!errorCodes.has('DUPLICATE_SKU_IN_FILE')) {
      throw new Error(`Expected DUPLICATE_SKU_IN_FILE errorCode not found: ${JSON.stringify(bulkResult?.errors || [])}`);
    }

    if (!errorCodes.has('INVALID_STATUS')) {
      throw new Error(`Expected INVALID_STATUS errorCode not found: ${JSON.stringify(bulkResult?.errors || [])}`);
    }

    if (bulkResult.createdCount !== 1) {
      throw new Error(`Expected createdCount=1, got ${bulkResult.createdCount}`);
    }

    const createdProducts = await prisma.product.findMany({
      where: {
        vendorId,
        OR: [
          { sku: duplicateSku },
          { sku: { startsWith: 'MISS-NAME-' } },
          { sku: { startsWith: 'BAD-STATUS-' } },
        ],
      },
      select: { id: true, sku: true },
    });

    createdProducts.forEach((product) => createdProductIds.push(product.id));

    if (createdProducts.length !== 1 || createdProducts[0].sku !== duplicateSku) {
      throw new Error(`Unexpected products created: ${JSON.stringify(createdProducts)}`);
    }

    console.log('Vendor bulk validation E2E OK');
    console.log(`createdCount=${bulkResult.createdCount}`);
    console.log(`invalidCount=${bulkResult.invalidCount}`);
    console.log(`skippedCount=${bulkResult.skippedCount}`);
    console.log(`errorCodes=${Array.from(errorCodes).join(',')}`);
  } catch (error) {
    console.error('Vendor bulk validation E2E FAILED:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    try {
      if (createdProductIds.length > 0) {
        await prisma.product.deleteMany({ where: { id: { in: createdProductIds } } });
      }

      if (vendorId) {
        await prisma.notification.deleteMany({ where: { vendorId } });
        await prisma.passwordResetToken.deleteMany({ where: { vendorId } });
        await prisma.emailVerificationToken.deleteMany({ where: { vendorId } });
        await prisma.vendor.deleteMany({ where: { id: vendorId } });
      }
    } catch (cleanupError) {
      console.error('Cleanup warning:', cleanupError instanceof Error ? cleanupError.message : cleanupError);
      process.exitCode = 1;
    }

    await prisma.$disconnect();
  }
})();
