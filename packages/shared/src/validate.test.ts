import express from 'express';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { z } from 'zod';
import { AppError } from './errors';
import { validate } from './validate';

/** Drives a middleware with a stub request and returns what it did. */
function run(handler: RequestHandler, req: Partial<Request>) {
  const next = jest.fn() as unknown as NextFunction;
  handler(req as Request, {} as Response, next);
  return { req: req as Request, next: next as unknown as jest.Mock };
}

const bodySchema = z.object({
  email: z.email(),
  password: z.string().min(8),
});

describe('validate', () => {
  it('calls next() with no argument and populates req.valid on success', () => {
    const { req, next } = run(validate(bodySchema), {
      body: { email: 'a@b.com', password: 'longenough' },
    });

    expect(next).toHaveBeenCalledWith();
    expect(req.valid).toEqual({ email: 'a@b.com', password: 'longenough' });
  });

  it('leaves req[source] untouched, so the raw input stays available for audit', () => {
    const raw = { email: 'a@b.com', password: 'longenough', extra: 'stripped' };
    const { req } = run(validate(bodySchema), { body: raw });

    expect(req.body).toBe(raw);
    expect(req.valid).not.toHaveProperty('extra');
  });

  it('forwards a 422 AppError with code VALIDATION_FAILED', () => {
    const { next } = run(validate(bodySchema), { body: { email: 'nope', password: 'x' } });

    const err = next.mock.calls[0][0] as AppError;
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(422);
    expect(err.code).toBe('VALIDATION_FAILED');
  });

  it('reports one field-level error per failing field', () => {
    const { next } = run(validate(bodySchema), { body: { email: 'nope', password: 'x' } });

    const err = next.mock.calls[0][0] as AppError;
    expect(err.details?.map((d) => d.path).sort()).toEqual(['email', 'password']);
    expect(err.details?.every((d) => d.message.length > 0)).toBe(true);
  });

  it('joins nested paths with dots', () => {
    const schema = z.object({ profile: z.object({ age: z.number() }) });
    const { next } = run(validate(schema), { body: { profile: { age: 'old' } } });

    const err = next.mock.calls[0][0] as AppError;
    expect(err.details?.[0]?.path).toBe('profile.age');
  });

  it('names the source when the whole payload is missing, instead of an empty path', () => {
    const { next } = run(validate(bodySchema), { body: undefined });

    const err = next.mock.calls[0][0] as AppError;
    expect(err.details?.[0]?.path).toBe('body');
  });

  it('coerces query values, which arrive as strings', () => {
    const schema = z.object({ page: z.coerce.number() });
    const { req } = run(validate(schema, 'query'), { query: { page: '3' } });

    expect(req.valid).toEqual({ page: 3 });
  });
});

// The reason validate() writes to req.valid instead of req[source]. If Express ever makes
// req.query assignable, this test fails and the design can be revisited.
describe('Express 5 req.query (the trap validate avoids)', () => {
  let server: Server;

  afterAll(() => {
    server.close();
  });

  it('is getter-only: assigning throws TypeError in strict mode, which is what tsc emits', async () => {
    const app = express();
    app.get('/t', (req, res) => {
      try {
        // Type-checks fine — @types/express does not model the missing setter.
        req.query = { page: '999' };
        res.json({ threw: false });
      } catch (e) {
        res.json({ threw: true, message: (e as Error).message });
      }
    });

    server = app.listen(0);
    const { port } = server.address() as AddressInfo;
    const body = (await (await fetch(`http://127.0.0.1:${port}/t?page=1`)).json()) as {
      threw: boolean;
      message?: string;
    };

    expect(body.threw).toBe(true);
    expect(body.message).toMatch(/only a getter/);
  });
});
