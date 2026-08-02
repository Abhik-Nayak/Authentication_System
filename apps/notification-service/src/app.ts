import express from 'express';
import { AppError, errorHandler } from '@secure-notes/shared';
import { emailRouter } from './modules/email/email.routes';
import { healthRouter } from './modules/health/health.routes';

export const app = express();

// Emails are small; a low cap means a malformed or hostile caller cannot buffer megabytes.
app.use(express.json({ limit: '64kb' }));

app.use(healthRouter);
app.use('/internal', emailRouter);

// 404 as an AppError, so unknown paths get the same JSON envelope as everything else instead of
// Express's HTML default.
app.use((req, _res, next) => {
  next(new AppError(404, `Cannot ${req.method} ${req.path}`, 'NOT_FOUND'));
});

// Last. Express identifies error middleware by arity; mounting it before the routers means it
// never runs.
app.use(errorHandler);
