const path = require('path');
const { spawn } = require('child_process');

const NEXT_BIN = path.join(process.cwd(), 'node_modules', 'next', 'dist', 'bin', 'next');

function isValidPostgresUrl(value) {
  if (typeof value !== 'string') return false;
  const normalized = value.trim();
  return /^(postgresql|postgres):\/\//i.test(normalized);
}

function normalizeBuildEnv(baseEnv) {
  const env = { ...baseEnv };
  const databaseUrl = env.DATABASE_URL;
  const fallbackDatabaseUrl = env.NETLIFY_DATABASE_URL;
  const directUrl = env.DIRECT_URL;
  const fallbackDirectUrl = env.NETLIFY_DATABASE_URL_UNPOOLED;

  if (!isValidPostgresUrl(databaseUrl) && isValidPostgresUrl(fallbackDatabaseUrl)) {
    env.DATABASE_URL = fallbackDatabaseUrl.trim();
    console.warn('[build] Using NETLIFY_DATABASE_URL as DATABASE_URL fallback');
  }

  if (!isValidPostgresUrl(directUrl) && isValidPostgresUrl(fallbackDirectUrl)) {
    env.DIRECT_URL = fallbackDirectUrl.trim();
    console.warn('[build] Using NETLIFY_DATABASE_URL_UNPOOLED as DIRECT_URL fallback');
  }

  return env;
}

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
  const normalizedEnv = normalizeBuildEnv(process.env);
  const firstCode = await runBuild(normalizedEnv);
  if (firstCode === 0) {
    process.exit(0);
  }

  if (process.platform !== 'win32' || process.env.NEXT_DIST_DIR) {
    process.exit(firstCode);
  }

  const fallbackDistDir = `.next-runtime-build-${Date.now()}`;
  console.warn(`[build] Build failed on Windows; retrying with NEXT_DIST_DIR=${fallbackDistDir}`);

  const secondCode = await runBuild({
    ...normalizedEnv,
    NEXT_DIST_DIR: fallbackDistDir,
  });

  process.exit(secondCode);
})();
