import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { signToken } from "../lib/jwt.js";
import { env } from "../config/env.js";
import { validateBody } from "../middleware/validate.js";
import { requireAuth } from "../middleware/auth.js";
import { HttpError } from "../middleware/error.js";
import { fromPlanEnum, toPlanEnum } from "../data/plans.js";

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(1).max(120).optional(),
  plan: z.enum(["free", "pro", "clinical"]).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function publicUser(u: { id: string; email: string; name: string | null; plan: string }) {
  return { id: u.id, email: u.email, name: u.name, plan: fromPlanEnum(u.plan) };
}

router.post("/register", validateBody(registerSchema), async (req, res, next) => {
  try {
    const { email, password, name, plan } = req.body as z.infer<typeof registerSchema>;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new HttpError(409, "Email already registered", "email_taken");
    const passwordHash = await bcrypt.hash(password, env.bcryptRounds);
    const user = await prisma.user.create({
      data: { email, passwordHash, name: name ?? null, plan: toPlanEnum(plan ?? "free") },
    });
    const token = signToken({ sub: user.id, email: user.email });
    res.status(201).json({ token, user: publicUser(user) });
  } catch (e) {
    next(e);
  }
});

router.post("/login", validateBody(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body as z.infer<typeof loginSchema>;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new HttpError(401, "Invalid credentials", "invalid_credentials");
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new HttpError(401, "Invalid credentials", "invalid_credentials");
    const token = signToken({ sub: user.id, email: user.email });
    res.json({ token, user: publicUser(user) });
  } catch (e) {
    next(e);
  }
});

router.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

export default router;
