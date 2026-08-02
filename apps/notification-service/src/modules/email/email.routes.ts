import { Router } from 'express';
import { asyncHandler, validate } from '@secure-notes/shared';
import { requireInternalKey } from '../../middleware/internalKey';
import { sendEmailHandler } from './email.controller';
import { sendEmailSchema } from './email.schema';

export const emailRouter = Router();

// Wiring reads left to right: authenticate, validate, handle.
emailRouter.post(
  '/email',
  requireInternalKey,
  validate(sendEmailSchema),
  asyncHandler(sendEmailHandler),
);
