import { Router } from 'express';
import { asyncHandler } from '@secure-notes/shared';
import { verifyTransport } from '../../mailer';

export const healthRouter = Router();

/**
 * Asserts the dependency this service exists to use, not merely that the process is alive.
 * Phase 2's lesson: a healthcheck that cannot fail is decoration — an SMTP host that stopped
 * resolving should take this service out of the load balancer, and `{status:"ok"}` never would.
 *
 * Unauthenticated on purpose: Kubernetes probes cannot carry the internal key, and the response
 * discloses nothing.
 */
healthRouter.get(
  '/health',
  asyncHandler(async (_req, res) => {
    try {
      await verifyTransport();
      res.json({ status: 'ok', smtp: 'up' });
    } catch {
      res.status(503).json({ status: 'degraded', smtp: 'down' });
    }
  }),
);
