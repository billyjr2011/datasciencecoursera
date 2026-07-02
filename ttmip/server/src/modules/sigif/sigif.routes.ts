import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';

/**
 * SIGIF2 interlink — production quotas of timber available for sale.
 *
 * When SIGIF2_BASE_URL is configured, POST /sync pulls the ministry's quota
 * registry and refreshes the local mirror; reads are always served from the
 * mirror so the platform stays responsive even if SIGIF2 is unreachable.
 */
export const sigifRouter = Router();

const listQuery = z.object({
  species: z.string().optional(),
  concession: z.string().optional(),
  availableOnly: z.coerce.boolean().optional(),
});

sigifRouter.get(
  '/quotas',
  validate({ query: listQuery }),
  asyncHandler(async (req, res) => {
    const { species, concession, availableOnly } = req.query as unknown as z.infer<typeof listQuery>;
    const quotas = await prisma.sigifQuota.findMany({
      where: {
        ...(species ? { speciesName: species } : {}),
        ...(concession ? { concession: { contains: concession, mode: 'insensitive' } } : {}),
        ...(availableOnly ? { availableM3: { gt: 0 } } : {}),
      },
      orderBy: [{ speciesName: 'asc' }, { availableM3: 'desc' }],
    });
    const totals = {
      concessions: new Set(quotas.map((q) => q.concession)).size,
      totalQuota: +quotas.reduce((a, q) => a + q.yearlyQuota, 0).toFixed(1),
      totalAvailable: +quotas.reduce((a, q) => a + q.availableM3, 0).toFixed(1),
    };
    res.json({ data: quotas, meta: totals });
  }),
);

sigifRouter.post(
  '/sync',
  requireAuth,
  asyncHandler(async (_req, res) => {
    if (!env.SIGIF2_BASE_URL) {
      res.json({ data: { synced: false, reason: 'SIGIF2_BASE_URL not configured — serving mirrored data' } });
      return;
    }
    // Pull the quota registry from SIGIF2 and upsert into the mirror.
    const resp = await fetch(`${env.SIGIF2_BASE_URL}/api/quotas`, {
      headers: { Accept: 'application/json', ...(env.SIGIF2_API_KEY ? { Authorization: `Bearer ${env.SIGIF2_API_KEY}` } : {}) },
    });
    if (!resp.ok) {
      logger.warn({ status: resp.status }, 'SIGIF2 sync failed');
      res.status(502).json({ error: { code: 'SIGIF2_UNAVAILABLE', message: `SIGIF2 responded ${resp.status}` } });
      return;
    }
    const rows = (await resp.json()) as Array<{
      concession: string; titleHolder: string; speciesName: string;
      yearlyQuota: number; usedVolume: number; permitNumber: string; validUntil: string;
    }>;
    let upserts = 0;
    for (const r of rows) {
      await prisma.sigifQuota.upsert({
        where: { concession_speciesName: { concession: r.concession, speciesName: r.speciesName } },
        create: { ...r, availableM3: r.yearlyQuota - r.usedVolume, validUntil: new Date(r.validUntil) },
        update: {
          usedVolume: r.usedVolume,
          availableM3: r.yearlyQuota - r.usedVolume,
          validUntil: new Date(r.validUntil),
          syncedAt: new Date(),
        },
      });
      upserts += 1;
    }
    res.json({ data: { synced: true, upserts } });
  }),
);
