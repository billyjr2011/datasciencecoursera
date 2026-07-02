import { Router } from 'express';
import { z } from 'zod';
import { DdraStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { validate } from '../../middleware/validate.js';

const statusLabel: Record<DdraStatus, string> = {
  COMPLIANT: 'Compliant',
  UNDER_REVIEW: 'Under Review',
  NON_COMPLIANT: 'Non-Compliant',
  CRITICAL: 'Critical',
};
const labelToStatus: Record<string, DdraStatus> = {
  Compliant: 'COMPLIANT',
  'Under Review': 'UNDER_REVIEW',
  'Non-Compliant': 'NON_COMPLIANT',
  Critical: 'CRITICAL',
};

/** EUDR Due-Diligence Risk Assessment records per shipment. */
export const ddraRouter = Router();

const query = z.object({
  status: z.string().optional(),
});

ddraRouter.get(
  '/',
  validate({ query }),
  asyncHandler(async (req, res) => {
    const { status } = req.query as unknown as z.infer<typeof query>;
    const mapped = status ? labelToStatus[status] : undefined;

    const records = await prisma.ddraRecord.findMany({
      where: mapped ? { status: mapped } : {},
      include: { company: true },
      orderBy: { assessedAt: 'desc' },
    });

    const data = records.map((r) => ({
      id: r.code,
      company: r.company.name,
      risk: r.riskScore,
      date: r.assessedAt.toISOString().slice(0, 10),
      status: statusLabel[r.status],
    }));
    res.json({ data });
  }),
);
