import { Router } from 'express';
import { z } from 'zod';
import { AlertSeverity, type Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { validate } from '../../middleware/validate.js';

const titleCase = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

/** Deforestation alerts from GFW / WRI / NASA / EU JRC. */
export const alertsRouter = Router();

const query = z.object({
  severity: z.nativeEnum(AlertSeverity).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(30),
});

alertsRouter.get(
  '/',
  validate({ query }),
  asyncHandler(async (req, res) => {
    const { severity, limit } = req.query as unknown as z.infer<typeof query>;
    const where: Prisma.DeforestationAlertWhereInput = severity ? { severity } : {};

    const alerts = await prisma.deforestationAlert.findMany({
      where,
      orderBy: { alertDate: 'desc' },
      take: limit,
    });

    const data = alerts.map((a) => ({
      id: a.code,
      lat: a.lat,
      lng: a.lng,
      confidence: a.confidence,
      date: a.alertDate.toISOString().slice(0, 10),
      area: a.areaHa,
      source: a.source,
      zone: a.zone,
      severity: titleCase(a.severity),
    }));
    res.json({ data });
  }),
);
