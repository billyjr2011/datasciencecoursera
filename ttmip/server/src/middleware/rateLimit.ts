import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';
import { HttpError } from '../utils/httpError.js';

/**
 * In-memory fixed-window rate limiter keyed by client IP.
 *
 * This is intentionally swappable: the same interface (`hit(key) -> allowed`)
 * can be backed by Redis (INCR + EXPIRE) for multi-node deployments. At MVP
 * scale a single in-process counter is sufficient.
 */
interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

function hit(key: string): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + env.RATE_LIMIT_WINDOW_MS;
    buckets.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: env.RATE_LIMIT_MAX - 1, resetAt };
  }

  existing.count += 1;
  const allowed = existing.count <= env.RATE_LIMIT_MAX;
  return { allowed, remaining: Math.max(0, env.RATE_LIMIT_MAX - existing.count), resetAt: existing.resetAt };
}

// Periodically evict expired buckets to bound memory.
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}, env.RATE_LIMIT_WINDOW_MS).unref();

export function rateLimit(req: Request, res: Response, next: NextFunction): void {
  const key = req.ip ?? 'unknown';
  const { allowed, remaining, resetAt } = hit(key);

  res.setHeader('X-RateLimit-Limit', env.RATE_LIMIT_MAX);
  res.setHeader('X-RateLimit-Remaining', remaining);
  res.setHeader('X-RateLimit-Reset', Math.ceil(resetAt / 1000));

  if (!allowed) {
    throw HttpError.tooManyRequests();
  }
  next();
}
