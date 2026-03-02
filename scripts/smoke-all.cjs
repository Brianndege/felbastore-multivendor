const path = require('path');
const { spawn } = require('child_process');

const ROOT = process.cwd();

function runScript(scriptPath) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [scriptPath], {
      cwd: ROOT,
      stdio: 'inherit',
      env: process.env,
    });

    child.on('exit', (code) => resolve(code ?? 0));
    child.on('error', () => resolve(1));
  });
}

(async () => {
  const devSmokePath = path.join(ROOT, 'scripts', 'dev-smoke.cjs');
  const startSmokePath = path.join(ROOT, 'scripts', 'start-smoke.cjs');

  console.log('[smoke:all] Running dev smoke...');
  const devCode = await runScript(devSmokePath);
  if (devCode !== 0) {
    console.error(`[smoke:all] FAILED at dev smoke (exit ${devCode})`);
    process.exit(devCode);
  }

  console.log('[smoke:all] Running start smoke...');
  const startCode = await runScript(startSmokePath);
  if (startCode !== 0) {
    console.error(`[smoke:all] FAILED at start smoke (exit ${startCode})`);
    process.exit(startCode);
  }

  console.log('[smoke:all] PASS (dev + start smoke checks succeeded)');
})();