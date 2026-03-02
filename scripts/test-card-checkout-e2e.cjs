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
    const setCookies = response.headers.getSetCookie();
    for (const cookie of setCookies) {
      const pair = cookie.split(';')[0];
      const idx = pair.indexOf('=');
      if (idx > -1) {
        cookieJar.set(pair.slice(0, idx), pair.slice(idx + 1));
      }
    }
    return;
  }

  const fallback = response.headers.get('set-cookie');
  if (!fallback) return;
  const pair = fallback.split(';')[0];
  const idx = pair.indexOf('=');
  if (idx > -1) {
    cookieJar.set(pair.slice(0, idx), pair.slice(idx + 1));
  }
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

const ensureTestProduct = async () => {
  let product = await prisma.product.findFirst({
    where: { status: 'active' },
    select: { id: true },
  });

  if (product) {
    return {
      productId: product.id,
      createdProductId: null,
      createdVendorId: null,
    };
  }

  let createdVendorId = null;

  let vendor = await prisma.vendor.findFirst({ select: { id: true } });

  if (!vendor) {
    vendor = await prisma.vendor.create({
      data: {
        name: 'E2E Vendor',
        email: `e2e-vendor-${Date.now()}@felba.test`,
        storeName: 'E2E Test Store',
        role: 'vendor',
      },
      select: { id: true },
    });
    createdVendorId = vendor.id;
  }

  const created = await prisma.product.create({
    data: {
      vendorId: vendor.id,
      name: 'E2E Card Test Product',
      description: 'Temporary product for card checkout test',
      price: 10,
      currency: 'USD',
      category: 'Test',
      tags: [],
      images: [],
      inventory: 10,
      status: 'active',
      isApproved: true,
    },
    select: { id: true },
  });

  return {
    productId: created.id,
    createdProductId: created.id,
    createdVendorId,
  };
};

(async () => {
  const testEmail = `e2e-user-${Date.now()}@felba.test`;
  const testPassword = 'Passw0rd!234';
  let createdUserId = null;
  let createdOrderId = null;
  let createdProductId = null;
  let createdVendorId = null;

  const cleanup = async () => {
    if (createdOrderId) {
      await prisma.orderItem.deleteMany({ where: { orderId: createdOrderId } });
      await prisma.order.deleteMany({ where: { id: createdOrderId } });
    }

    if (createdUserId) {
      await prisma.cartItem.deleteMany({ where: { userId: createdUserId } });
      await prisma.session.deleteMany({ where: { userId: createdUserId } });
      await prisma.account.deleteMany({ where: { userId: createdUserId } });
      await prisma.passwordResetToken.deleteMany({ where: { userId: createdUserId } });
      await prisma.emailVerificationToken.deleteMany({ where: { userId: createdUserId } });
      await prisma.user.deleteMany({ where: { id: createdUserId } });
    }

    if (createdProductId) {
      await prisma.product.deleteMany({ where: { id: createdProductId } });
    }

    if (createdVendorId) {
      await prisma.passwordResetToken.deleteMany({ where: { vendorId: createdVendorId } });
      await prisma.emailVerificationToken.deleteMany({ where: { vendorId: createdVendorId } });
      await prisma.vendor.deleteMany({ where: { id: createdVendorId } });
    }
  };

  try {
    if (!process.env.STRIPE_SECRET_KEY || !process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) {
      throw new Error('Stripe env vars missing');
    }

    const passwordHash = await bcrypt.hash(testPassword, 10);
    const user = await prisma.user.create({
      data: {
        name: 'E2E User',
        email: testEmail,
        password: passwordHash,
        role: 'user',
      },
      select: { id: true, email: true },
    });
    createdUserId = user.id;

    const productContext = await ensureTestProduct();
    const productId = productContext.productId;
    createdProductId = productContext.createdProductId;
    createdVendorId = productContext.createdVendorId;

    const csrfRes = await request(`${baseUrl}/api/auth/csrf`);
    if (!csrfRes.ok) throw new Error(`CSRF request failed: ${csrfRes.status}`);
    const csrfData = await parseJson(csrfRes);
    const csrfToken = csrfData?.csrfToken;
    if (!csrfToken) throw new Error('Missing CSRF token');

    const formBody = new URLSearchParams({
      csrfToken,
      email: user.email,
      password: testPassword,
      userType: 'user',
      callbackUrl: `${baseUrl}/`,
      json: 'true',
    }).toString();

    const loginRes = await request(`${baseUrl}/api/auth/callback/credentials?json=true`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formBody,
    });

    if (!(loginRes.ok || loginRes.status === 302)) {
      const loginData = await parseJson(loginRes);
      throw new Error(`Login failed: ${loginRes.status} ${JSON.stringify(loginData)}`);
    }

    const sessionRes = await request(`${baseUrl}/api/auth/session`);
    const sessionData = await parseJson(sessionRes);
    if (!sessionRes.ok || !sessionData?.user?.email) {
      throw new Error(`Session check failed: ${sessionRes.status}`);
    }

    const originHeaders = {
      Origin: baseUrl,
      Referer: `${baseUrl}/checkout`,
      'Content-Type': 'application/json',
    };

    const addCartRes = await request(`${baseUrl}/api/cart`, {
      method: 'POST',
      headers: originHeaders,
      body: JSON.stringify({ productId, quantity: 1 }),
    });
    if (!addCartRes.ok) {
      const payload = await parseJson(addCartRes);
      throw new Error(`Add to cart failed: ${addCartRes.status} ${JSON.stringify(payload)}`);
    }

    const address = {
      firstName: 'E2E',
      lastName: 'User',
      email: user.email,
      phone: '0700000000',
      address: 'Nairobi Road',
      city: 'Nairobi',
      state: 'Nairobi',
      zipCode: '00100',
      country: 'KE',
    };

    const createOrderRes = await request(`${baseUrl}/api/orders/create`, {
      method: 'POST',
      headers: originHeaders,
      body: JSON.stringify({
        shippingAddress: address,
        billingAddress: address,
        paymentMethod: 'stripe',
      }),
    });

    const orderPayload = await parseJson(createOrderRes);
    if (!createOrderRes.ok || !orderPayload?.order?.id) {
      throw new Error(`Order creation failed: ${createOrderRes.status} ${JSON.stringify(orderPayload)}`);
    }
    createdOrderId = orderPayload.order.id;

    const createPaymentRes = await request(`${baseUrl}/api/payment/create`, {
      method: 'POST',
      headers: originHeaders,
      body: JSON.stringify({
        orderId: orderPayload.order.id,
        paymentMethod: 'stripe',
        returnUrl: `${baseUrl}/checkout/success?orderId=${orderPayload.order.id}`,
      }),
    });

    const paymentPayload = await parseJson(createPaymentRes);

    if (!createPaymentRes.ok || !paymentPayload?.success || !paymentPayload?.clientSecret) {
      throw new Error(`Payment init failed: ${createPaymentRes.status} ${JSON.stringify(paymentPayload)}`);
    }

    console.log('Card E2E OK');
    console.log(`user=${user.email}`);
    console.log(`productId=${productId}`);
    console.log(`orderId=${orderPayload.order.id}`);
    console.log(`paymentId=${paymentPayload.paymentId}`);
    console.log(`clientSecretPrefix=${String(paymentPayload.clientSecret).slice(0, 12)}...`);
  } catch (error) {
    console.error('Card E2E FAILED:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    try {
      await cleanup();
      console.log('Cleanup OK');
    } catch (cleanupError) {
      console.error('Cleanup FAILED:', cleanupError instanceof Error ? cleanupError.message : cleanupError);
      process.exitCode = 1;
    }

    await prisma.$disconnect();
  }
})();
