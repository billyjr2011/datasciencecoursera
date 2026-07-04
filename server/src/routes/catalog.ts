// Static catalogue endpoints: plans, intake questions, specialist directory.

import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { PLANS } from "../data/plans.js";
import { QUESTIONS, SECTIONS } from "../data/questions.js";
import { requireAuth, requirePlan } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { knnMatchSpecialists } from "../services/knn.js";

const router = Router();

router.get("/plans", (_req, res) => {
  res.json({ plans: PLANS });
});

router.get("/questions", (_req, res) => {
  res.json({ questions: QUESTIONS, sections: SECTIONS });
});

router.get("/specialists", async (req, res, next) => {
  try {
    const { city, specialty } = req.query as { city?: string; specialty?: string };
    const specialists = await prisma.specialist.findMany({
      where: {
        ...(city ? { city: { equals: city, mode: "insensitive" } } : {}),
        ...(specialty ? { specialty: { contains: specialty, mode: "insensitive" } } : {}),
      },
      orderBy: { name: "asc" },
    });
    res.json({ specialists });
  } catch (e) {
    next(e);
  }
});

const matchSchema = z.object({
  specialty: z.string().default(""),
  zone: z.string().default(""),
  chiefComplaints: z.array(z.string()).default([]),
  k: z.number().int().min(1).max(20).default(6),
});

router.post("/specialists/match", requireAuth, requirePlan("pro", "clinical"), validateBody(matchSchema), async (req, res, next) => {
  try {
    const { specialty, zone, chiefComplaints, k } = req.body as z.infer<typeof matchSchema>;
    const specialists = await prisma.specialist.findMany();
    const matches = knnMatchSpecialists(specialists, specialty, zone, chiefComplaints, k);
    res.json({ matches });
  } catch (e) {
    next(e);
  }
});

export default router;
