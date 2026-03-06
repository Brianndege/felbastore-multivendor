const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
async function main() {
  const user = await prisma.user.findUnique({ where: { email: "ndegebrian4@gmail.com" } });
  console.log(user);
}
main().catch(console.error).finally(() => prisma.$disconnect());
