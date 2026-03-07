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

function main() {
  const migrate = run("npx", ["prisma", "migrate", "deploy"]);
  if (migrate.code !== 0) {
    if (isKnownBaselineP3009(migrate.output)) {
      console.warn("[netlify-build] Detected known baseline migration lock (P3009 on 20260305_baseline); continuing with generate/build.");
      console.warn("[netlify-build] Follow-up required: resolve migration state with 'prisma migrate resolve' in production DB.");
    } else {
      process.exit(migrate.code);
    }
  }

  const generate = run("npx", ["prisma", "generate"]);
  if (generate.code !== 0) {
    process.exit(generate.code);
  }

  const build = run("npm", ["run", "build"]);
  process.exit(build.code);
}

main();
