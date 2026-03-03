import crypto from "crypto";

function getSigningSecret() {
  return process.env.AUTH_TOKEN_SIGNING_SECRET || process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET || "";
}

export function createRandomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("hex");
}

export function createOtpCode() {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function hashSecret(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function hashIdentifier(value: string) {
  return hashSecret(value.trim().toLowerCase());
}

export function signPayload(payload: string) {
  const secret = getSigningSecret();
  if (!secret) return "";
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

export function timingSafeEqualHex(a: string, b: string) {
  const first = Buffer.from(a || "", "hex");
  const second = Buffer.from(b || "", "hex");
  if (first.length !== second.length) return false;
  return crypto.timingSafeEqual(first, second);
}

export function createSignedAuthLink(path: string, selector: string, secret: string, expiresAt: Date) {
  const expires = String(expiresAt.getTime());
  const payload = `${selector}.${secret}.${expires}.${path}`;
  const signature = signPayload(payload);
  return { expires, signature };
}

export function verifySignedAuthLink(path: string, selector: string, secret: string, expires: string, signature: string) {
  const expiresMs = Number(expires);
  if (!Number.isFinite(expiresMs) || Date.now() > expiresMs) {
    return false;
  }

  const payload = `${selector}.${secret}.${expires}.${path}`;
  const expected = signPayload(payload);

  if (!expected || !signature) {
    return false;
  }

  return timingSafeEqualHex(expected, signature);
}

export function getClientIpAddress(forwardedForHeader?: string | string[] | null) {
  if (!forwardedForHeader) return "unknown";
  const raw = Array.isArray(forwardedForHeader) ? forwardedForHeader[0] : forwardedForHeader;
  const ip = raw.split(",")[0]?.trim();
  return ip || "unknown";
}