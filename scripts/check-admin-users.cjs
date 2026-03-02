const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

(async () => {
  try {
    const admins = await prisma.user.findMany({
      where: { role: "admin" },
      select: {
        email: true,
        isActive: true,
        createdAt: true,
      },
    });

    console.log(JSON.stringify(admins, null, 2));
  } catch (error) {
    console.error(error?.message || error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();
