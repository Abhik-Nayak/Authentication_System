import { logger } from '@secure-notes/shared';
import { sendMail } from '../../mailer';
import type { SendEmailInput } from './email.schema';
import {
  accountLocked,
  otpCode,
  resetPassword,
  verifyEmail,
  type RenderedEmail,
} from './templates';

function render(input: SendEmailInput): RenderedEmail {
  // Exhaustive over the union: adding a template to email.schema.ts without a case here is a
  // compile error, not a 500 at run time.
  switch (input.template) {
    case 'verifyEmail':
      return verifyEmail(input.data);
    case 'resetPassword':
      return resetPassword(input.data);
    case 'otpCode':
      return otpCode(input.data);
    case 'accountLocked':
      return accountLocked(input.data);
  }
}

export async function sendTemplatedEmail(input: SendEmailInput): Promise<string> {
  const { subject, html } = render(input);
  const messageId = await sendMail(input.to, subject, html);

  // `to` is logged because operators need to answer "did the mail go out?". The body is not —
  // it contains OTP codes and one-time links.
  logger.info({ to: input.to, template: input.template, messageId }, 'email sent');
  return messageId;
}
