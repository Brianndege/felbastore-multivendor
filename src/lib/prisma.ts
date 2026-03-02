import { PrismaClient } from '@prisma/client';
import { logger } from '@/lib/logger';

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
  logger.info('[Prisma] Initializing Prisma Client...');
  prisma.$connect()
    .then(() => {
      logger.info('[Prisma] Database connection established successfully');
    })
    .catch((error) => {
      logger.error('[Prisma] Failed to connect to database:', error);
      logger.error('[Prisma] Please check your DATABASE_URL in .env file');
    });
}

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
