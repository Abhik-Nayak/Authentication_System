import type { Request, Response } from 'express';
import type { SendEmailInput } from './email.schema';
import { sendTemplatedEmail } from './email.service';

/** req/res only, no logic. The cast is the one place the validate() contract is asserted. */
export async function sendEmailHandler(req: Request, res: Response): Promise<void> {
  const input = req.valid as SendEmailInput;
  const messageId = await sendTemplatedEmail(input);

  // 202, not 200: SMTP has accepted the message for delivery. Whether it reaches the inbox is
  // out of our hands, so claiming "sent" would be a lie.
  res.status(202).json({ queued: true, messageId });
}
