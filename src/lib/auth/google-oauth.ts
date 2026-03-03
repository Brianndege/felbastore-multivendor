import { OAuth2Client } from "google-auth-library";
import { signPayload, timingSafeEqualHex } from "@/lib/auth/security";

const GOOGLE_ONBOARDING_TTL_MS = 10 * 60 * 1000;

type GoogleOnboardingPayload = {
  googleId: string;
  email: string;
  name: string;
  picture: string | null;
  issuedAtMs: number;
  expiresAtMs: number;
};

export type VerifiedGoogleProfile = {
  googleId: string;
  email: string;
  name: string;
  picture: string | null;
};

function getGoogleClientId() {
  return process.env.GOOGLE_CLIENT_ID?.trim() || "";
}

const googleOAuthClient = new OAuth2Client();

function toBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function fromBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function createOnboardingSignature(encodedPayload: string) {
  const signature = signPayload(`google-onboarding.${encodedPayload}`);
  if (!signature) {
    throw new Error("GOOGLE_ONBOARDING_SECRET_MISSING");
  }

  return signature;
}

export function createGoogleOnboardingToken(profile: VerifiedGoogleProfile) {
  const issuedAtMs = Date.now();
  const expiresAtMs = issuedAtMs + GOOGLE_ONBOARDING_TTL_MS;
  const payload: GoogleOnboardingPayload = {
    googleId: profile.googleId,
    email: profile.email,
    name: profile.name,
    picture: profile.picture,
    issuedAtMs,
    expiresAtMs,
  };

  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = createOnboardingSignature(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function verifyGoogleOnboardingToken(token: string): VerifiedGoogleProfile {
  const [encodedPayload, signature] = token.split(".");

  if (!encodedPayload || !signature) {
    throw new Error("INVALID_GOOGLE_ONBOARDING_TOKEN");
  }

  const expectedSignature = createOnboardingSignature(encodedPayload);
  if (!timingSafeEqualHex(expectedSignature, signature)) {
    throw new Error("INVALID_GOOGLE_ONBOARDING_TOKEN");
  }

  let payload: GoogleOnboardingPayload;
  try {
    payload = JSON.parse(fromBase64Url(encodedPayload)) as GoogleOnboardingPayload;
  } catch {
    throw new Error("INVALID_GOOGLE_ONBOARDING_TOKEN");
  }

  if (!payload?.googleId || !payload?.email || !payload?.name || !payload?.issuedAtMs || !payload?.expiresAtMs) {
    throw new Error("INVALID_GOOGLE_ONBOARDING_TOKEN");
  }

  if (Date.now() > payload.expiresAtMs) {
    throw new Error("GOOGLE_ONBOARDING_TOKEN_EXPIRED");
  }

  return {
    googleId: payload.googleId,
    email: payload.email.trim().toLowerCase(),
    name: payload.name,
    picture: payload.picture || null,
  };
}

export async function verifyGoogleIdToken(idToken: string): Promise<VerifiedGoogleProfile> {
  const clientId = getGoogleClientId();
  if (!clientId) {
    throw new Error("GOOGLE_CLIENT_ID_MISSING");
  }

  const ticket = await googleOAuthClient.verifyIdToken({
    idToken,
    audience: clientId,
  });

  const payload = ticket.getPayload();
  if (!payload?.sub || !payload.email) {
    throw new Error("GOOGLE_TOKEN_INVALID");
  }

  if (!payload.email_verified) {
    throw new Error("GOOGLE_EMAIL_NOT_VERIFIED");
  }

  return {
    googleId: payload.sub,
    email: payload.email.trim().toLowerCase(),
    name: payload.name || payload.email,
    picture: payload.picture || null,
  };
}

export async function verifyGoogleAccessToken(accessToken: string): Promise<VerifiedGoogleProfile> {
  if (!accessToken) {
    throw new Error("GOOGLE_ACCESS_TOKEN_MISSING");
  }

  const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error("GOOGLE_ACCESS_TOKEN_INVALID");
  }

  const payload = (await response.json()) as {
    sub?: string;
    email?: string;
    email_verified?: boolean;
    name?: string;
    picture?: string;
  };

  if (!payload?.sub || !payload?.email) {
    throw new Error("GOOGLE_ACCESS_TOKEN_INVALID");
  }

  if (!payload.email_verified) {
    throw new Error("GOOGLE_EMAIL_NOT_VERIFIED");
  }

  return {
    googleId: payload.sub,
    email: payload.email.trim().toLowerCase(),
    name: payload.name || payload.email,
    picture: payload.picture || null,
  };
}
