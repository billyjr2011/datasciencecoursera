import 'dotenv/config';
import { z } from 'zod';

/**
 * Validated, typed environment configuration.
 * Fails fast at boot if anything required is missing or malformed.
 */
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  JWT_ACCESS_SECRET: z.string().min(8, 'JWT_ACCESS_SECRET must be set'),
  JWT_REFRESH_SECRET: z.string().min(8, 'JWT_REFRESH_SECRET must be set'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('7d'),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),

  // Live-feed ingestion (22 market platforms)
  INGESTION_ENABLED: z.coerce.boolean().default(false),
  INGESTION_INTERVAL_MS: z.coerce.number().int().positive().default(300_000),

  // SIGIF2 interlink (Cameroon forest-information system)
  SIGIF2_BASE_URL: z.string().optional(),
  SIGIF2_API_KEY: z.string().optional(),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('❌ Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

export const corsOrigins = env.CORS_ORIGIN.split(',')
  .map((o) => o.trim())
  .filter(Boolean);

export const isProd = env.NODE_ENV === 'production';
