import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const titleCase = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

/** ESG (Environmental / Social / Governance) scores, latest per company. */
export const esgRouter = Router();

esgRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const scores = await prisma.esgScore.findMany({
      include: { company: true },
      orderBy: { overall: 'desc' },
    });
    const data = scores.map((s) => ({
      company: s.company.name,
      env: s.env,
      soc: s.soc,
      gov: s.gov,
      overall: s.overall,
      risk: titleCase(s.risk),
      date: s.assessedAt.toISOString().slice(0, 10),
    }));
    res.json({ data });
  }),
);
