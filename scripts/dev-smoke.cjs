const net = require('net');
const path = require('path');
const { spawn } = require('child_process');

const RUN_NEXT_SCRIPT = path.join(process.cwd(), 'scripts', 'run-next.cjs');

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });

    server.listen(port, '0.0.0.0');
  });
}

async function findOpenPort(startPort, attempts = 20) {
  for (let offset = 0; offset < attempts; offset += 1) {
    const candidate = startPort + offset;
    if (await isPortAvailable(candidate)) {
      return candidate;
    }
  }

  return null;
}

async function waitForHttpReady(url, timeoutMs = 120000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return true;
      }
    } catch {
      // keep polling
    }

    await wait(1000);
  }

  return false;
}

async function stopChild(child) {
  if (!child || child.killed) {
    return;
  }

  child.kill('SIGTERM');
  await wait(1500);

  if (!child.killed) {
    child.kill('SIGKILL');
  }
}

(async () => {
  let serverProcess = null;

  try {
    const requestedPort = Number(process.env.DEV_SMOKE_PORT || '3200');
    const smokePort = await findOpenPort(requestedPort);

    if (!smokePort) {
      throw new Error(`No free port found from ${requestedPort} in checked range`);
    }

    const env = {
      ...process.env,
      PORT: String(smokePort),
      NEXTAUTH_URL: `http://localhost:${smokePort}`,
      NEXT_PUBLIC_NEXTAUTH_URL: `http://localhost:${smokePort}`,
    };

    console.log(`[dev:smoke] Starting server on http://localhost:${smokePort}...`);
    serverProcess = spawn(process.execPath, [RUN_NEXT_SCRIPT, 'dev', '--auto-port'], {
      stdio: 'inherit',
      env,
    });

    const ready = await waitForHttpReady(`http://localhost:${smokePort}/`, 180000);
    if (!ready) {
      throw new Error('Server did not become ready in time');
    }

    const healthResponse = await fetch(`http://localhost:${smokePort}/`);
    if (!healthResponse.ok) {
      throw new Error(`Unexpected HTTP status: ${healthResponse.status}`);
    }

    console.log(`[dev:smoke] PASS (http://localhost:${smokePort}/ -> ${healthResponse.status})`);
  } catch (error) {
    console.error('[dev:smoke] FAIL:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await stopChild(serverProcess);
  }
})();