import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { validate } from '../../middleware/validate.js';
import { HttpError } from '../../utils/httpError.js';

/**
 * Price indices — GSPI (Global Sawlog Price Index) and ESPI (European Sawlog
 * Price Index). Each index carries a time series of monthly points.
 */
export const indicesRouter = Router();

indicesRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const indices = await prisma.priceIndex.findMany({
      include: { points: { orderBy: { date: 'desc' }, take: 1 } },
    });
    const data = indices.map((idx) => ({
      code: idx.code,
      name: idx.name,
      description: idx.description,
      latest: idx.points[0]?.value ?? null,
      latestDate: idx.points[0]?.date ?? null,
    }));
    res.json({ data });
  }),
);

indicesRouter.get(
  '/:code',
  validate({ params: z.object({ code: z.string().min(1) }) }),
  asyncHandler(async (req, res) => {
    const code = req.params.code.toUpperCase();
    const index = await prisma.priceIndex.findUnique({
      where: { code },
      include: { points: { orderBy: { date: 'asc' } } },
    });
    if (!index) throw HttpError.notFound(`Index ${code} not found`);

    res.json({
      data: {
        code: index.code,
        name: index.name,
        description: index.description,
        series: index.points.map((p) => ({ date: p.date, value: p.value })),
      },
    });
  }),
);
