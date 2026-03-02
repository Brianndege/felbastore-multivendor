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

function mask(value) {
  if (!value) return '(missing)';
  if (value.length <= 8) return '***';
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

async function probe(url, options = {}) {
  try {
    const response = await fetch(url, options);
    return { ok: true, status: response.status };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : String(error),
      code: error && typeof error === 'object' && error.cause && typeof error.cause === 'object' ? error.cause.code : undefined,
    };
  }
}

(async () => {
  loadEnvFile('.env.local');
  loadEnvFile('.env');

  const baseUrl = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000').replace(/\/$/, '');
  const jobKey = (process.env.INVENTORY_SCAN_JOB_KEY || process.env.INTERNAL_JOB_KEY || '').trim();
  const lookbackHours = process.env.INVENTORY_SCAN_LOOKBACK_HOURS || '24';
  const maxProducts = process.env.INVENTORY_SCAN_MAX_PRODUCTS || '250';
  const timeoutMs = process.env.INVENTORY_SCAN_REQUEST_TIMEOUT_MS || '20000';

  console.log('[inventory-diagnose] Configuration');
  console.log(`- APP_URL: ${baseUrl}`);
  console.log(`- INVENTORY_SCAN_JOB_KEY: ${mask(jobKey)}`);
  console.log(`- INVENTORY_SCAN_LOOKBACK_HOURS: ${lookbackHours}`);
  console.log(`- INVENTORY_SCAN_MAX_PRODUCTS: ${maxProducts}`);
  console.log(`- INVENTORY_SCAN_REQUEST_TIMEOUT_MS: ${timeoutMs}`);

  let parsed;
  try {
    parsed = new URL(baseUrl);
  } catch {
    console.error('[inventory-diagnose] FAIL: APP_URL is not a valid URL.');
    process.exit(1);
  }

  if (!jobKey) {
    console.error('[inventory-diagnose] FAIL: INVENTORY_SCAN_JOB_KEY is missing.');
    process.exit(1);
  }

  if (!/^https?:$/.test(parsed.protocol)) {
    console.error('[inventory-diagnose] FAIL: APP_URL must use http or https.');
    process.exit(1);
  }

  if (!Number.isFinite(Number(lookbackHours)) || Number(lookbackHours) <= 0) {
    console.error('[inventory-diagnose] FAIL: INVENTORY_SCAN_LOOKBACK_HOURS must be a positive number.');
    process.exit(1);
  }

  if (!Number.isFinite(Number(maxProducts)) || Number(maxProducts) <= 0) {
    console.error('[inventory-diagnose] FAIL: INVENTORY_SCAN_MAX_PRODUCTS must be a positive number.');
    process.exit(1);
  }

  if (!Number.isFinite(Number(timeoutMs)) || Number(timeoutMs) <= 0) {
    console.error('[inventory-diagnose] FAIL: INVENTORY_SCAN_REQUEST_TIMEOUT_MS must be a positive number.');
    process.exit(1);
  }

  const rootProbe = await probe(baseUrl, { method: 'GET' });
  if (!rootProbe.ok) {
    console.error(`[inventory-diagnose] FAIL: APP_URL is unreachable (${rootProbe.code || 'network error'}: ${rootProbe.message}).`);
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
      console.error('[inventory-diagnose] Hint: start app locally with npm run dev or npm run start.');
    }
    process.exit(1);
  }

  console.log(`[inventory-diagnose] PASS: APP_URL reachable (status ${rootProbe.status}).`);

  const endpoint = `${baseUrl}/api/internal/jobs/inventory-alert-scan`;
  const endpointProbe = await probe(endpoint, { method: 'GET' });
  if (!endpointProbe.ok) {
    console.error(`[inventory-diagnose] FAIL: inventory scan endpoint unreachable (${endpointProbe.code || 'network error'}: ${endpointProbe.message}).`);
    process.exit(1);
  }

  console.log(`[inventory-diagnose] PASS: inventory scan endpoint reachable (GET status ${endpointProbe.status}).`);
  console.log('[inventory-diagnose] Complete: configuration and reachability checks passed.');
})();
