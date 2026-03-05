import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { PaymentMethodKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { enforceCsrfOrigin } from "@/lib/csrf";
import { createRandomToken } from "@/lib/auth/security";
import { verifyGoogleOnboardingToken } from "@/lib/auth/google-oauth";

const roleSchema = z.enum(["buyer", "vendor", "both"]);

const payloadSchema = z.object({
  token: z.string().min(20),
  role: roleSchema,
  acceptTerms: z.literal(true),
  storeName: z.string().trim().max(120).optional(),
  storeSlug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80).optional(),
  businessInfo: z.string().trim().max(2000).optional(),
  payoutMethod: z.enum(["MPESA", "BANK_TRANSFER", "CARD"]).optional(),
  payoutAccount: z.string().trim().max(200).optional(),
});

function toUserRole(role: z.infer<typeof roleSchema>) {
  if (role === "buyer") return "user";
  if (role === "vendor") return "vendor";
  return "both";
}

function requiresVendorProfile(role: z.infer<typeof roleSchema>) {
  return role === "vendor" || role === "both";
}

function getStoreSlugUrl(slug: string) {
  const appUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "https://felbastore.co.ke";
  return `${appUrl.replace(/\/$/, "")}/vendors/${slug}`;
}

function isAdminRole(role: string | null | undefined) {
  return String(role || "").toLowerCase() === "admin";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    const token = typeof req.query.token === "string" ? req.query.token : "";

    if (!token) {
      return res.status(400).json({ error: "MISSING_TOKEN" });
    }

    try {
      const profile = verifyGoogleOnboardingToken(token);
      return res.status(200).json({
        profile: {
          email: profile.email,
          name: profile.name,
          picture: profile.picture,
        },
      });
    } catch (error) {
      const code = error instanceof Error ? error.message : "INVALID_GOOGLE_ONBOARDING_TOKEN";
      return res.status(400).json({ error: code });
    }
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });
  }

  if (!enforceCsrfOrigin(req, res)) {
    return;
  }

  const parsed = payloadSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "INVALID_PAYLOAD" });
  }

  const { token, role, acceptTerms, storeName, storeSlug, businessInfo, payoutMethod, payoutAccount } = parsed.data;
  if (!acceptTerms) {
    return res.status(400).json({ error: "TERMS_REQUIRED" });
  }

  if (requiresVendorProfile(role)) {
    if (!storeName || !storeSlug || !payoutMethod || !payoutAccount) {
      return res.status(400).json({ error: "VENDOR_FIELDS_REQUIRED" });
    }
  }

  let verifiedProfile;
  try {
    verifiedProfile = verifyGoogleOnboardingToken(token);
  } catch (error) {
    const code = error instanceof Error ? error.message : "INVALID_GOOGLE_ONBOARDING_TOKEN";
    return res.status(400).json({ error: code });
  }

  const email = verifiedProfile.email;
  const roleValue = toUserRole(role);

  try {
    const existingLinkedAccount = await prisma.account.findUnique({
      where: {
        provider_providerAccountId: {
          provider: "google",
          providerAccountId: verifiedProfile.googleId,
        },
      },
      include: {
        user: {
          select: {
            role: true,
          },
        },
      },
    });

    if (existingLinkedAccount) {
      const linkedRole = existingLinkedAccount.user?.role || "user";
      return res.status(200).json({
        linked: true,
        redirectUrl: linkedRole === "vendor" || linkedRole === "both" ? "/vendors/dashboard" : "/",
      });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser && isAdminRole(existingUser.role)) {
      return res.status(409).json({ error: "ADMIN_ACCOUNT_CANNOT_LINK_GOOGLE" });
    }

    const existingVendor = await prisma.vendor.findUnique({ where: { email } });

    const { resolvedRole, redirectUrl } = await prisma.$transaction(async (tx) => {
      let userId = existingUser?.id || "";
      let finalRole = existingUser?.role || roleValue;

      if (!userId) {
        const createdUser = await tx.user.create({
          data: {
            name: verifiedProfile.name,
            email,
            image: verifiedProfile.picture,
            emailVerified: new Date(),
            role: roleValue,
          },
          select: { id: true, role: true },
        });
        userId = createdUser.id;
        finalRole = createdUser.role;
      } else {
        const nextRole = existingUser?.role === "user" && roleValue !== "user" ? roleValue : existingUser?.role || roleValue;
        const updatedUser = await tx.user.update({
          where: { id: userId },
          data: {
            name: existingUser?.name || verifiedProfile.name,
            image: verifiedProfile.picture,
            emailVerified: existingUser?.emailVerified || new Date(),
            role: nextRole,
            lastLoginAt: new Date(),
          },
          select: { role: true },
        });
        finalRole = updatedUser.role;
      }

      await tx.account.create({
        data: {
          userId,
          type: "oauth",
          provider: "google",
          providerAccountId: verifiedProfile.googleId,
          session_state: createRandomToken(8),
        },
      });

      if (requiresVendorProfile(role)) {
        const normalizedStoreName = storeName!.trim();
        const normalizedStoreSlug = storeSlug!.trim().toLowerCase();
        const website = getStoreSlugUrl(normalizedStoreSlug);

        if (!existingVendor) {
          await tx.vendor.create({
            data: {
              name: verifiedProfile.name,
              email,
              storeName: normalizedStoreName,
              role: "vendor",
              password: null,
              emailVerified: new Date(),
              isVerified: false,
              description: businessInfo?.trim() || null,
              website,
            },
          });
        } else {
          await tx.vendor.update({
            where: { id: existingVendor.id },
            data: {
              name: existingVendor.name || verifiedProfile.name,
              storeName: existingVendor.storeName || normalizedStoreName,
              description: existingVendor.description || businessInfo?.trim() || null,
              website: existingVendor.website || website,
              emailVerified: existingVendor.emailVerified || new Date(),
            },
          });
        }

        const vendor = await tx.vendor.findUnique({ where: { email }, select: { id: true } });
        if (vendor) {
          const existingPayout = await tx.vendorPaymentMethod.findFirst({
            where: {
              vendorId: vendor.id,
              label: "Primary payout",
            },
            select: { id: true },
          });

          if (existingPayout) {
            await tx.vendorPaymentMethod.update({
              where: { id: existingPayout.id },
              data: {
                methodKind: payoutMethod as PaymentMethodKind,
                config: JSON.stringify({ account: payoutAccount, storeSlug: normalizedStoreSlug }),
                approvalStatus: "pending_admin",
                isActive: false,
              },
            });
          } else {
            await tx.vendorPaymentMethod.create({
              data: {
                vendorId: vendor.id,
                methodKind: payoutMethod as PaymentMethodKind,
                label: "Primary payout",
                config: JSON.stringify({ account: payoutAccount, storeSlug: normalizedStoreSlug }),
                approvalStatus: "pending_admin",
                isActive: false,
              },
            });
          }
        }
      }

      return {
        resolvedRole: finalRole,
        redirectUrl: finalRole === "vendor" || finalRole === "both" ? "/vendors/dashboard" : "/",
      };
    });

    // --- CLIENT-SIDE GOOGLE SIGN-IN PATCH ---
    // After onboarding, redirect to login-success page to trigger Google sign-in in browser
    const callbackUrl = encodeURIComponent(redirectUrl);
    console.log("User found and onboarded. Redirecting to login-success for client-side Google sign-in.");
    res.writeHead(302, { Location: `/auth/login-success?callbackUrl=${callbackUrl}` });
    res.end();
    return;
    // --- END PATCH ---
  } catch (err) {
    console.error("GOOGLE_ONBOARDING_FAILED", err);
    return res.status(500).json({ error: "GOOGLE_ONBOARDING_FAILED" });
  }
}
