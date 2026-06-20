import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { corsOrigins, env } from './config/env.js';
import { logger } from './lib/logger.js';
import { prisma } from './lib/prisma.js';
import { rateLimit } from './middleware/rateLimit.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { asyncHandler } from './utils/asyncHandler.js';
import { apiRouter } from './routes.js';

export function createApp(): Express {
  const app = express();

  // Trust the reverse proxy so `req.ip` and rate limiting work behind a LB.
  app.set('trust proxy', 1);

  app.use(
    helmet({
      // Allow the bundled dashboard to load Google Fonts.
      contentSecurityPolicy: false,
    }),
  );
  app.use(cors({ origin: corsOrigins.length ? corsOrigins : true, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(pinoHttp({ logger, autoLogging: env.NODE_ENV !== 'test' }));

  // ── Health & readiness ──────────────────────────────────
  app.get('/healthz', (_req, res) => res.json({ status: 'ok', uptime: process.uptime() }));
  app.get(
    '/readyz',
    asyncHandler(async (_req, res) => {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: 'ready' });
    }),
  );

  // ── API ─────────────────────────────────────────────────
  app.use('/api/v1', rateLimit, apiRouter);

  // ── Static frontend (the TTMIP dashboard) ───────────────
  // In production the API also serves the built dashboard so a single container
  // can run the whole product. Behind a CDN, this is simply skipped.
  // app.ts lives at server/src (dev) or server/dist (prod) — both one level
  // under server/, so the dashboard is at ../../web in either case.
  const here = path.dirname(fileURLToPath(import.meta.url));
  const webDir = path.resolve(here, '../../web');
  app.use(express.static(webDir));

  // ── Fallbacks ───────────────────────────────────────────
  app.use('/api', notFoundHandler);
  app.use(errorHandler);

  return app;
}
