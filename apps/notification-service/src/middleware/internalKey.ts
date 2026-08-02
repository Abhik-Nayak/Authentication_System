import crypto from 'node:crypto';
import type { RequestHandler } from 'express';
import { AppError } from '@secure-notes/shared';
import { config } from '../config';

const expected = Buffer.from(config.INTERNAL_API_KEY);

/**
 * Guards /internal/* — only other services may send mail. This is the whole authentication
 * story for this service: it has no users and no JWTs.
 *
 * The comparison is timing-safe. A plain `key === expected` returns as soon as it hits a
 * differing byte, so response time leaks how many leading characters were correct and the key
 * can be recovered one byte at a time. Over a fast internal network that is a real attack, not
 * a theoretical one.
 */
export const requireInternalKey: RequestHandler = (req, _res, next) => {
  const supplied = Buffer.from(req.get('x-internal-key') ?? '');

  // timingSafeEqual throws on length mismatch, which would itself leak the length — so check
  // length first and fall through to the same generic error.
  const ok = supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);

  if (!ok) {
    next(new AppError(401, 'Invalid or missing internal key', 'UNAUTHENTICATED'));
    return;
  }
  next();
};
