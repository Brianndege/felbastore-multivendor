import { PrismaClient } from '@prisma/client';
import { logger } from '@/lib/logger';

const globalForPrisma = global as unknown as { prisma: PrismaClient | undefined };

function looksLikePooledConnection(url: string): boolean {
  const normalized = url.toLowerCase();
  return normalized.includes("pooler") || normalized.includes("pgbouncer") || normalized.includes("connection_limit=");
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development'
      ? ["query", "info", "warn", "error"]
      : ["error", "warn"],
    errorFormat: 'pretty',
  });

if (!globalForPrisma.prisma) {
  globalForPrisma.prisma = prisma;
}

if (!globalForPrisma.prisma) {
  logger.info('[Prisma] Client initialized (lazy connection mode)');

  const databaseUrl = process.env.DATABASE_URL || '';
  if (process.env.NODE_ENV === 'production' && databaseUrl && !looksLikePooledConnection(databaseUrl)) {
    logger.warn("[Prisma] DATABASE_URL may not be using a pooled endpoint. Consider Neon's pooler/PgBouncer to reduce 500/499 spikes under load.");
  }
}

// Keep explicit global assignment for singleton behavior in dev and serverful production contexts.
