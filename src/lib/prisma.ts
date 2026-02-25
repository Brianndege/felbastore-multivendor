import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient | undefined };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development'
      ? ["query", "info", "warn", "error"]
      : ["error", "warn"],
    errorFormat: 'pretty',
  });

// Test connection on initialization
if (!globalForPrisma.prisma) {
  console.log('[Prisma] Initializing Prisma Client...');
  prisma.$connect()
    .then(() => {
      console.log('[Prisma] Database connection established successfully');
    })
    .catch((error) => {
      console.error('[Prisma] Failed to connect to database:', error);
      console.error('[Prisma] Please check your DATABASE_URL in .env file');
    });
}

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
