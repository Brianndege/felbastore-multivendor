const { spawn } = require('child_process');

function runCommand(command, args, env) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: true,
      env,
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
      name: 'governance-consistency',
      command: 'npm',
      args: ['run', 'verify:governance'],
      env: process.env,
    },
    {
      name: 'inventory-ops',
      command: 'npm',
      args: ['run', 'verify:inventory-ops'],
      env: process.env,
    },
  ];

  const results = [];

  for (const check of checks) {
    console.log(`\n[verify-release-readiness] Running ${check.name}...`);
    const result = await runCommand(check.command, check.args, check.env);
    results.push({ ...check, ...result });

    console.log(
      `[verify-release-readiness] ${check.name}: ${result.ok ? 'PASS' : 'FAIL'} (${result.durationMs}ms, exit ${result.code})`
    );

    if (!result.ok) {
      break;
    }
  }

  console.log('\n[verify-release-readiness] Summary');
  for (const item of results) {
    console.log(`- ${item.name}: ${item.ok ? 'PASS' : 'FAIL'} (exit ${item.code})`);
  }

  const failed = results.find((item) => !item.ok);
  if (failed) {
    console.error(`\n[verify-release-readiness] Failed at ${failed.name}.`);
    process.exit(1);
  }

  console.log('\n[verify-release-readiness] All release readiness checks passed.');
})();
