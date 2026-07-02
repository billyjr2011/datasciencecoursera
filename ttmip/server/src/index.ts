import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { prisma } from './lib/prisma.js';
import { startIngestionScheduler, stopIngestionScheduler } from './ingestion/connectors.js';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`TTMIP API listening on :${env.PORT} (${env.NODE_ENV})`);
  if (env.INGESTION_ENABLED) startIngestionScheduler(env.INGESTION_INTERVAL_MS);
});

/** Graceful shutdown — drain connections, then close the DB pool. */
async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'Shutting down…');
  stopIngestionScheduler();
  server.close(async () => {
    await prisma.$disconnect();
    logger.info('Closed cleanly');
    process.exit(0);
  });
  // Hard-exit if connections do not drain in time.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => logger.error({ reason }, 'Unhandled rejection'));
