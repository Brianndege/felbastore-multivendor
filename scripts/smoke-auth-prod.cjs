const crypto = require('crypto');

const baseUrl = (process.env.AUTH_SMOKE_BASE_URL || process.env.APP_URL || 'https://felbastore.co.ke').replace(/\/$/, '');

function buildHeaders(path = '/auth/login') {
  return {
    Origin: baseUrl,
    Referer: `${baseUrl}${path}`,
    'Content-Type': 'application/json',
  };
}

async function fetchWithRetry(url, options, retries = 3, retryDelayMs = 400) {
  let lastError;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      return await fetch(url, options);
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs * attempt));
      }
    }
  }

  const reason = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`Network fetch failed for ${url}: ${reason}`);
}

async function getStatus(path) {
  const url = `${baseUrl}${path}`;
  const response = await fetchWithRetry(url, {
    method: 'GET',
    headers: {
      Origin: baseUrl,
      Referer: `${baseUrl}/auth/login`,
    },
  });

  return response.status;
}

async function postJson(path, payload) {
  const url = `${baseUrl}${path}`;
  const response = await fetchWithRetry(url, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(payload),
  });

  const raw = await response.text();
  let data = null;
  try {
    data = JSON.parse(raw);
  } catch {
    data = { raw };
  }

  return { status: response.status, data };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function randomEmail(prefix) {
  return `${prefix}-${crypto.randomBytes(4).toString('hex')}@example.com`;
}

async function checkRouteAvailability() {
  const routes = [
    '/auth/login',
    '/auth/forgot-password',
    '/auth/otp',
    '/auth/resend-verification',
    '/auth/reset-password',
    '/auth/verify-email',
  ];

  for (const route of routes) {
    const status = await getStatus(route);
    assert(status === 200, `Route ${route} expected 200, got ${status}`);
    console.log(`[auth-smoke] Route OK: ${route} -> ${status}`);
  }
}

async function checkAntiEnumeration() {
  const probeA = randomEmail('auth-smoke-a');
  const probeB = randomEmail('auth-smoke-b');

  const forgotA = await postJson('/api/auth/forgot-password', { email: probeA, userType: 'user' });
  const forgotB = await postJson('/api/auth/forgot-password', { email: probeB, userType: 'user' });

  assert(forgotA.status === 200 && forgotB.status === 200, 'forgot-password anti-enumeration status mismatch');
  assert(
    forgotA.data?.message === forgotB.data?.message,
    'forgot-password anti-enumeration message mismatch'
  );
  console.log('[auth-smoke] forgot-password anti-enumeration OK');

  const verifyA = await postJson('/api/auth/send-verification', { email: probeA, userType: 'user' });
  const verifyB = await postJson('/api/auth/send-verification', { email: probeB, userType: 'user' });

  assert(verifyA.status === 200 && verifyB.status === 200, 'send-verification anti-enumeration status mismatch');
  assert(
    verifyA.data?.message === verifyB.data?.message,
    'send-verification anti-enumeration message mismatch'
  );
  console.log('[auth-smoke] send-verification anti-enumeration OK');

  const otpA = await postJson('/api/auth/request-otp', { email: probeA, userType: 'user' });
  const otpB = await postJson('/api/auth/request-otp', { email: probeB, userType: 'user' });

  assert(otpA.status === 200 && otpB.status === 200, 'request-otp anti-enumeration status mismatch');
  assert(otpA.data?.message === otpB.data?.message, 'request-otp anti-enumeration message mismatch');
  assert(Boolean(otpA.data?.challengeId), 'request-otp missing challengeId (probe A)');
  assert(Boolean(otpB.data?.challengeId), 'request-otp missing challengeId (probe B)');
  console.log('[auth-smoke] request-otp anti-enumeration OK');
}

async function checkInvalidTokenSemantics() {
  const invalidVerify = await postJson('/api/auth/verify-email', {
    selector: 'invalidselector',
    token: 'invalidtokenvalue123456',
    expires: '0',
    signature: 'invalidsig1234567890',
    userType: 'user',
  });
  assert(invalidVerify.status === 400, `verify-email invalid token expected 400, got ${invalidVerify.status}`);
  console.log('[auth-smoke] verify-email invalid token semantics OK');

  const invalidReset = await postJson('/api/auth/reset-password', {
    selector: 'invalidselector',
    token: 'invalidtokenvalue123456',
    expires: '0',
    signature: 'invalidsig1234567890',
    userType: 'user',
    password: 'StrongPassword!123',
  });
  assert(invalidReset.status === 400, `reset-password invalid token expected 400, got ${invalidReset.status}`);
  console.log('[auth-smoke] reset-password invalid token semantics OK');

  const unauthLogout = await postJson('/api/auth/logout-all-devices', {});
  assert(unauthLogout.status === 401, `logout-all-devices unauthenticated expected 401, got ${unauthLogout.status}`);
  console.log('[auth-smoke] logout-all-devices auth guard OK');
}

async function checkRateLimitBehavior() {
  const forgotProbe = randomEmail('auth-smoke-forgot-limit');
  let forgotSaw429 = false;
  for (let i = 1; i <= 7; i += 1) {
    const result = await postJson('/api/auth/forgot-password', { email: forgotProbe, userType: 'user' });
    if (result.status === 429 && result.data?.requiresCaptcha === true) {
      forgotSaw429 = true;
      break;
    }
  }
  assert(forgotSaw429, 'forgot-password did not trigger expected 429 + requiresCaptcha');
  console.log('[auth-smoke] forgot-password rate-limit/captcha escalation OK');

  const otpProbe = randomEmail('auth-smoke-otp-limit');
  let otpSaw429 = false;
  for (let i = 1; i <= 7; i += 1) {
    const result = await postJson('/api/auth/request-otp', { email: otpProbe, userType: 'user' });
    if (result.status === 429 && result.data?.requiresCaptcha === true) {
      otpSaw429 = true;
      break;
    }
  }
  assert(otpSaw429, 'request-otp did not trigger expected 429 + requiresCaptcha');
  console.log('[auth-smoke] request-otp rate-limit/captcha escalation OK');
}

(async () => {
  try {
    console.log(`[auth-smoke] Base URL: ${baseUrl}`);
    await checkRouteAvailability();
    await checkAntiEnumeration();
    await checkInvalidTokenSemantics();
    await checkRateLimitBehavior();
    console.log('[auth-smoke] PASS');
  } catch (error) {
    console.error('[auth-smoke] FAILED:', error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
})();