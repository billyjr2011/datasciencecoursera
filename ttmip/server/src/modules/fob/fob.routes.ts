import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { validate } from '../../middleware/validate.js';
import { calculateFob, fobMatrix } from './fob.service.js';

/** Dynamic FOB Douala pricing derived from live international quotes. */
export const fobRouter = Router();

const calcQuery = z.object({
  species: z.string().min(1),
  destination: z.string().min(1),
  quality: z.enum(['High', 'Medium', 'Low']).optional(),
});

fobRouter.get(
  '/',
  validate({ query: calcQuery }),
  asyncHandler(async (req, res) => {
    const q = req.query as unknown as z.infer<typeof calcQuery>;
    res.json({ data: await calculateFob(q) });
  }),
);

fobRouter.get(
  '/matrix/:species',
  validate({
    params: z.object({ species: z.string().min(1) }),
    query: z.object({ quality: z.enum(['High', 'Medium', 'Low']).optional() }),
  }),
  asyncHandler(async (req, res) => {
    const quality = req.query.quality as 'High' | 'Medium' | 'Low' | undefined;
    res.json({ data: await fobMatrix(req.params.species, quality) });
  }),
);
