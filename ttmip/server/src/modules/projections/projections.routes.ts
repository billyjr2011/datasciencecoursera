import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { validate } from '../../middleware/validate.js';

/**
 * Price analysis & projection over the ingested multi-platform data.
 * OLS trend + residual band gives a transparent 12-month projection; the
 * service layer is the seam for swapping in ARIMA/Prophet later.
 */
export const projectionsRouter = Router();

const query = z.object({
  species: z.string().optional(),
  destination: z.string().optional(),
  months: z.coerce.number().int().min(1).max(24).default(12),
});

projectionsRouter.get(
  '/',
  validate({ query }),
  asyncHandler(async (req, res) => {
    const { species, destination, months } = req.query as unknown as z.infer<typeof query>;

    const records = await prisma.priceRecord.findMany({
      where: {
        ...(species ? { species: { name: species } } : {}),
        ...(destination ? { market: { code: destination } } : {}),
      },
      orderBy: { recordedAt: 'asc' },
      select: { price: true, recordedAt: true },
      take: 2000,
    });

    if (records.length < 3) {
      res.json({ data: { points: [], projection: [], stats: null } });
      return;
    }

    // Aggregate to daily means so intra-day quote bursts don't dominate, then
    // OLS on day index vs price. With under a week of distinct history a trend
    // is statistically meaningless — project flat and say so.
    const byDay = new Map<string, { sum: number; n: number }>();
    for (const r of records) {
      const day = r.recordedAt.toISOString().slice(0, 10);
      const acc = byDay.get(day) ?? { sum: 0, n: 0 };
      acc.sum += r.price;
      acc.n += 1;
      byDay.set(day, acc);
    }
    const days = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b));
    const t0 = new Date(days[0]![0]).getTime();
    const trendReliable = days.length >= 7;
    const xs = days.map(([d]) => (new Date(d).getTime() - t0) / 86_400_000);
    const ys = days.map(([, v]) => v.sum / v.n);
    const n = xs.length;
    const mx = xs.reduce((a, b) => a + b, 0) / n;
    const my = ys.reduce((a, b) => a + b, 0) / n;
    const sxy = xs.reduce((a, x, i) => a + (x - mx) * (ys[i]! - my), 0);
    const sxx = xs.reduce((a, x) => a + (x - mx) ** 2, 0) || 1;
    const slope = trendReliable ? sxy / sxx : 0;
    const intercept = my - slope * mx;
    const residSd = Math.sqrt(ys.reduce((a, y, i) => a + (y - (intercept + slope * xs[i]!)) ** 2, 0) / Math.max(1, n - 2));

    const lastX = xs[n - 1]!;
    const projection = Array.from({ length: months }, (_, i) => {
      const x = lastX + (i + 1) * 30.4;
      const mean = intercept + slope * x;
      return {
        month: new Date(t0 + x * 86_400_000).toISOString().slice(0, 7),
        projected: +mean.toFixed(2),
        lower: +(mean - 1.96 * residSd).toFixed(2),
        upper: +(mean + 1.96 * residSd).toFixed(2),
      };
    });

    res.json({
      data: {
        stats: {
          samples: records.length,
          distinctDays: n,
          trendReliable,
          meanPrice: +my.toFixed(2),
          trendPerMonth: +(slope * 30.4).toFixed(2),
          volatility: +residSd.toFixed(2),
        },
        projection,
      },
    });
  }),
);
