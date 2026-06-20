import type { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from '../utils/jwt.js';
import { HttpError } from '../utils/httpError.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: { id: string; email: string };
    }
  }
}

/**
 * Requires a valid `Authorization: Bearer <token>` header and attaches the
 * authenticated user to `req.user`.
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw HttpError.unauthorized('Missing bearer token');
  }
  const token = header.slice('Bearer '.length).trim();
  const payload = verifyAccessToken(token);
  req.user = { id: payload.sub, email: payload.email };
  next();
}
