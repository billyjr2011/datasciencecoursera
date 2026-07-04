import dotenv from "dotenv";

// Load .env from repo root (one level above server/) and server/.env if present.
dotenv.config({ path: "../.env" });
dotenv.config();

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: process.env.DATABASE_URL ?? "",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  anthropicModel: process.env.ANTHROPIC_MODEL ?? "claude-opus-4-8",
  jwtSecret: process.env.JWT_SECRET ?? "dev-secret-change-me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
  bcryptRounds: Number(process.env.BCRYPT_ROUNDS ?? 12),
  corsOrigins: (process.env.CORS_ORIGINS ?? "http://localhost:5173").split(",").map((s) => s.trim()),
  isProd: (process.env.NODE_ENV ?? "development") === "production",
};

/** Fail fast in production if critical secrets are missing. */
export function assertProductionEnv(): void {
  if (env.isProd) {
    required("DATABASE_URL");
    required("ANTHROPIC_API_KEY");
    required("JWT_SECRET");
  }
}
