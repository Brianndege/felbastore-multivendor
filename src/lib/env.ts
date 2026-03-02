import { z } from "zod";

const productionEnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(1),
});

let validated = false;

export function validateRuntimeEnv() {
  const isProductionBuildPhase = process.env.NEXT_PHASE === "phase-production-build";

  if (validated || process.env.NODE_ENV !== "production" || isProductionBuildPhase) {
    return;
  }

  const envToValidate = {
    DATABASE_URL: process.env.DATABASE_URL,
    JWT_SECRET: process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET,
  };

  const result = productionEnvSchema.safeParse(envToValidate);

  if (!result.success) {
    const missing = result.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`Invalid production environment configuration. Missing or invalid keys: ${missing}`);
  }

  validated = true;
}
