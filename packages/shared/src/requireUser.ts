import type { RequestHandler } from 'express';
import { AppError } from './errors';
import type { Role } from './types';

const ROLES: readonly string[] = ['USER', 'ADMIN'];

function isRole(value: string): value is Role {
  return ROLES.includes(value);
}

/**
 * Reads the identity the gateway injected and attaches it as req.user. No JWT library here —
 * downstream services never see a token.
 *
 * These headers are trustworthy ONLY because the gateway strips any client-supplied `x-user-*`
 * before setting its own, and because this service is unreachable from outside the internal
 * network. If either stops being true, two headers grant admin. See SD-1 in
 * docs/security-decisions.md.
 */
export const requireUser: RequestHandler = (req, _res, next) => {
  const id = req.get('x-user-id');
  const role = req.get('x-user-role');

  if (!id || !role || !isRole(role)) {
    next(new AppError(401, 'Authentication required', 'UNAUTHENTICATED'));
    return;
  }

  req.user = { id, role };
  next();
};

/** Mount after requireUser: `router.get('/admin/users', requireUser, requireRole('ADMIN'), ...)`. */
export function requireRole(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) {
      // requireRole without requireUser in front of it is a wiring bug, not a client error.
      next(new AppError(401, 'Authentication required', 'UNAUTHENTICATED'));
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(new AppError(403, 'Insufficient permissions', 'FORBIDDEN'));
      return;
    }
    next();
  };
}
