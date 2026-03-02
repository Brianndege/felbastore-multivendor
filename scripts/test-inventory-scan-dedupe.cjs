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

const baseUrl = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000').replace(/\/$/, '');
const jobKey = (process.env.INVENTORY_SCAN_JOB_KEY || process.env.INTERNAL_JOB_KEY || '').trim();
const lookbackHours = Number(process.env.INVENTORY_SCAN_LOOKBACK_HOURS || 24);
const maxProducts = Number(process.env.INVENTORY_SCAN_MAX_PRODUCTS || 250);
const timeoutMs = Number(process.env.INVENTORY_SCAN_REQUEST_TIMEOUT_MS || 20000);

let parsedBaseUrl;
try {
  parsedBaseUrl = new URL(baseUrl);
} catch {
  console.error(`[inventory-dedupe] Invalid APP_URL/NEXTAUTH_URL: ${baseUrl}`);
  process.exit(1);
}

if (!jobKey) {
  console.error('[inventory-dedupe] Missing INVENTORY_SCAN_JOB_KEY (or INTERNAL_JOB_KEY).');
  process.exit(1);
}

if (!Number.isFinite(lookbackHours) || lookbackHours <= 0) {
  console.error('[inventory-dedupe] INVENTORY_SCAN_LOOKBACK_HOURS must be a positive number.');
  process.exit(1);
}

if (!Number.isFinite(maxProducts) || maxProducts <= 0) {
  console.error('[inventory-dedupe] INVENTORY_SCAN_MAX_PRODUCTS must be a positive number.');
  process.exit(1);
}

if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
  console.error('[inventory-dedupe] INVENTORY_SCAN_REQUEST_TIMEOUT_MS must be a positive number.');
  process.exit(1);
}

async function runScan() {
  const endpoint = `${baseUrl}/api/internal/jobs/inventory-alert-scan`;
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
      throw new Error(`[inventory-dedupe] Scan request failed (${response.status}): ${JSON.stringify(payload)}`);
    }

    if (!payload?.result) {
      throw new Error('[inventory-dedupe] Scan response missing result payload.');
    }

    return payload.result;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    const causeCode = err && err.cause && typeof err.cause === 'object' ? err.cause.code : undefined;

    if (err.name === 'AbortError') {
      throw new Error(`[inventory-dedupe] Request timed out after ${timeoutMs}ms for ${endpoint}`);
    }

    if (causeCode === 'ECONNREFUSED' || causeCode === 'EHOSTUNREACH' || causeCode === 'ENOTFOUND') {
      if (parsedBaseUrl.hostname === 'localhost' || parsedBaseUrl.hostname === '127.0.0.1') {
        throw new Error(`[inventory-dedupe] Could not reach ${endpoint}. APP_URL points to localhost, so start the app first (npm run dev or npm run start).`);
      }

      throw new Error(`[inventory-dedupe] Could not reach ${endpoint}. Verify APP_URL and network reachability.`);
    }

    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

(async () => {
  try {
    const first = await runScan();
    const second = await runScan();

    console.log('[inventory-dedupe] First run:', first);
    console.log('[inventory-dedupe] Second run:', second);

    if (Number(second.createdAlerts || 0) !== 0) {
      throw new Error(`[inventory-dedupe] Expected second run to create 0 alerts, got ${second.createdAlerts}.`);
    }

    if (Number(second.scannedProducts || 0) < 0 || Number(second.skippedAlerts || 0) < 0) {
      throw new Error('[inventory-dedupe] Invalid metrics in second run.');
    }

    console.log('[inventory-dedupe] PASS: second run produced no new alerts (dedupe working).');
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
})();
