const fs = require('fs');
const path = require('path');

function loadEnvFile(fileName) {
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
}

loadEnvFile('.env.local');
loadEnvFile('.env');

const args = new Set(process.argv.slice(2));
const validateEnvOnly = args.has('--validate-env');

const baseUrl = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000').replace(/\/$/, '');
const jobKey = (process.env.INVENTORY_SCAN_JOB_KEY || process.env.INTERNAL_JOB_KEY || '').trim();
const lookbackHours = Number(process.env.INVENTORY_SCAN_LOOKBACK_HOURS || 24);
const maxProducts = Number(process.env.INVENTORY_SCAN_MAX_PRODUCTS || 250);
const timeoutMs = Number(process.env.INVENTORY_SCAN_REQUEST_TIMEOUT_MS || 20000);

let parsedBaseUrl;
try {
  parsedBaseUrl = new URL(baseUrl);
} catch {
  console.error(`[inventory-scan] Invalid APP_URL/NEXTAUTH_URL: ${baseUrl}`);
  process.exit(1);
}

if (!jobKey) {
  console.error('[inventory-scan] Missing INVENTORY_SCAN_JOB_KEY (or INTERNAL_JOB_KEY).');
  process.exit(1);
}

if (!Number.isFinite(lookbackHours) || lookbackHours <= 0) {
  console.error('[inventory-scan] INVENTORY_SCAN_LOOKBACK_HOURS must be a positive number.');
  process.exit(1);
}

if (!Number.isFinite(maxProducts) || maxProducts <= 0) {
  console.error('[inventory-scan] INVENTORY_SCAN_MAX_PRODUCTS must be a positive number.');
  process.exit(1);
}

if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
  console.error('[inventory-scan] INVENTORY_SCAN_REQUEST_TIMEOUT_MS must be a positive number.');
  process.exit(1);
}

if (validateEnvOnly) {
  console.log('[inventory-scan] Env validation passed.');
  process.exit(0);
}

const endpoint = `${baseUrl}/api/internal/jobs/inventory-alert-scan`;

(async () => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-job-key': jobKey,
      },
      signal: controller.signal,
      body: JSON.stringify({
        lookbackHours,
        maxProducts,
      }),
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error(`[inventory-scan] Failed (${response.status})`, payload);
      process.exit(1);
    }

    console.log('[inventory-scan] Success:', payload);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    const causeCode = err && err.cause && typeof err.cause === 'object' ? err.cause.code : undefined;

    if (err.name === 'AbortError') {
      console.error(`[inventory-scan] Request timed out after ${timeoutMs}ms for ${endpoint}`);
      process.exit(1);
    }

    if (causeCode === 'ECONNREFUSED' || causeCode === 'EHOSTUNREACH' || causeCode === 'ENOTFOUND') {
      console.error('[inventory-scan] Request failed:', err.message);
      console.error(`[inventory-scan] Could not reach ${endpoint}.`);

      if (parsedBaseUrl.hostname === 'localhost' || parsedBaseUrl.hostname === '127.0.0.1') {
        console.error('[inventory-scan] APP_URL points to localhost. Start the app first (npm run dev or npm run start), or set APP_URL to a reachable deployed URL.');
      } else {
        console.error('[inventory-scan] Verify APP_URL and network reachability from this environment.');
      }

      process.exit(1);
    }

    console.error('[inventory-scan] Request failed:', err.message);
    process.exit(1);
  } finally {
    clearTimeout(timeout);
  }
})();
