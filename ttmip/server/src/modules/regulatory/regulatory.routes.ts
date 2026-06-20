import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { validate } from '../../middleware/validate.js';
import { HttpError } from '../../utils/httpError.js';

/** International regulatory frameworks (EUDR, EUTR, FLEGT VPA, Lacey, …). */
export const regulatoryRouter = Router();

const listQuery = z.object({
  region: z.string().optional(),
  q: z.string().optional(),
});

regulatoryRouter.get(
  '/',
  validate({ query: listQuery }),
  asyncHandler(async (req, res) => {
    const { region, q } = req.query as unknown as z.infer<typeof listQuery>;
    const regs = await prisma.regulation.findMany({
      where: {
        ...(region && region !== 'all' ? { region } : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { fullName: { contains: q, mode: 'insensitive' } },
                { description: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { code: 'asc' },
    });
    res.json({ data: regs });
  }),
);

regulatoryRouter.get(
  '/:code',
  validate({ params: z.object({ code: z.string().min(1) }) }),
  asyncHandler(async (req, res) => {
    const reg = await prisma.regulation.findUnique({
      where: { code: req.params.code.toUpperCase() },
    });
    if (!reg) throw HttpError.notFound(`Regulation ${req.params.code} not found`);
    res.json({ data: reg });
  }),
);
