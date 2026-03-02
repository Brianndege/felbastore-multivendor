const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const email = process.env.ADMIN_DEFAULT_EMAIL || "admin@felbastore.local";
const password = process.env.ADMIN_DEFAULT_PASSWORD || "Admin@12345!";
const name = process.env.ADMIN_DEFAULT_NAME || "Platform Admin";

(async () => {
  try {
    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.upsert({
      where: { email },
      update: {
        name,
        password: passwordHash,
        role: "admin",
        isActive: true,
      },
      create: {
        name,
        email,
        password: passwordHash,
        role: "admin",
        isActive: true,
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
    if (!process.env.ADMIN_DEFAULT_PASSWORD) {
      console.warn("WARNING: Using fallback default admin password. Set ADMIN_DEFAULT_PASSWORD for production.");
    }
  } catch (error) {
    console.error("FAILED_TO_ENSURE_DEFAULT_ADMIN:", error?.message || error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();
