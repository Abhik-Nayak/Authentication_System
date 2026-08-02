import nodemailer from 'nodemailer';
import { config } from './config';

// One transport for the process. Nodemailer pools connections internally; creating a transport
// per email would open a new SMTP connection every time.
//
// Swapping to SES in production is a change to THIS object and nothing else — either
// `nodemailer.createTransport({ SES: { ses, aws } })`, or keep SMTP and point SMTP_HOST at
// email-smtp.<region>.amazonaws.com with IAM SMTP credentials. There is deliberately no
// MailProvider interface: one implementation does not need an abstraction.
const transporter = nodemailer.createTransport({
  host: config.SMTP_HOST,
  port: config.SMTP_PORT,
  // MailHog speaks plaintext on 1025. Real SMTP on 587 upgrades via STARTTLS, which nodemailer
  // does automatically when secure=false; 465 needs secure=true.
  secure: config.SMTP_PORT === 465,
  auth: config.SMTP_USER ? { user: config.SMTP_USER, pass: config.SMTP_PASSWORD } : undefined,
});

export async function sendMail(to: string, subject: string, html: string): Promise<string> {
  const info = await transporter.sendMail({ from: config.MAIL_FROM, to, subject, html });
  return info.messageId;
}

/** Opens a connection and runs the SMTP handshake. Used by /health. */
export async function verifyTransport(): Promise<void> {
  await transporter.verify();
}
