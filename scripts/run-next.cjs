const net = require('net');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const mode = process.argv[2] || 'dev';
const rawArgs = process.argv.slice(3);
const useAutoPort =
  rawArgs.includes('--auto-port') ||
  process.env.NEXT_AUTO_PORT === 'true';
const extraArgs = rawArgs.filter((arg) => arg !== '--auto-port');
const port = Number(process.env.PORT || '3000');

const NEXT_BIN = path.join(process.cwd(), 'node_modules', 'next', 'dist', 'bin', 'next');
let distDir = process.env.NEXT_DIST_DIR || (process.platform === 'win32' ? '.next-runtime' : '.next');
const requiredBuildFiles = [
  'BUILD_ID',
  'prerender-manifest.json',
  'routes-manifest.json',
  'build-manifest.json',
];

const modeArgs = {
  dev: ['dev', '-H', '0.0.0.0'],
  start: ['start'],
};

if (!modeArgs[mode]) {
  console.error(`[startup] Unsupported mode: ${mode}. Use 'dev' or 'start'.`);
  process.exit(1);
}

function checkPortAvailable(targetPort) {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once('error', (error) => {
      if (error && error.code === 'EADDRINUSE') {
        resolve(false);
        return;
      }

      console.error(`[startup] Port check failed: ${error?.message || error}`);
      resolve(false);
    });

    server.once('listening', () => {
      server.close(() => resolve(true));
    });

    server.listen(targetPort, '0.0.0.0');
  });
}

function runNextBuild() {
  return new Promise((resolve) => {
    const buildArgs = [NEXT_BIN, 'build'];
    const buildProcess = spawn(process.execPath, buildArgs, {
      stdio: 'inherit',
      env: process.env,
    });

    buildProcess.on('exit', (code) => {
      resolve(code ?? 0);
    });

    buildProcess.on('error', (error) => {
      console.error(`[startup] Failed to run pre-start build: ${error?.message || error}`);
      resolve(1);
    });
  });
}

function hasCompleteProductionBuild() {
  return requiredBuildFiles.every((fileName) => {
    const filePath = path.join(process.cwd(), distDir, fileName);
    return fs.existsSync(filePath);
  });
}

async function findNextAvailablePort(startPort, maxAttempts = 20) {
  for (let offset = 1; offset <= maxAttempts; offset += 1) {
    const candidatePort = startPort + offset;
    const available = await checkPortAvailable(candidatePort);
    if (available) {
      return candidatePort;
    }
  }

  return null;
}

(async () => {
  if (mode === 'start' && !hasCompleteProductionBuild()) {
    console.warn(`[startup] Production build not found at ${distDir}. Running 'next build' before start...`);
    let buildCode = await runNextBuild();

    if (buildCode !== 0 && process.platform === 'win32' && !process.env.NEXT_DIST_DIR) {
      const retryDistDir = `.next-runtime-retry-${Date.now()}`;
      console.warn(`[startup] Initial build failed on Windows. Retrying with NEXT_DIST_DIR=${retryDistDir}...`);
      process.env.NEXT_DIST_DIR = retryDistDir;
      distDir = retryDistDir;
      buildCode = await runNextBuild();
    }

    if (buildCode !== 0) {
      console.error('[startup] Pre-start build failed.');
      process.exit(buildCode);
    }

    if (!hasCompleteProductionBuild()) {
      console.error(`[startup] Build completed but required artifacts are still missing in ${distDir}.`);
      process.exit(1);
    }
  }

  let selectedPort = port;
  const isAvailable = await checkPortAvailable(port);

  if (!isAvailable) {
    if (useAutoPort) {
      const fallbackPort = await findNextAvailablePort(port);

      if (fallbackPort) {
        selectedPort = fallbackPort;
        process.env.PORT = String(fallbackPort);
        console.warn(`[startup] Port ${port} is busy, using fallback port ${fallbackPort}.`);
      } else {
        console.error(`[startup] Port ${port} is busy and no fallback port was found in the checked range.`);
        process.exit(1);
      }
    }
  }

  if (!isAvailable && !useAutoPort) {
    console.error(`[startup] Cannot run 'next ${mode}' because port ${port} is already in use.`);
    console.error('[startup] On Windows, run:');
    console.error(`  Get-NetTCPConnection -LocalPort ${port} -State Listen | Select-Object OwningProcess`);
    console.error('  Stop-Process -Id <PID> -Force');
    console.error('[startup] Or set a different port for this run, e.g. PORT=3001 npm run dev');
    console.error('[startup] You can also use auto fallback mode: npm run dev:auto');
    process.exit(1);
  }

  if (selectedPort !== port) {
    console.log(`[startup] Launching Next.js on port ${selectedPort}.`);
  }

  const args = [NEXT_BIN, ...modeArgs[mode], ...extraArgs];
  const child = spawn(process.execPath, args, {
    stdio: 'inherit',
    env: process.env,
  });

  let forwardedShutdown = false;

  const forwardSignal = (signal) => {
    if (child.killed) {
      return;
    }

    forwardedShutdown = true;

    try {
      child.kill(signal);
    } catch (error) {
      console.error(`[startup] Failed to forward ${signal}: ${error?.message || error}`);
    }
  };

  process.on('SIGINT', () => forwardSignal('SIGINT'));
  process.on('SIGTERM', () => forwardSignal('SIGTERM'));

  child.on('exit', (code, signal) => {
    const interruptedBySignal = signal === 'SIGINT' || signal === 'SIGTERM';
    const interruptedByCode = code === 130 || code === 143;

    if (forwardedShutdown || interruptedBySignal || interruptedByCode) {
      process.exit(0);
      return;
    }

    process.exit(code ?? 0);
  });

  child.on('error', (error) => {
    console.error(`[startup] Failed to launch Next.js: ${error?.message || error}`);
    process.exit(1);
  });
})();
