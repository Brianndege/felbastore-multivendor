const path = require('path');
const { spawn } = require('child_process');

const NEXT_BIN = path.join(process.cwd(), 'node_modules', 'next', 'dist', 'bin', 'next');

function runBuild(env) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [NEXT_BIN, 'build'], {
      stdio: 'inherit',
      env,
    });

    child.on('exit', (code) => resolve(code ?? 1));
    child.on('error', () => resolve(1));
  });
}

(async () => {
  const firstCode = await runBuild(process.env);
  if (firstCode === 0) {
    process.exit(0);
  }

  if (process.platform !== 'win32' || process.env.NEXT_DIST_DIR) {
    process.exit(firstCode);
  }

  const fallbackDistDir = `.next-runtime-build-${Date.now()}`;
  console.warn(`[build] Build failed on Windows; retrying with NEXT_DIST_DIR=${fallbackDistDir}`);

  const secondCode = await runBuild({
    ...process.env,
    NEXT_DIST_DIR: fallbackDistDir,
  });

  process.exit(secondCode);
})();
