import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { fromPlanEnum, toPlanEnum } from "../data/plans.js";

const router = Router();

const planSchema = z.object({ plan: z.enum(["free", "pro", "clinical"]) });

// Simulated plan change. In production this would be gated behind a billing webhook
// (Stripe/Paddle) confirming a successful payment before mutating the plan.
router.patch("/me/plan", requireAuth, validateBody(planSchema), async (req, res, next) => {
  try {
    const { plan } = req.body as z.infer<typeof planSchema>;
    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: { plan: toPlanEnum(plan) },
    });
    res.json({ user: { id: user.id, email: user.email, name: user.name, plan: fromPlanEnum(user.plan) } });
  } catch (e) {
    next(e);
  }
});

export default router;
