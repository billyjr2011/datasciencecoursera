import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

/**
 * Reference data — the slowly-changing dimensions of the platform:
 * tracked species, destination markets, data-source platforms, and companies.
 * These power the dashboard filters and lookups.
 */
export const referenceRouter = Router();

referenceRouter.get(
  '/species',
  asyncHandler(async (_req, res) => {
    const species = await prisma.species.findMany({ orderBy: { name: 'asc' } });
    res.json({ data: species });
  }),
);

referenceRouter.get(
  '/markets',
  asyncHandler(async (_req, res) => {
    const markets = await prisma.market.findMany({ orderBy: { volume: 'desc' } });
    res.json({ data: markets });
  }),
);

referenceRouter.get(
  '/platforms',
  asyncHandler(async (_req, res) => {
    const platforms = await prisma.platform.findMany({ orderBy: { name: 'asc' } });
    res.json({ data: platforms });
  }),
);

referenceRouter.get(
  '/companies',
  asyncHandler(async (_req, res) => {
    const companies = await prisma.company.findMany({ orderBy: { name: 'asc' } });
    res.json({ data: companies });
  }),
);
