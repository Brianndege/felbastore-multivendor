const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

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

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const checkServer = async () => {
  try {
    const response = await fetch(`${baseUrl}/`, { method: 'GET' });
    return response.ok;
  } catch {
    return false;
  }
};

const waitForServer = async (timeoutMs = 120000) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await checkServer()) return true;
    await wait(1000);
  }
  return false;
};

const runCommand = (command, args) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: true,
      env: process.env,
    });

    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(' ')} failed with exit code ${code}`));
    });

    child.on('error', reject);
  });

(async () => {
  let startedServer = null;

  try {
    const serverRunning = await checkServer();

    if (!serverRunning) {
      console.log('[smoke] Starting server...');
      startedServer = spawn('npm', ['run', 'start'], {
        stdio: 'inherit',
        shell: true,
        env: process.env,
      });

      const ready = await waitForServer();
      if (!ready) {
        throw new Error('Server did not become ready in time');
      }
    } else {
      console.log('[smoke] Reusing running server on localhost:3000');
    }

    const routeChecks = [
      `${baseUrl}/`,
      `${baseUrl}/products`,
      `${baseUrl}/categories`,
      `${baseUrl}/categories/test`,
    ];

    for (const url of routeChecks) {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Route check failed for ${url} with status ${response.status}`);
      }
      console.log(`[smoke] Route OK: ${url} -> ${response.status}`);
    }

    const adminExportResponse = await fetch(`${baseUrl}/api/admin/orders/export`);
    if (![401, 403].includes(adminExportResponse.status)) {
      throw new Error(`Expected admin export to be protected (401/403), got ${adminExportResponse.status}`);
    }
    console.log(`[smoke] Admin API protection OK: /api/admin/orders/export -> ${adminExportResponse.status}`);

    await runCommand('npm', ['run', 'test:stripe']);
    await runCommand('npm', ['run', 'test:card-e2e']);
    await runCommand('npm', ['run', 'test:vendor-bulk']);

    console.log('[smoke] ALL CHECKS PASSED');
  } catch (error) {
    console.error('[smoke] FAILED:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    if (startedServer && !startedServer.killed) {
      startedServer.kill('SIGTERM');
    }
  }
})();
