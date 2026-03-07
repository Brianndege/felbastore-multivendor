import NextAuth, { NextAuthOptions } from "next-auth";
import type { NextApiRequest, NextApiResponse } from "next";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import FacebookProvider from "next-auth/providers/facebook";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import bcrypt from "bcryptjs";
import { findAccountByEmail, markEmailVerified } from "@/lib/auth/account";
import { OTP_TTL_MS, OTP_VERIFY_RATE_LIMIT } from "@/lib/auth/constants";
import { applyAuthRateLimit, resetAuthRateLimit } from "@/lib/auth/rate-limit";
import { getClientIpAddress, hashIdentifier } from "@/lib/auth/security";
import { logAuthAuditEvent } from "@/lib/auth/audit";
import { createOtpChallenge, verifyOtpChallenge } from "@/lib/auth/otp-service";
import { sendOtpEmail } from "@/lib/email";
import { createGoogleOnboardingToken, verifyGoogleAccessToken, verifyGoogleIdToken } from "@/lib/auth/google-oauth";
import {
  ensureAdminSecuritySchemaCompatibility,
  isAllowedAdminGenerator,
  logAdminSecurityEvent,
  validateAndConsumeAdminLoginCredentials,
} from "@/lib/admin/security-auth";

const providers: NextAuthOptions["providers"] = [];
let authSchemaCompatPromise: Promise<void> | null = null;

const requiredAuthEnvKeys = [
  "NEXTAUTH_URL",
  "NEXTAUTH_SECRET",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
] as const;

for (const key of requiredAuthEnvKeys) {
  if (!process.env[key]) {
    logger.warn(`[NextAuth] Missing environment variable: ${key}`);
  }
}

function ensureAuthSchemaCompatibility() {
  if (authSchemaCompatPromise) {
    return authSchemaCompatPromise;
  }

  authSchemaCompatPromise = (async () => {
    try {
      await prisma.$executeRawUnsafe(
        'ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "mustChangePassword" BOOLEAN NOT NULL DEFAULT false'
      );
      await prisma.$executeRawUnsafe(
        'ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMP(3)'
      );
      await prisma.$executeRawUnsafe(
        'ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "image" TEXT'
      );

      await prisma.$executeRawUnsafe(
        'ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS "access_token" TEXT'
      );
      await prisma.$executeRawUnsafe(
        'ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS "refresh_token" TEXT'
      );
      await prisma.$executeRawUnsafe(
        'ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS "expires_at" INTEGER'
      );
      await prisma.$executeRawUnsafe(
        'ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS "token_type" TEXT'
      );
      await prisma.$executeRawUnsafe(
        'ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS "scope" TEXT'
      );
      await prisma.$executeRawUnsafe(
        'ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS "id_token" TEXT'
      );
      await prisma.$executeRawUnsafe(
        'ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS "session_state" TEXT'
      );
    } catch (error) {
      logger.warn("[NextAuth] Could not apply auth schema compatibility guard", error);
    }
  })();

  return authSchemaCompatPromise;
}

function stripOAuthQueryParams(rawUrl: string, baseUrl: string) {
  try {
    const url = rawUrl.startsWith("/") ? new URL(rawUrl, baseUrl) : new URL(rawUrl);
    const oauthParamKeys = ["code", "state", "iss", "scope", "authuser", "prompt"];
    for (const key of oauthParamKeys) {
      url.searchParams.delete(key);
    }
    return url;
  } catch {
    return null;
  }
}

async function cleanupDisposableOAuthUser(userId?: string | null) {
  if (!userId) {
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      password: true,
      role: true,
      createdAt: true,
      _count: {
        select: {
          accounts: true,
          sessions: true,
          orders: true,
          cartItems: true,
          wishlistItems: true,
          reviews: true,
        },
      },
    },
  });

  if (!user) {
    return;
  }

  const ageMs = Date.now() - user.createdAt.getTime();
  const hasCommerceData = user._count.orders > 0 || user._count.cartItems > 0 || user._count.wishlistItems > 0 || user._count.reviews > 0;
  const isDisposable = !user.password && user.role === "user" && ageMs < 5 * 60 * 1000 && !hasCommerceData;

  if (!isDisposable) {
    return;
  }

  await prisma.user.delete({
    where: { id: user.id },
  });
}

async function logAuthAuditEventSafe(payload: Parameters<typeof logAuthAuditEvent>[0]) {
  try {
    await logAuthAuditEvent(payload);
  } catch (error) {
    logger.warn("[NextAuth] Failed to write auth audit event", {
      event: payload.event,
      status: payload.status,
      reason: error instanceof Error ? error.message : "unknown_audit_error",
    });
  }
}

async function logAdminSecurityEventSafe(payload: Parameters<typeof logAdminSecurityEvent>[0]) {
  try {
    await logAdminSecurityEvent(payload);
  } catch (error) {
    logger.warn("[NextAuth] Failed to write admin security log", {
      event: payload.event,
      email: payload.email,
      reason: error instanceof Error ? error.message : "unknown_admin_security_log_error",
    });
  }
}

function logAdminSecureDebug(stage: string, metadata: Record<string, unknown>) {
  if (process.env.ADMIN_AUTH_DEBUG === "true") {
    console.log(`[AdminSecure] ${stage}`, metadata);
    return;
  }

  logger.info(`[AdminSecure] ${stage}`, metadata);
}

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      allowDangerousEmailAccountLinking: true,
      authorization: {
        params: {
          scope: "openid email profile",
          prompt: "select_account consent",
          access_type: "offline",
          include_granted_scopes: "true",
          response_type: "code",
        },
      },
    })
  );
}

if (process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET) {
  providers.push(
    FacebookProvider({
      clientId: process.env.FACEBOOK_CLIENT_ID,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
    })
  );
}

export const authOptions: NextAuthOptions = {
  providers: [
    ...providers,
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        userType: { label: "User Type", type: "text" },
      },

      async authorize(credentials, req) {
        logger.info("[NextAuth] Login attempt started");

        const ipAddress = getClientIpAddress(req?.headers?.["x-forwarded-for"] as string | undefined);
        const userAgent = (req?.headers?.["user-agent"] as string | undefined) || "";

        if (!credentials?.email || !credentials?.password || !credentials?.userType) {
          throw new Error("INVALID_LOGIN");
        }

        if (!["user", "vendor", "admin"].includes(credentials.userType)) {
          throw new Error("INVALID_LOGIN");
        }

        const normalizedEmail = credentials.email.trim().toLowerCase();
        const limiterKey = `login:${ipAddress}:${credentials.userType}:${hashIdentifier(normalizedEmail)}`;
        const loginLimit = applyAuthRateLimit(limiterKey, { windowMs: 15 * 60 * 1000, max: 10 });

        if (!loginLimit.allowed) {
          await logAuthAuditEvent({
            event: "login_attempt",
            status: "blocked",
            email: normalizedEmail,
            userType: credentials.userType as "user" | "vendor" | "admin",
            ipAddress,
            userAgent,
            metadata: { reason: "rate_limited" },
          });
          throw new Error("INVALID_LOGIN");
        }

        let user: any = null;

        if (credentials.userType === "user") {
          user = await findAccountByEmail("user", normalizedEmail);
        } else if (credentials.userType === "vendor") {
          user = await findAccountByEmail("vendor", normalizedEmail);
        } else {
          user = await prisma.user.findUnique({
            where: { email: normalizedEmail },
            select: {
              id: true,
              name: true,
              email: true,
              password: true,
              role: true,
              emailVerified: true,
              sessionVersion: true,
            },
          });
        }

        if (!user) {
          await logAuthAuditEvent({
            event: "login_attempt",
            status: "failure",
            email: normalizedEmail,
            userType: credentials.userType as "user" | "vendor" | "admin",
            ipAddress,
            userAgent,
          });
          throw new Error("INVALID_LOGIN");
        }

        if (!user.password) {
          throw new Error("INVALID_LOGIN");
        }

        if (credentials.userType === "admin" && user.role !== "admin") {
          throw new Error("INVALID_LOGIN");
        }

        if (credentials.userType === "admin") {
          throw new Error("ADMIN_SECURE_LOGIN_REQUIRED");
        }

        if (credentials.userType === "user" && user.role === "admin") {
          throw new Error("INVALID_LOGIN");
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        );

        if (!isPasswordValid) {
          await logAuthAuditEvent({
            event: "login_attempt",
            status: "failure",
            email: normalizedEmail,
            userType: credentials.userType as "user" | "vendor" | "admin",
            ipAddress,
            userAgent,
          });
          throw new Error("INVALID_LOGIN");
        }

        if (credentials.userType !== "admin" && !user.emailVerified) {
          const challenge = await createOtpChallenge({
            email: normalizedEmail,
            userType: credentials.userType as "user" | "vendor",
            accountId: user.id,
            ttlMs: OTP_TTL_MS,
          });

          if (!challenge.throttled) {
            const mailResult = await sendOtpEmail(normalizedEmail, challenge.code);
            if (!mailResult.success) {
              await logAuthAuditEvent({
                event: "otp_delivery",
                status: "failure",
                email: normalizedEmail,
                userType: credentials.userType as "user" | "vendor",
                ipAddress,
                userAgent,
                metadata: { reason: "email_send_failed_after_login" },
              });

              throw new Error("EMAIL_DELIVERY_UNAVAILABLE");
            }
          }

          await logAuthAuditEvent({
            event: "otp_requested",
            status: "success",
            email: normalizedEmail,
            userType: credentials.userType as "user" | "vendor",
            ipAddress,
            userAgent,
            metadata: { reason: "email_verification_required_after_login" },
          });

          throw new Error(`OTP_REQUIRED:${challenge.challengeId}`);
        }

        await logAuthAuditEvent({
          event: "login_attempt",
          status: "success",
          email: normalizedEmail,
          userType: credentials.userType as "user" | "vendor" | "admin",
          ipAddress,
          userAgent,
        });

        if (credentials.userType === "user") {
          await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() }, select: { id: true } });
        } else if (credentials.userType === "vendor") {
          await prisma.vendor.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
        }

        return {
          id: user.id,
          name: user.name || user.email,
          email: user.email,
          role: user.role,
          storeName: user.storeName || undefined,
          sessionVersion: user.sessionVersion || 0,
          mustChangePassword: false,
        };
      },
    }),
    CredentialsProvider({
      id: "admin-secure",
      name: "admin-secure",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Generated Password", type: "password" },
        accessKey: { label: "Access Key", type: "text" },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password || !credentials?.accessKey) {
          throw new Error("INVALID_ADMIN_LOGIN");
        }

        await ensureAdminSecuritySchemaCompatibility();

        const normalizedEmail = credentials.email.trim().toLowerCase();
        const ipAddress = getClientIpAddress(req?.headers?.["x-forwarded-for"] as string | undefined);
        const userAgent = (req?.headers?.["user-agent"] as string | undefined) || "";
        const limiterKey = `admin-secure-login:${ipAddress}:${hashIdentifier(normalizedEmail)}`;
        const loginLimit = applyAuthRateLimit(limiterKey, { windowMs: 15 * 60 * 1000, max: 5 });
        const attemptToken = `${loginLimit.attempts}:${loginLimit.max}`;

        logAdminSecureDebug("login_attempt", {
          email: normalizedEmail,
          ipAddress,
          attempts: loginLimit.attempts,
          maxAttempts: loginLimit.max,
          accessKeyLength: credentials.accessKey.length,
          passwordLength: credentials.password.length,
        });

        if (!loginLimit.allowed) {
          await logAdminSecurityEventSafe({
            email: normalizedEmail,
            ip: ipAddress,
            success: false,
            event: "login_failure",
          });
          throw new Error(`ADMIN_LOGIN_RATE_LIMITED:${attemptToken}:${loginLimit.retryAfterSeconds}`);
        }

        if (!isAllowedAdminGenerator(normalizedEmail)) {
          await logAdminSecurityEventSafe({
            email: normalizedEmail,
            ip: ipAddress,
            success: false,
            event: "login_failure",
          });
          throw new Error(`ADMIN_EMAIL_NOT_ALLOWED:${attemptToken}`);
        }

        const user = await prisma.user.findUnique({
          where: { email: normalizedEmail },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            sessionVersion: true,
          },
        });

        if (!user || user.role !== "admin") {
          await logAdminSecurityEventSafe({ email: normalizedEmail, ip: ipAddress, success: false, event: "login_failure" });
          throw new Error(`ADMIN_ACCOUNT_NOT_READY:${attemptToken}`);
        }

        const consumedCredentials = await validateAndConsumeAdminLoginCredentials({
          rawAccessKey: credentials.accessKey,
          rawPassword: credentials.password,
        });

        if (!consumedCredentials.ok) {
          logAdminSecureDebug("credential_validation_failed", {
            email: normalizedEmail,
            reason: consumedCredentials.reason,
            accessKeyState: consumedCredentials.accessKeyState,
            passwordState: consumedCredentials.passwordState,
            attempts: loginLimit.attempts,
            maxAttempts: loginLimit.max,
          });

          await logAdminSecurityEventSafe({ email: normalizedEmail, ip: ipAddress, success: false, event: "login_failure" });
          await logAuthAuditEventSafe({
            event: "admin_secure_login",
            status: "failure",
            email: normalizedEmail,
            userType: "admin",
            ipAddress,
            userAgent,
            metadata: {
              reason: consumedCredentials.reason,
              accessKeyState: consumedCredentials.accessKeyState,
              passwordState: consumedCredentials.passwordState,
            },
          });

          if (consumedCredentials.reason === "access_key_expired") {
            throw new Error(`ADMIN_ACCESS_KEY_EXPIRED:${attemptToken}`);
          }
          if (consumedCredentials.reason === "access_key_used") {
            throw new Error(`ADMIN_ACCESS_KEY_USED:${attemptToken}`);
          }
          if (consumedCredentials.reason === "password_expired") {
            throw new Error(`ADMIN_PASSWORD_EXPIRED:${attemptToken}`);
          }
          if (consumedCredentials.reason === "password_used") {
            throw new Error(`ADMIN_PASSWORD_USED:${attemptToken}`);
          }
          if (consumedCredentials.reason === "credentials_already_used") {
            throw new Error(`ADMIN_CREDENTIALS_ALREADY_USED:${attemptToken}`);
          }
          if (consumedCredentials.reason === "access_key_invalid") {
            throw new Error(`ADMIN_ACCESS_KEY_INVALID:${attemptToken}`);
          }

          throw new Error(`ADMIN_PASSWORD_INVALID:${attemptToken}`);
        }

        logAdminSecureDebug("credential_validation_succeeded", {
          email: normalizedEmail,
          accessKeyId: consumedCredentials.access.id,
          passwordId: consumedCredentials.password.id,
          accessKeyExpiresAt: consumedCredentials.access.expiresAt.toISOString(),
          passwordExpiresAt: consumedCredentials.password.expiresAt.toISOString(),
          bundleId: consumedCredentials.access.bundleId,
        });

        resetAuthRateLimit(limiterKey);

        await logAdminSecurityEventSafe({ email: normalizedEmail, ip: ipAddress, success: true, event: "login_success" });
        await logAuthAuditEventSafe({
          event: "admin_secure_login",
          status: "success",
          email: normalizedEmail,
          userType: "admin",
          ipAddress,
          userAgent,
          metadata: { accessKeyId: consumedCredentials.access.id },
        });

        return {
          id: user.id,
          name: user.name || user.email,
          email: user.email,
          role: user.role,
          sessionVersion: user.sessionVersion || 0,
          mustChangePassword: false,
          adminSecurityVerified: true,
          adminAccessKeyId: consumedCredentials.access.id,
          adminAccessKeyExpiresAt: consumedCredentials.access.expiresAt.toISOString(),
          adminSessionExpiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        };
      },
    }),
    CredentialsProvider({
      id: "otp",
      name: "otp",
      credentials: {
        email: { label: "Email", type: "email" },
        userType: { label: "User Type", type: "text" },
        challengeId: { label: "Challenge ID", type: "text" },
        code: { label: "Code", type: "text" },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.userType || !credentials?.challengeId || !credentials?.code) {
          throw new Error("INVALID_OTP");
        }

        if (!["user", "vendor"].includes(credentials.userType)) {
          throw new Error("INVALID_OTP");
        }

        const normalizedEmail = credentials.email.trim().toLowerCase();
        const ipAddress = getClientIpAddress(req?.headers?.["x-forwarded-for"] as string | undefined);
        const userAgent = (req?.headers?.["user-agent"] as string | undefined) || "";
        const limiterKey = `otp-verify:${ipAddress}:${hashIdentifier(normalizedEmail)}`;
        const otpVerifyLimit = applyAuthRateLimit(limiterKey, OTP_VERIFY_RATE_LIMIT);
        if (!otpVerifyLimit.allowed) {
          await logAuthAuditEvent({
            event: "otp_verification",
            status: "blocked",
            email: normalizedEmail,
            userType: credentials.userType as "user" | "vendor",
            ipAddress,
            userAgent,
            metadata: { reason: "rate_limited" },
          });
          throw new Error("OTP_RATE_LIMITED");
        }

        const otpResult = await verifyOtpChallenge({
          challengeId: credentials.challengeId,
          code: credentials.code,
        });

        if (!otpResult.success) {
          await logAuthAuditEvent({
            event: "otp_verification",
            status: "failure",
            email: normalizedEmail,
            userType: credentials.userType as "user" | "vendor",
            ipAddress,
            userAgent,
            metadata: { reason: otpResult.reason },
          });
          if (otpResult.reason === "expired") {
            throw new Error("OTP_EXPIRED");
          }

          if (otpResult.reason === "locked") {
            throw new Error("OTP_LOCKED");
          }

          throw new Error("INVALID_OTP");
        }

        if (!otpResult.challenge || otpResult.challenge.email !== normalizedEmail || otpResult.challenge.userType !== credentials.userType) {
          throw new Error("OTP_CHALLENGE_MISMATCH");
        }

        const account = await findAccountByEmail(credentials.userType as "user" | "vendor", normalizedEmail);
        if (!account) {
          throw new Error("OTP_ACCOUNT_NOT_FOUND");
        }

        if (!account.emailVerified) {
          await markEmailVerified(credentials.userType as "user" | "vendor", account.id);
        }

        if (credentials.userType === "user") {
          await prisma.user.update({ where: { id: account.id }, data: { lastLoginAt: new Date() }, select: { id: true } });
        } else {
          await prisma.vendor.update({ where: { id: account.id }, data: { lastLoginAt: new Date() } });
        }

        await logAuthAuditEvent({
          event: "otp_verification",
          status: "success",
          email: normalizedEmail,
          userType: credentials.userType as "user" | "vendor",
          ipAddress,
          userAgent,
        });

        return {
          id: account.id,
          name: account.name || account.email,
          email: account.email,
          role: account.role,
          storeName: undefined,
          sessionVersion: account.sessionVersion || 0,
          mustChangePassword: false,
        };
      },
    }),
  ],

  session: {
    strategy: "jwt",
    maxAge: 60 * 60,
    updateAge: 15 * 60,
  },

  callbacks: {
    async signIn({ user, account }) {
      if (!account || !user?.email) {
        return true;
      }

      if (account.provider === "google") {
        try {
          let verifiedProfile: {
            googleId: string;
            email: string;
            name: string;
            picture: string | null;
          };

          try {
            verifiedProfile = account.id_token
              ? await verifyGoogleIdToken(account.id_token)
              : await verifyGoogleAccessToken(account.access_token || "");
          } catch (tokenError) {
            if (!user.email || !account.providerAccountId) {
              throw tokenError;
            }

            verifiedProfile = {
              googleId: account.providerAccountId,
              email: user.email.trim().toLowerCase(),
              name: user.name || user.email,
              picture: (user as any).image || null,
            };
          }

          const normalizedEmail = verifiedProfile.email;

          const linkedGoogleAccount = await prisma.account.findUnique({
            where: {
              provider_providerAccountId: {
                provider: "google",
                providerAccountId: verifiedProfile.googleId,
              },
            },
            include: {
              user: {
                select: {
                  id: true,
                  role: true,
                },
              },
            },
          });

          if (linkedGoogleAccount?.user) {
            await prisma.user.update({
              where: { id: linkedGoogleAccount.user.id },
              data: {
                emailVerified: new Date(),
                lastLoginAt: new Date(),
                image: verifiedProfile.picture,
                name: user.name || verifiedProfile.name,
              },
              select: { id: true },
            });

            (user as any).id = linkedGoogleAccount.user.id;
            (user as any).role = linkedGoogleAccount.user.role;

            await logAuthAuditEventSafe({
              event: "oauth_login",
              status: "success",
              email: normalizedEmail,
              userType: linkedGoogleAccount.user.role === "vendor" ? "vendor" : "user",
              metadata: {
                provider: "google",
                providerAccountId: account.providerAccountId,
                mode: "linked_account",
              },
            });

            return true;
          }

          const existingUser = await prisma.user.findUnique({
            where: { email: normalizedEmail },
            select: {
              id: true,
              role: true,
              name: true,
            },
          });

          if (existingUser) {
            if (existingUser.role === "admin") {
              await logAuthAuditEventSafe({
                event: "oauth_login",
                status: "blocked",
                email: normalizedEmail,
                userType: "admin",
                metadata: {
                  provider: "google",
                  reason: "admin_google_login_blocked",
                },
              });
              return "/auth/login?error=OAuthAccountNotLinked";
            }

            await prisma.user.update({
              where: { id: existingUser.id },
              data: {
                name: existingUser.name || verifiedProfile.name,
                image: verifiedProfile.picture,
                emailVerified: new Date(),
                lastLoginAt: new Date(),
              },
              select: { id: true },
            });

            (user as any).id = existingUser.id;
            (user as any).role = existingUser.role;

            await prisma.account.upsert({
              where: {
                provider_providerAccountId: {
                  provider: "google",
                  providerAccountId: verifiedProfile.googleId,
                },
              },
              update: {
                userId: existingUser.id,
                type: account.type,
                access_token: account.access_token,
                refresh_token: account.refresh_token,
                token_type: account.token_type,
                expires_at: account.expires_at,
                id_token: account.id_token,
                scope: account.scope,
                session_state: account.session_state,
              },
              create: {
                userId: existingUser.id,
                type: account.type,
                provider: "google",
                providerAccountId: verifiedProfile.googleId,
                access_token: account.access_token,
                refresh_token: account.refresh_token,
                token_type: account.token_type,
                expires_at: account.expires_at,
                id_token: account.id_token,
                scope: account.scope,
                session_state: account.session_state,
              },
            });

            await cleanupDisposableOAuthUser(user.id);

            await logAuthAuditEventSafe({
              event: "oauth_login",
              status: "success",
              email: normalizedEmail,
              userType: existingUser.role === "vendor" ? "vendor" : "user",
              metadata: {
                provider: "google",
                providerAccountId: account.providerAccountId,
                mode: "email_linked",
              },
            });

            return true;
          }

          await cleanupDisposableOAuthUser(user.id);

          const onboardingToken = createGoogleOnboardingToken({
            googleId: verifiedProfile.googleId,
            email: verifiedProfile.email,
            name: verifiedProfile.name,
            picture: verifiedProfile.picture,
          });

          await logAuthAuditEventSafe({
            event: "oauth_login",
            status: "blocked",
            email: verifiedProfile.email,
            userType: "user",
            metadata: {
              provider: "google",
              reason: "onboarding_required",
              providerAccountId: account.providerAccountId,
            },
          });

          return `/auth/google-onboarding?token=${encodeURIComponent(onboardingToken)}`;
        } catch (error) {
          const email = (user.email || "").trim().toLowerCase();
          logger.error("[NextAuth] Google callback failure", {
            providerAccountId: account.providerAccountId,
            email,
            reason: error instanceof Error ? error.message : "oauth_callback_failed",
          });
          if (email) {
            await logAuthAuditEventSafe({
              event: "oauth_login",
              status: "failure",
              email,
              userType: "user",
              metadata: {
                provider: "google",
                reason: error instanceof Error ? error.message : "oauth_callback_failed",
                providerAccountId: account.providerAccountId,
              },
            });
          }
          return "/auth/login?error=OAuthCallback";
        }
      }

      return true;
    },

    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id || token.sub;        // Keep stable id in JWT for downstream session mapping.
        token.role = user.role || token.role;
        token.storeName = user.storeName;
        token.sessionVersion = (user as any).sessionVersion || 0;
        token.mustChangePassword = (user as any).mustChangePassword || false;
        token.adminSecurityVerified = Boolean((user as any).adminSecurityVerified);
        token.adminAccessKeyId = (user as any).adminAccessKeyId || null;
        token.adminAccessKeyExpiresAt = (user as any).adminAccessKeyExpiresAt || null;
        token.adminSessionExpiresAt = (user as any).adminSessionExpiresAt || null;
      }

      // Keep session checks fast: do not perform DB lookups during passive JWT refreshes.
      if (!token.id) {
        token.id = token.sub || null;
      }

      if (!token.role) {
        token.role = "user";
      }

      if (account?.provider === "google" && !token.role) {
        token.role = "user";
      }

      if (token.role === "admin" && token.adminSessionExpiresAt) {
        const expiry = new Date(String(token.adminSessionExpiresAt)).getTime();
        if (!Number.isFinite(expiry) || Date.now() > expiry) {
          token.adminSecurityVerified = false;
          token.adminAccessKeyId = null;
          token.adminAccessKeyExpiresAt = null;
        }
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.id as string) || (token.sub as string) || "";
        session.user.role = (token.role as string) || "user";
        session.user.storeName = (token.storeName as string | null) ?? undefined;
        session.user.mustChangePassword = Boolean(token.mustChangePassword);
        session.user.adminSecurityVerified = Boolean(token.adminSecurityVerified);
        session.user.adminAccessKeyId = (token.adminAccessKeyId as string | null) ?? undefined;
        session.user.adminAccessKeyExpiresAt = (token.adminAccessKeyExpiresAt as string | null) ?? undefined;
        session.user.adminSessionExpiresAt = (token.adminSessionExpiresAt as string | null) ?? undefined;
      }
      return session;
    },

    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) {
        const sanitized = stripOAuthQueryParams(url, baseUrl);
        return sanitized ? sanitized.toString() : `${baseUrl}/`;
      }

      if (url.startsWith(baseUrl)) {
        const sanitized = stripOAuthQueryParams(url, baseUrl);
        return sanitized ? sanitized.toString() : `${baseUrl}/`;
      }

      return `${baseUrl}/`;
    },
  },

  pages: {
    signIn: "/auth/login",
    error: "/auth/login",
  },

  useSecureCookies: process.env.NODE_ENV === "production",

  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === "production" ? "__Secure-next-auth.session-token" : "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "strict",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
    csrfToken: {
      name: process.env.NODE_ENV === "production" ? "__Host-next-auth.csrf-token" : "next-auth.csrf-token",
      options: {
        httpOnly: true,
        sameSite: "strict",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
    callbackUrl: {
      name: process.env.NODE_ENV === "production" ? "__Secure-next-auth.callback-url" : "next-auth.callback-url",
      options: {
        sameSite: "strict",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
};

const nextAuthHandler = NextAuth(authOptions);

function shouldRunAuthSchemaGuard(req: NextApiRequest) {
  const raw = req.query.nextauth;
  const parts = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const leaf = (parts[parts.length - 1] || "").toString().toLowerCase();

  // Session/log endpoints are high-frequency and do not require schema DDL checks.
  if (leaf === "session" || leaf === "_log" || leaf === "csrf" || leaf === "providers") {
    return false;
  }

  return true;
}

export default async function authHandler(req: NextApiRequest, res: NextApiResponse) {
  if (shouldRunAuthSchemaGuard(req)) {
    await ensureAuthSchemaCompatibility();
  }
  return nextAuthHandler(req, res);
}
