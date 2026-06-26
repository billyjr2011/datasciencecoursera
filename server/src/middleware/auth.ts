import type { NextFunction, Request, Response } from "express";
import { verifyToken } from "../lib/jwt.js";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "./error.js";
import { fromPlanEnum, PlanId } from "../data/plans.js";

export interface AuthedUser {
  id: string;
  email: string;
  name: string | null;
  plan: PlanId;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthedUser;
    }
  }
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) throw new HttpError(401, "Missing bearer token", "unauthorized");
    const payload = verifyToken(header.slice(7));
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) throw new HttpError(401, "User not found", "unauthorized");
    req.user = { id: user.id, email: user.email, name: user.name, plan: fromPlanEnum(user.plan) };
    next();
  } catch (e) {
    if (e instanceof HttpError) return next(e);
    next(new HttpError(401, "Invalid or expired token", "unauthorized"));
  }
}

/** Require a minimum plan tier. */
export function requirePlan(...allowed: PlanId[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new HttpError(401, "Unauthorized", "unauthorized"));
    if (!allowed.includes(req.user.plan))
      return next(new HttpError(403, `Requires plan: ${allowed.join(" or ")}`, "plan_required"));
    next();
  };
}
