import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Forwards a rejected promise to the error middleware instead of leaving it unhandled.
 *
 * Express 5 already does this for handlers it invokes directly, so this is belt-and-braces
 * rather than strictly required. It stays because it is explicit at the call site, and because
 * Express 5 does NOT cover a rejection thrown inside a nested callback.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
