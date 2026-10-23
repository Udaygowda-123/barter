import { env } from './config';

/** Where links in emails point. Never derived from request headers (prevents reset-link poisoning). */
export function appUrl() {
  const u = process.env.APP_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '');
  return (u || 'http://localhost:3000').replace(/\/$/, '');
}

export interface Mail { to: string; subject: string; text: string; html: string }

const layout = (title: string, body: string, cta: { label: string; url: string }) => `<!doctype html><html><body style="margin:0;background:#FAF8F5;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#17151E">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;background:#fff;border:1px solid #E7E3DC;border-radius:24px">
<tr><td style="padding:32px"><div style="font-weight:900;font-size:22px;letter-spacing:-.5px">swapd</div>
<h1 style="font-size:24px;line-height:1.2;margin:24px 0 8px">${title}</h1><p style="font-size:15px;line-height:1.6;color:#66627A;margin:0 0 24px">${body}</p>
<a href="${cta.url}" style="display:inline-block;background:#FF765E;color:#17151E;text-decoration:none;font-weight:700;padding:14px 28px;border-radius:999px">${cta.label}</a>
<p style="font-size:12px;line-height:1.6;color:#66627A;margin:24px 0 0">If the button doesn't work, paste this link into your browser:<br><span style="word-break:break-all">${cta.url}</span></p>
<p style="font-size:12px;color:#66627A;margin:16px 0 0">Didn't request this? You can safely ignore this email.</p></td></tr></table></td></tr></table></body></html>`;

/** Sends after the HTTP response is finished (Next `after`), so slow SMTP never delays or fingerprints a request. */
export async function queueMail(m: Mail) {
  try { const { after } = await import('next/server'); after(() => sendMail(m)); } catch { await sendMail(m); }
}

export const resetEmail = (to: string, url: string): Mail => ({
  to, subject: 'Reset your SWAPD password',
  text: `Reset your SWAPD password: ${url}\n\nThis link expires in 1 hour. If you didn't request it, ignore this email.`,
  html: layout('Reset your password', 'Tap the button to choose a new password. This link expires in 1 hour and can be used once.', { label: 'Choose a new password', url }),
});
export const verifyEmail = (to: string, url: string): Mail => ({
  to, subject: 'Verify your email for SWAPD',
  text: `Welcome to SWAPD! Verify your email: ${url}\n\nThis link expires in 24 hours.`,
  html: layout('Verify your email', 'Welcome to SWAPD! Confirm this is your email address so people can trust your profile. This link expires in 24 hours.', { label: 'Verify my email', url }),
});

/**
 * Providers, first match wins: RESEND_API_KEY → SMTP_* (e.g. Gmail app password) → console (development only).
 * Returns true when handed to a real provider. Never throws: auth flows must not leak whether an address exists.
 */
export async function sendMail(m: Mail): Promise<boolean> {
  const from = process.env.MAIL_FROM || process.env.SMTP_FROM || process.env.SMTP_USER || 'SWAPD <onboarding@resend.dev>';
  try {
    if (process.env.RESEND_API_KEY) {
      const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from, to: [m.to], subject: m.subject, html: m.html, text: m.text }), signal: AbortSignal.timeout(8000) });
      if (!r.ok) throw new Error(`Resend ${r.status}: ${(await r.text()).slice(0, 200)}`);
      return true;
    }
    if (process.env.SMTP_HOST || process.env.SMTP_USER) {
      const nodemailer = await import('nodemailer');
      const port = Number(process.env.SMTP_PORT ?? 465);
      const t = nodemailer.createTransport({ host: process.env.SMTP_HOST ?? 'smtp.gmail.com', port, secure: port === 465, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }, connectionTimeout: 8000, greetingTimeout: 8000, socketTimeout: 10000 });
      await t.sendMail({ from, to: m.to, subject: m.subject, text: m.text, html: m.html });
      return true;
    }
  } catch (e) { console.error('[mail] send failed:', (e as Error).message); return false; }
  if (!env.isProd) console.warn(`\n[mail:dev] no mail provider configured — to: ${m.to}\n[mail:dev] ${m.subject}\n[mail:dev] ${m.text.split('\n')[0]}\n`);
  else console.error('[mail] no provider configured (set SMTP_* or RESEND_API_KEY) — email NOT sent to', m.to);
  return false;
}
