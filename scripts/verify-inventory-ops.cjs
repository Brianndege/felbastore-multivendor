const { spawn } = require('child_process');

function runCommand(command, args) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: true,
      env: process.env,
    });

    child.on('exit', (code) => {
      resolve({
        ok: code === 0,
        code: code ?? 1,
        durationMs: Date.now() - startedAt,
      });
    });

    child.on('error', () => {
      resolve({
        ok: false,
        code: 1,
        durationMs: Date.now() - startedAt,
      });
    });
  });
}

(async () => {
  const checks = [
    {
      name: 'inventory-env-preflight',
      command: 'npm',
      args: ['run', 'jobs:inventory-scan:validate'],
    },
    {
      name: 'inventory-connectivity-diagnostics',
      command: 'npm',
      args: ['run', 'diagnose:inventory-scan'],
    },
    {
      name: 'inventory-scan-job',
      command: 'npm',
      args: ['run', 'jobs:inventory-scan'],
    },
    {
      name: 'inventory-dedupe-test',
      command: 'npm',
      args: ['run', 'test:inventory-dedupe'],
    },
  ];

  const results = [];

  for (const check of checks) {
    console.log(`\n[verify-inventory-ops] Running ${check.name}...`);
    const result = await runCommand(check.command, check.args);
    results.push({ ...check, ...result });

    console.log(
      `[verify-inventory-ops] ${check.name}: ${result.ok ? 'PASS' : 'FAIL'} (${result.durationMs}ms, exit ${result.code})`
    );
  }

  const failed = results.filter((item) => !item.ok);

  console.log('\n[verify-inventory-ops] Summary');
  for (const item of results) {
    console.log(`- ${item.name}: ${item.ok ? 'PASS' : 'FAIL'} (exit ${item.code})`);
  }

  if (failed.length > 0) {
    console.error('\n[verify-inventory-ops] One or more checks failed.');
    process.exit(1);
  }

  console.log('\n[verify-inventory-ops] All checks passed.');
})();
