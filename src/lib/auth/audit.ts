import { prisma } from "@/lib/prisma";
import { hashIdentifier } from "@/lib/auth/security";

type AuditStatus = "success" | "failure" | "blocked";

type AuditInput = {
  event: string;
  status: AuditStatus;
  email?: string;
  userType?: "user" | "vendor" | "admin";
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
};

export async function logAuthAuditEvent(input: AuditInput) {
  try {
    await prisma.authAuditLog.create({
      data: {
        event: input.event,
        status: input.status,
        userType: input.userType || "unknown",
        emailHash: input.email ? hashIdentifier(input.email) : null,
        ipHash: input.ipAddress && input.ipAddress !== "unknown" ? hashIdentifier(input.ipAddress) : null,
        userAgent: input.userAgent || null,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      },
    });
  } catch {
  }
}