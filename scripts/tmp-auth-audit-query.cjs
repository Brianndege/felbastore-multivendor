const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
(async () => {
  const rows = await prisma.authAuditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { createdAt: true, event: true, status: true, userType: true, metadata: true },
  });
  console.log(JSON.stringify(rows, null, 2));
  await prisma.$disconnect();
})().catch(async (error) => {
  console.error("QUERY_FAILED", error.message);
  try { await prisma.$disconnect(); } catch {}
  process.exit(1);
});
