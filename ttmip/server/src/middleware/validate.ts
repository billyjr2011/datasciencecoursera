import type { NextFunction, Request, Response } from 'express';
import type { ZodTypeAny, z } from 'zod';

interface Schemas {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

/**
 * Validates and coerces request `body`, `query`, and `params` against zod
 * schemas. Parsed values replace the raw input so downstream handlers receive
 * typed, sanitized data. Validation failures bubble to the error handler.
 */
export const validate =
  (schemas: Schemas) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    if (schemas.params) req.params = schemas.params.parse(req.params);
    if (schemas.query) Object.assign(req.query, schemas.query.parse(req.query));
    if (schemas.body) req.body = schemas.body.parse(req.body);
    next();
  };

export type Infer<T extends ZodTypeAny> = z.infer<T>;
