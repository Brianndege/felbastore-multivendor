import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import FacebookProvider from "next-auth/providers/facebook";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import bcrypt from "bcryptjs";
import { findAccountByEmail, markEmailVerified } from "@/lib/auth/account";
import { OTP_TTL_MS, OTP_VERIFY_RATE_LIMIT } from "@/lib/auth/constants";
import { applyAuthRateLimit } from "@/lib/auth/rate-limit";
import { getClientIpAddress, hashIdentifier } from "@/lib/auth/security";
import { logAuthAuditEvent } from "@/lib/auth/audit";
import { createOtpChallenge, verifyOtpChallenge } from "@/lib/auth/otp-service";
import { sendOtpEmail } from "@/lib/email";

const providers: NextAuthOptions["providers"] = [];

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      allowDangerousEmailAccountLinking: true,
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
  adapter: PrismaAdapter(prisma),

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
              mustChangePassword: true,
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

        if (credentials.userType === "admin" && user.mustChangePassword) {
          await logAuthAuditEvent({
            event: "login_attempt",
            status: "blocked",
            email: normalizedEmail,
            userType: "admin",
            ipAddress,
            userAgent,
            metadata: { reason: "password_change_required" },
          });
          throw new Error("PASSWORD_CHANGE_REQUIRED");
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
          await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
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
          mustChangePassword: Boolean(user.mustChangePassword),
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
          throw new Error("INVALID_OTP");
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
          throw new Error("INVALID_OTP");
        }

        const account = await findAccountByEmail(credentials.userType as "user" | "vendor", normalizedEmail);
        if (!account) {
          throw new Error("INVALID_OTP");
        }

        if (!account.emailVerified) {
          await markEmailVerified(credentials.userType as "user" | "vendor", account.id);
        }

        if (credentials.userType === "user") {
          await prisma.user.update({ where: { id: account.id }, data: { lastLoginAt: new Date() } });
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
  },

  callbacks: {
    async signIn({ user, account }) {
      if (!account || !user?.email) {
        return true;
      }

      if (account.provider === "google") {
        const normalizedEmail = user.email.trim().toLowerCase();
        const conflictingVendor = await prisma.vendor.findUnique({
          where: { email: normalizedEmail },
          select: { id: true },
        });

        if (conflictingVendor) {
          await logAuthAuditEvent({
            event: "oauth_login",
            status: "blocked",
            email: normalizedEmail,
            userType: "user",
            metadata: {
              provider: "google",
              reason: "vendor_email_conflict",
              providerAccountId: account.providerAccountId,
            },
          });
          return "/auth/login?error=OAUTH_ROLE_CONFLICT";
        }

        if (user.id) {
          await prisma.user.update({
            where: { id: user.id },
            data: {
              emailVerified: new Date(),
              lastLoginAt: new Date(),
            },
          });
        }

        await logAuthAuditEvent({
          event: "oauth_login",
          status: "success",
          email: normalizedEmail,
          userType: "user",
          metadata: {
            provider: "google",
            providerAccountId: account.providerAccountId,
          },
        });
      }

      return true;
    },

    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;        // 🔥 IMPORTANT
        token.role = user.role;
        token.storeName = user.storeName;
        token.sessionVersion = (user as any).sessionVersion || 0;
        token.mustChangePassword = (user as any).mustChangePassword || false;
      }

      if (token.email && (!token.role || !token.id)) {
        const normalizedEmail = String(token.email).trim().toLowerCase();
        const dbUser = await prisma.user.findUnique({
          where: { email: normalizedEmail },
          select: {
            id: true,
            role: true,
            sessionVersion: true,
            mustChangePassword: true,
          },
        });

        if (dbUser) {
          token.id = dbUser.id;
          token.role = dbUser.role;
          token.sessionVersion = dbUser.sessionVersion || 0;
          token.mustChangePassword = Boolean(dbUser.mustChangePassword);
        }
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;   // 🔥 IMPORTANT
        session.user.role = token.role as string;
        session.user.storeName = (token.storeName as string | null) ?? undefined;
        session.user.mustChangePassword = Boolean(token.mustChangePassword);
      }
      return session;
    },

    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) {
        return `${baseUrl}${url}`;
      }

      if (url.startsWith(baseUrl)) {
        return url;
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
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
    csrfToken: {
      name: process.env.NODE_ENV === "production" ? "__Host-next-auth.csrf-token" : "next-auth.csrf-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
    callbackUrl: {
      name: process.env.NODE_ENV === "production" ? "__Secure-next-auth.callback-url" : "next-auth.callback-url",
      options: {
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
};

export default NextAuth(authOptions);
