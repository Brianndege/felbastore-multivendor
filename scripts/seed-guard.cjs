if (process.env.NODE_ENV === "production" && process.env.ALLOW_PRODUCTION_SEED !== "true") {
  console.error("[seed-guard] Seeding is blocked in production. Set ALLOW_PRODUCTION_SEED=true only for explicitly approved maintenance windows.");
  process.exit(1);
}

console.log("[seed-guard] Seed execution allowed.");
