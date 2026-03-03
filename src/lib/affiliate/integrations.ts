import { prisma } from "@/lib/prisma";

type IntegrationMode = "api" | "feed" | "deeplink";

export type AffiliateSyncInput = {
  network: string;
  mode: IntegrationMode;
};

export type AffiliateSyncResult = {
  importedCount: number;
  updatedCount: number;
  failedCount: number;
};

export async function runAffiliateSync(input: AffiliateSyncInput): Promise<AffiliateSyncResult> {
  if (input.mode === "deeplink") {
    return { importedCount: 0, updatedCount: 0, failedCount: 0 };
  }

  if (input.mode === "api") {
    return { importedCount: 0, updatedCount: 0, failedCount: 0 };
  }

  return { importedCount: 0, updatedCount: 0, failedCount: 0 };
}

export async function runAndLogAffiliateSync(input: AffiliateSyncInput) {
  const started = new Date();
  const run = await prisma.affiliateSyncRun.create({
    data: {
      network: input.network as any,
      mode: input.mode,
      status: "running",
      startedAt: started,
    },
  });

  try {
    const result = await runAffiliateSync(input);
    await prisma.affiliateSyncRun.update({
      where: { id: run.id },
      data: {
        status: "success",
        importedCount: result.importedCount,
        updatedCount: result.updatedCount,
        failedCount: result.failedCount,
        finishedAt: new Date(),
      },
    });
    return result;
  } catch (error) {
    await prisma.affiliateSyncRun.update({
      where: { id: run.id },
      data: {
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
        finishedAt: new Date(),
      },
    });
    throw error;
  }
}