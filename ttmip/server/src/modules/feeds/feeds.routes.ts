import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.js';
import { syncAllPlatforms, syncPlatform } from '../../ingestion/connectors.js';

/** Live-feed status and manual sync for the 22 market platforms. */
export const feedsRouter = Router();

feedsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const platforms = await prisma.platform.findMany({ orderBy: { name: 'asc' } });
    res.json({ data: platforms, meta: { count: platforms.length } });
  }),
);

feedsRouter.post(
  '/sync',
  requireAuth,
  asyncHandler(async (_req, res) => {
    const results = await syncAllPlatforms();
    res.json({ data: results, meta: { totalWritten: results.reduce((a, r) => a + r.written, 0) } });
  }),
);

feedsRouter.post(
  '/sync/:name',
  requireAuth,
  asyncHandler(async (req, res) => {
    const written = await syncPlatform(req.params.name);
    res.json({ data: { platform: req.params.name, written } });
  }),
);
