import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';
import { AppError } from './errors';
import type { FieldError } from './types';

export type ValidationSource = 'body' | 'query' | 'params';

/**
 * Validates one part of the request against a zod schema. 422 with field-level errors on
 * failure, see docs/api-contracts.md.
 *
 * The parsed result is attached to `req.valid` and NEVER written back to `req[source]`. In
 * Express 5 `req.query` is a getter with no setter, and `@types/express` does not model that —
 * the assignment type-checks, then at run time throws
 * `TypeError: Cannot set property query ... which has only a getter`, because TypeScript's
 * `strict` implies `alwaysStrict`. (In sloppy-mode JavaScript it silently no-ops instead, which
 * is how this usually ships unnoticed.) Either way it is a bug, and it would fire on every list
 * endpoint. Using one destination for all three sources means no per-source exception to learn,
 * and `req.body` keeps the raw input for audit logging.
 */
export function validate(schema: ZodType, source: ValidationSource = 'body'): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      const details: FieldError[] = result.error.issues.map((issue) => ({
        // Top-level failures (the whole body is missing) have an empty path; name the source
        // instead of emitting "".
        path: issue.path.length > 0 ? issue.path.join('.') : source,
        message: issue.message,
      }));
      next(new AppError(422, 'Request validation failed', 'VALIDATION_FAILED', details));
      return;
    }

    req.valid = result.data;
    next();
  };
}
