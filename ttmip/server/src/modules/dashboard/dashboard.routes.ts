import { Router } from 'express';
import { AlertSeverity } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

/**
 * Cross-domain aggregation for the landing dashboard. One round-trip returns
 * every KPI and headline figure the front page needs.
 */
export const dashboardRouter = Router();

dashboardRouter.get(
  '/summary',
  asyncHandler(async (_req, res) => {
    const [
      avgPrice,
      alertsTotal,
      alertsHigh,
      alertsMedium,
      alertsLow,
      marketCount,
      regulationCount,
      gspi,
      espi,
      topMarkets,
    ] = await Promise.all([
      prisma.priceRecord.aggregate({ _avg: { price: true } }),
      prisma.deforestationAlert.count(),
      prisma.deforestationAlert.count({ where: { severity: AlertSeverity.HIGH } }),
      prisma.deforestationAlert.count({ where: { severity: AlertSeverity.MEDIUM } }),
      prisma.deforestationAlert.count({ where: { severity: AlertSeverity.LOW } }),
      prisma.market.count(),
      prisma.regulation.count(),
      prisma.priceIndex.findUnique({
        where: { code: 'GSPI' },
        include: { points: { orderBy: { date: 'desc' }, take: 1 } },
      }),
      prisma.priceIndex.findUnique({
        where: { code: 'ESPI' },
        include: { points: { orderBy: { date: 'desc' }, take: 1 } },
      }),
      prisma.market.findMany({ orderBy: { volume: 'desc' }, take: 5 }),
    ]);

    res.json({
      data: {
        avgTimberPrice: Math.round(avgPrice._avg.price ?? 0),
        alerts: { total: alertsTotal, high: alertsHigh, medium: alertsMedium, low: alertsLow },
        activeMarkets: marketCount,
        regulationCount,
        indices: {
          gspi: gspi?.points[0]?.value ?? null,
          espi: espi?.points[0]?.value ?? null,
        },
        topMarkets: topMarkets.map((m) => ({
          code: m.code,
          name: m.name,
          volume: m.volume,
          price: m.price,
          share: m.share,
          color: m.color,
        })),
      },
    });
  }),
);
