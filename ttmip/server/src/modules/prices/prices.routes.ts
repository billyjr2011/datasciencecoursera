import { Router } from 'express';
import { z } from 'zod';
import { Prisma, Quality } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { validate } from '../../middleware/validate.js';

export const pricesRouter = Router();

const listQuery = z.object({
  species: z.string().optional(),
  destination: z.string().optional(), // market code
  platform: z.string().optional(),
  quality: z.nativeEnum(Quality).optional(),
  q: z.string().optional(), // free-text search across species/platform
  limit: z.coerce.number().int().min(1).max(1000).default(200),
});

/**
 * Flattens a price record into the shape the dashboard already consumes,
 * so the frontend can hydrate its `priceData` array with zero transformation.
 */
function toDto(r: Prisma.PriceRecordGetPayload<{ include: { species: true; market: true; platform: true } }>) {
  return {
    id: r.id,
    platform: r.platform.name,
    species: r.species.name,
    destination: r.market.code,
    destName: r.market.name,
    price: r.price,
    volume: r.volume,
    quality: r.quality.charAt(0) + r.quality.slice(1).toLowerCase(), // HIGH -> High
    ts: r.recordedAt,
  };
}

pricesRouter.get(
  '/',
  validate({ query: listQuery }),
  asyncHandler(async (req, res) => {
    const { species, destination, platform, quality, q, limit } = req.query as unknown as z.infer<
      typeof listQuery
    >;

    const where: Prisma.PriceRecordWhereInput = {
      ...(quality ? { quality } : {}),
      ...(species ? { species: { name: species } } : {}),
      ...(destination ? { market: { code: destination } } : {}),
      ...(platform ? { platform: { name: platform } } : {}),
      ...(q
        ? {
            OR: [
              { species: { name: { contains: q, mode: 'insensitive' } } },
              { platform: { name: { contains: q, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const records = await prisma.priceRecord.findMany({
      where,
      include: { species: true, market: true, platform: true },
      orderBy: { recordedAt: 'desc' },
      take: limit,
    });

    res.json({ data: records.map(toDto), meta: { count: records.length } });
  }),
);
