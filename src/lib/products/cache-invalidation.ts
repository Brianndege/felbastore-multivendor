import { logger } from "@/lib/logger";

async function runUpstashCommand(command: string, ...args: string[]) {
  const baseUrl = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!baseUrl || !token) return null;

  const url = `${baseUrl.replace(/\/$/, "")}/${[command, ...args].map(encodeURIComponent).join("/")}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Upstash command failed: ${command}`);
  }

  return response.json();
}

async function purgeProductRedisKeys() {
  const prefixes = ["product:", "products:", "feed:", "category:", "search:"];
  let deleted = 0;

  for (const prefix of prefixes) {
    const scanResult = await runUpstashCommand("scan", "0", "match", `${prefix}*`, "count", "1000");
    const keys = Array.isArray(scanResult?.result?.[1]) ? scanResult.result[1] : [];

    if (!keys.length) continue;

    await runUpstashCommand("del", ...keys);
    deleted += keys.length;
  }

  return deleted;
}

async function purgeCdn() {
  const purgeUrl = process.env.CDN_PURGE_URL;
  const purgeToken = process.env.CDN_PURGE_TOKEN;
  if (!purgeUrl) return false;

  const response = await fetch(purgeUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(purgeToken ? { authorization: `Bearer ${purgeToken}` } : {}),
    },
    body: JSON.stringify({ scope: "products" }),
  });

  return response.ok;
}

export async function invalidateProductCaches(context: { reason: string; runId?: string; dryRun?: boolean }) {
  const actions: Record<string, unknown> = {
    reason: context.reason,
    runId: context.runId,
    dryRun: Boolean(context.dryRun),
    redisDeletedKeys: 0,
    cdnPurged: false,
  };

  if (context.dryRun) {
    logger.warn("[cache-invalidation] dry-run; skipping cache purge", actions);
    return actions;
  }

  try {
    actions.redisDeletedKeys = await purgeProductRedisKeys();
  } catch (error) {
    logger.warn("[cache-invalidation] redis purge failed", error);
  }

  try {
    actions.cdnPurged = await purgeCdn();
  } catch (error) {
    logger.warn("[cache-invalidation] cdn purge failed", error);
  }

  logger.warn("[cache-invalidation] product cache invalidation executed", actions);
  return actions;
}
