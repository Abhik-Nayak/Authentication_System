export interface RenderedEmail {
  subject: string;
  html: string;
}

/**
 * Every interpolated value goes through this. The data arrives over HTTP from another service,
 * and some of it originates with a user — an unescaped value is HTML injection into an email,
 * which mail clients will happily render.
 */
function esc(value: string | number): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Inline styles only, and a table-free layout. Mail clients strip <style> blocks and have no
// support for modern CSS; this is the boring subset that renders the same in Gmail and Outlook.
function layout(heading: string, body: string): string {
  return `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#111">
  <h1 style="font-size:20px;margin:0 0 16px">${esc(heading)}</h1>
  ${body}
  <p style="font-size:12px;color:#666;margin-top:32px">Secure Notes — this is an automated message, please do not reply.</p>
</div>`;
}

function button(url: string, label: string): string {
  return `<p><a href="${esc(url)}" style="display:inline-block;background:#111;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">${esc(label)}</a></p>
  <p style="font-size:12px;color:#666">If the button does not work, paste this into your browser:<br>${esc(url)}</p>`;
}

export function verifyEmail(data: { verifyUrl: string }): RenderedEmail {
  return {
    subject: 'Verify your email address',
    html: layout(
      'Confirm your email',
      `<p>Welcome. Confirm this address to finish setting up your account.</p>
      ${button(data.verifyUrl, 'Verify email')}
      <p style="font-size:12px;color:#666">This link expires in 24 hours.</p>`,
    ),
  };
}

export function resetPassword(data: { resetUrl: string }): RenderedEmail {
  return {
    subject: 'Reset your password',
    html: layout(
      'Reset your password',
      `<p>We received a request to reset your password. If it was not you, ignore this email — nothing has changed.</p>
      ${button(data.resetUrl, 'Reset password')}
      <p style="font-size:12px;color:#666">This link expires in 1 hour and can be used once.</p>`,
    ),
  };
}

export function otpCode(data: { code: string }): RenderedEmail {
  return {
    subject: `${data.code} is your verification code`,
    html: layout(
      'Your verification code',
      `<p style="font-size:32px;letter-spacing:6px;font-weight:600;margin:16px 0">${esc(data.code)}</p>
      <p style="font-size:12px;color:#666">Expires in 5 minutes. Never share this code — we will never ask you for it.</p>`,
    ),
  };
}

export function accountLocked(data: { minutes: number }): RenderedEmail {
  return {
    subject: 'Your account has been temporarily locked',
    html: layout(
      'Account temporarily locked',
      `<p>Too many failed sign-in attempts, so we locked the account for ${esc(data.minutes)} minutes.</p>
      <p>If this was not you, reset your password once the lock expires.</p>`,
    ),
  };
}
