import pino from 'pino';
import { env, isProd } from '../config/env.js';

/**
 * Structured JSON logger. Emits raw JSON on stdout for ingestion by log
 * aggregators (Datadog, Loki, CloudWatch, …). Pipe through `pino-pretty` in dev
 * if human-readable output is preferred: `npm run dev | npx pino-pretty`.
 */
export const logger = pino({
  level: env.NODE_ENV === 'test' ? 'silent' : isProd ? 'info' : 'debug',
  base: { service: 'ttmip-api' },
});
