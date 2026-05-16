import nodemailer from 'nodemailer';

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

let cachedTransporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (cachedTransporter) return cachedTransporter;
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  cachedTransporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return cachedTransporter;
}

export async function sendEmail(opts: SendEmailOptions): Promise<{ sent: boolean; reason?: string }> {
  const transporter = getTransporter();
  const from = process.env.EMAIL_FROM || 'no-reply@urbandrape.in';

  if (!transporter) {
    console.warn(`[email] SMTP not configured — would have sent "${opts.subject}" to ${opts.to}`);
    return { sent: false, reason: 'smtp_not_configured' };
  }

  try {
    await transporter.sendMail({
      from,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    });
    return { sent: true };
  } catch (err: any) {
    console.error('[email] send failed:', err?.message);
    return { sent: false, reason: err?.message || 'send_failed' };
  }
}
