import type { NextFunction, Request, Response } from 'express';
import { logger } from './logger';
import type { ErrorBody, FieldError } from './types';

/**
 * The only error type services throw. A class because it has to extend Error to keep a stack
 * trace — this is the one exception to the no-classes rule in PLAN.md section 0.
 */
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: FieldError[];

  constructor(statusCode: number, message: string, code = 'ERROR', details?: FieldError[]) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

/**
 * Mounted last, after every router. Four parameters are mandatory: Express identifies error
 * middleware by function arity, so dropping the unused `_next` silently turns this into an
 * ordinary handler that never sees an error.
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    logger.warn({ code: err.code, status: err.statusCode, path: req.path }, err.message);
    const body: ErrorBody = { error: { code: err.code, message: err.message } };
    if (err.details) body.error.details = err.details;
    res.status(err.statusCode).json(body);
    return;
  }

  // Anything else is a bug. Log it in full; tell the client nothing — a leaked stack trace or
  // Prisma message discloses schema and file paths.
  logger.error({ err, path: req.path }, 'unhandled error');
  const body: ErrorBody = { error: { code: 'INTERNAL', message: 'Internal server error' } };
  res.status(500).json(body);
}
