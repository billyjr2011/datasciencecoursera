import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { HttpError } from '../../utils/httpError.js';

/**
 * Subscription accounts for producers, traders, buyers, analysts, regulators.
 * Billing capture (Stripe/mobile money) plugs in at the `subscribe` step; the
 * MVP activates a 14-day trial immediately.
 */
export const subscriptionsRouter = Router();

subscriptionsRouter.get(
  '/plans',
  asyncHandler(async (_req, res) => {
    const plans = await prisma.subscriptionPlan.findMany({ orderBy: { priceUsd: 'asc' } });
    res.json({ data: plans });
  }),
);

subscriptionsRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const sub = await prisma.subscription.findFirst({
      where: { userId: req.user!.id, status: { in: ['ACTIVE', 'TRIALING'] } },
      include: { plan: true },
      orderBy: { startedAt: 'desc' },
    });
    res.json({ data: sub });
  }),
);

subscriptionsRouter.post(
  '/subscribe',
  requireAuth,
  validate({ body: z.object({ planCode: z.string().min(1) }) }),
  asyncHandler(async (req, res) => {
    const plan = await prisma.subscriptionPlan.findUnique({ where: { code: req.body.planCode } });
    if (!plan) throw HttpError.notFound(`Unknown plan ${req.body.planCode}`);

    // One live subscription per user: cancel any current one, then start anew.
    await prisma.subscription.updateMany({
      where: { userId: req.user!.id, status: { in: ['ACTIVE', 'TRIALING'] } },
      data: { status: 'CANCELED' },
    });
    const sub = await prisma.subscription.create({
      data: {
        userId: req.user!.id,
        planId: plan.id,
        status: plan.priceUsd === 0 ? 'ACTIVE' : 'TRIALING',
        renewsAt: new Date(Date.now() + 14 * 86_400_000),
      },
      include: { plan: true },
    });
    res.status(201).json({ data: sub });
  }),
);
