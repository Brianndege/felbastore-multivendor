const requiredServerVariables = ["DATABASE_URL", "JWT_SECRET"] as const;

type RequiredServerVariable = (typeof requiredServerVariables)[number];

export function assertFunctionEnv(): void {
  const missing = requiredServerVariables.filter((name) => {
    const value = process.env[name as RequiredServerVariable];
    return !value || value.trim().length === 0;
  });

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
}
