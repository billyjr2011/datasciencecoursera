import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { HttpError } from "../middleware/error.js";
import { runTriage, TriageError } from "../services/triage.js";
import { toPlanEnum } from "../data/plans.js";
import { logger } from "../lib/logger.js";

const router = Router();

// Bound inference cost: per-user limit on the expensive triage endpoint.
const triageLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  keyGenerator: (req) => req.user?.id ?? req.ip ?? "anon",
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => res.status(429).json({ error: { message: "Too many consultations, slow down", code: "rate_limited" } }),
});

const createSchema = z.object({
  plan: z.enum(["free", "pro", "clinical"]),
  answers: z.record(z.unknown()),
});

router.post("/", requireAuth, triageLimiter, validateBody(createSchema), async (req, res, next) => {
  const user = req.user!;
  try {
    const { plan, answers } = req.body as z.infer<typeof createSchema>;
    const specialists = await prisma.specialist.findMany();
    const triage = await runTriage(answers, plan, specialists);

    const consultation = await prisma.consultation.create({
      data: {
        userId: user.id,
        plan: toPlanEnum(plan),
        answers: answers as object,
        result: triage.result as object,
        triageColor: triage.triageColor,
        referralSpecialty: triage.referralSpecialty,
        model: triage.model,
        patientZone: triage.patientZone || null,
        specialists: {
          create: triage.specialists.map((m) => ({
            specialistId: m.specialist.id,
            rank: m.rank,
            score: m.score,
            distanceKm: m.distanceKm,
          })),
        },
      },
    });

    logger.info("consultation.created", { userId: user.id, id: consultation.id, triageColor: triage.triageColor, plan });

    res.status(201).json({
      consultation: {
        id: consultation.id,
        result: triage.result,
        specialists: triage.specialists,
        model: triage.model,
        triageColor: triage.triageColor,
        createdAt: consultation.createdAt,
      },
    });
  } catch (e) {
    if (e instanceof TriageError) {
      logger.warn("triage.failed", { userId: user.id, code: e.code });
      return next(new HttpError(502, e.message, e.code));
    }
    next(e);
  }
});

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page ?? 1));
    const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize ?? 10)));
    const where = { userId: req.user!.id };
    const [total, consultations] = await Promise.all([
      prisma.consultation.count({ where }),
      prisma.consultation.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: { id: true, triageColor: true, referralSpecialty: true, plan: true, createdAt: true },
      }),
    ]);
    res.json({ consultations, page, pageSize, total });
  } catch (e) {
    next(e);
  }
});

router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const consultation = await prisma.consultation.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
      include: { specialists: { include: { specialist: true }, orderBy: { rank: "asc" } } },
    });
    if (!consultation) throw new HttpError(404, "Consultation not found", "not_found");
    res.json({ consultation });
  } catch (e) {
    next(e);
  }
});

export default router;
