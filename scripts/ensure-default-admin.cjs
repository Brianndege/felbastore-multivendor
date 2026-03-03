const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const email = (process.env.ADMIN_DEFAULT_EMAIL || "").trim().toLowerCase();
const passwordFromEnv = process.env.ADMIN_DEFAULT_PASSWORD || "";
const name = process.env.ADMIN_DEFAULT_NAME || "Platform Admin";

function generateStrongPassword() {
  return `${crypto.randomBytes(12).toString("base64url")}!A9`;
}

(async () => {
  try {
    if (process.env.NODE_ENV === "production" && !email) {
      throw new Error("ADMIN_DEFAULT_EMAIL is required in production.");
    }

    if (!email) {
      throw new Error("ADMIN_DEFAULT_EMAIL is required.");
    }

    const bootstrapPassword = passwordFromEnv || generateStrongPassword();
    const passwordHash = await bcrypt.hash(bootstrapPassword, 10);

    const user = await prisma.user.upsert({
      where: { email },
      update: {
        name,
        password: passwordHash,
        role: "admin",
        isActive: true,
        mustChangePassword: true,
      },
      create: {
        name,
        email,
        password: passwordHash,
        role: "admin",
        isActive: true,
        mustChangePassword: true,
      },
      select: {
        id: true,
        email: true,
        role: true,
      },
    });

    console.log("DEFAULT_ADMIN_READY");
    console.log(`email=${user.email}`);
    console.log(`role=${user.role}`);
    console.log("adminLoginPath=/auth/admin-login");
    console.log("mustChangePassword=true");
    if (!passwordFromEnv) {
      console.log(`temporaryPassword=${bootstrapPassword}`);
      console.warn("WARNING: Temporary admin password was generated. Rotate immediately after first login.");
    }
  } catch (error) {
    console.error("FAILED_TO_ENSURE_DEFAULT_ADMIN:", error?.message || error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();
