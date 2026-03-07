/* eslint-disable no-console */
const { spawnSync } = require("child_process");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    shell: true,
    encoding: "utf8",
    stdio: "pipe",
    ...options,
  });

  const stdout = result.stdout || "";
  const stderr = result.stderr || "";
  if (stdout) process.stdout.write(stdout);
  if (stderr) process.stderr.write(stderr);

  return {
    code: typeof result.status === "number" ? result.status : 1,
    output: `${stdout}\n${stderr}`,
  };
}

function isKnownBaselineP3009(output) {
  if (!output) return false;
  return output.includes("P3009") && output.includes("20260305_baseline");
}

function isAdvisoryLockTimeout(output) {
  if (!output) return false;
  return output.includes("P1002") && output.includes("pg_advisory_lock");
}

function sleepMs(ms) {
  // Synchronous sleep is acceptable in CI helper scripts.
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function runMigrateWithRetry() {
  const maxAttempts = 5;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const migrate = run("npx", ["prisma", "migrate", "deploy"]);

    if (migrate.code === 0) {
      return migrate;
    }

    if (isKnownBaselineP3009(migrate.output)) {
      console.warn("[netlify-build] Detected known baseline migration lock (P3009 on 20260305_baseline); continuing with generate/build.");
      console.warn("[netlify-build] Follow-up required: resolve migration state with 'prisma migrate resolve' in production DB.");
      return { code: 0, output: migrate.output };
    }

    if (isAdvisoryLockTimeout(migrate.output) && attempt < maxAttempts) {
      const waitMs = attempt * 8000;
      console.warn(`[netlify-build] Prisma advisory lock timeout (attempt ${attempt}/${maxAttempts}). Retrying in ${waitMs / 1000}s...`);
      sleepMs(waitMs);
      continue;
    }

    return migrate;
  }

  return { code: 1, output: "Unknown migrate retry failure" };
}

function main() {
  const migrate = runMigrateWithRetry();
  if (migrate.code !== 0) {
    process.exit(migrate.code);
  }

  const generate = run("npx", ["prisma", "generate"]);
  if (generate.code !== 0) {
    process.exit(generate.code);
  }

  const build = run("npm", ["run", "build"]);
  process.exit(build.code);
}

main();
