type LimitConfig = {
  windowMs: number;
  max: number;
  captchaAfter?: number;
};

type LimitEntry = {
  count: number;
  resetAt: number;
};

const memoryStore = new Map<string, LimitEntry>();

export function resetAuthRateLimit(key: string) {
  memoryStore.delete(key);
}

export function applyAuthRateLimit(key: string, config: LimitConfig) {
  // In-memory limiter is a safe fallback; replace with Redis for multi-instance consistency.
  const now = Date.now();
  const existing = memoryStore.get(key);

  if (!existing || existing.resetAt <= now) {
    const next = {
      count: 1,
      resetAt: now + config.windowMs,
    };
    memoryStore.set(key, next);
    return {
      allowed: true,
      requiresCaptcha: false,
      retryAfterSeconds: Math.ceil(config.windowMs / 1000),
      remaining: Math.max(0, config.max - 1),
      attempts: 1,
      max: config.max,
    };
  }

  existing.count += 1;
  memoryStore.set(key, existing);

  if (existing.count > config.max) {
    return {
      allowed: false,
      requiresCaptcha: true,
      retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000),
      remaining: 0,
      attempts: existing.count,
      max: config.max,
    };
  }

  return {
    allowed: true,
    requiresCaptcha: typeof config.captchaAfter === "number" && existing.count >= config.captchaAfter,
    retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000),
    remaining: Math.max(0, config.max - existing.count),
    attempts: existing.count,
    max: config.max,
  };
}