export const DATABASE_CONFIGURATION_ERROR =
  "Database is not configured correctly. Please set a valid DATABASE_URL (postgresql://...) and try again.";

export const DATABASE_UNAVAILABLE_ERROR =
  "Database is currently unavailable. Please try again in a few minutes.";

export function hasValidDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) return false;
  return /^(postgresql|postgres):\/\//i.test(databaseUrl);
}

export function mapDatabaseError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");

  if (message.includes("Error validating datasource") || message.includes("DATABASE_URL")) {
    return DATABASE_CONFIGURATION_ERROR;
  }

  if (
    message.includes("Can't reach database server") ||
    message.includes("P1001") ||
    message.includes("connection") ||
    message.includes("ECONNREFUSED")
  ) {
    return DATABASE_UNAVAILABLE_ERROR;
  }

  if (message.includes("Unique constraint") || message.includes("P2002")) {
    return "A record with these details already exists.";
  }

  return null;
}
