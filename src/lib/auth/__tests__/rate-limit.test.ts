import { applyAuthRateLimit, resetAuthRateLimit } from "@/lib/auth/rate-limit";

describe("auth rate limit", () => {
  it("resets attempts after explicit reset", () => {
    const key = "admin-secure-login:test@example.com";

    const first = applyAuthRateLimit(key, { windowMs: 60_000, max: 5 });
    const second = applyAuthRateLimit(key, { windowMs: 60_000, max: 5 });
    expect(first.attempts).toBe(1);
    expect(second.attempts).toBe(2);

    resetAuthRateLimit(key);

    const afterReset = applyAuthRateLimit(key, { windowMs: 60_000, max: 5 });
    expect(afterReset.attempts).toBe(1);
    expect(afterReset.allowed).toBe(true);
  });
});
