import { prisma } from "@/lib/prisma";

export type OutboxEventPayload = {
  topic: string;
  entityType?: string;
  entityId?: string;
  payload: Record<string, unknown>;
};

export type OutboxEventRow = {
  id: string;
  topic: string;
  entityType: string | null;
  entityId: string | null;
  payload: string;
  status: string;
  createdAt: Date;
};

export async function enqueueOutboxEvent(event: OutboxEventPayload): Promise<void> {
  try {
    const id = `outbox_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    await prisma.$executeRawUnsafe(
      `
        INSERT INTO "OutboxEvent" ("id", "topic", "entityType", "entityId", "payload", "status", "attemptCount", "createdAt")
        VALUES ($1, $2, $3, $4, $5, 'pending', 0, NOW())
      `,
      id,
      event.topic,
      event.entityType ?? null,
      event.entityId ?? null,
      JSON.stringify(event.payload)
    );
  } catch (error) {
    console.warn("[outbox] enqueue skipped (table may not exist yet):", error);
  }
}

export async function readOutboxEventsSince(since: Date, limit = 100): Promise<OutboxEventRow[]> {
  try {
    const rows = await prisma.$queryRawUnsafe<OutboxEventRow[]>(
      `
        SELECT "id", "topic", "entityType", "entityId", "payload", "status", "createdAt"
        FROM "OutboxEvent"
        WHERE "createdAt" > $1
        ORDER BY "createdAt" ASC
        LIMIT $2
      `,
      since,
      limit
    );

    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}
