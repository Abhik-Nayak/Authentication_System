import { z } from 'zod';

/**
 * A discriminated union on `template`, so each template's `data` is validated against its own
 * shape rather than being accepted as a loose object and blowing up during rendering. It also
 * gives the service function exhaustive narrowing for free — add a template without handling it
 * and tsc fails.
 */
export const sendEmailSchema = z.discriminatedUnion('template', [
  z.object({
    to: z.email(),
    template: z.literal('verifyEmail'),
    data: z.object({ verifyUrl: z.url() }),
  }),
  z.object({
    to: z.email(),
    template: z.literal('resetPassword'),
    data: z.object({ resetUrl: z.url() }),
  }),
  z.object({
    to: z.email(),
    template: z.literal('otpCode'),
    data: z.object({ code: z.string().regex(/^\d{6}$/, 'must be 6 digits') }),
  }),
  z.object({
    to: z.email(),
    template: z.literal('accountLocked'),
    data: z.object({ minutes: z.number().int().positive() }),
  }),
]);

export type SendEmailInput = z.infer<typeof sendEmailSchema>;
