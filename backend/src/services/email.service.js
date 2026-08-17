import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

// ─── Transporter Configuration ─────────────────────────────────────────────
// Production: Use SendGrid/Mailgun/Amazon SES SMTP credentials
// Development: Use Mailpit, Mailtrap, or Ethereal for testing
const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: Number(env.SMTP_PORT),
  secure: false,
  family: 4,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
  pool: true,
  maxConnections: 5,
});
// Verify connection on startup (fail fast in development)
transporter.verify((error) => {
  if (error) {
    console.error('❌ SMTP connection failed:', error.message);
  } else {
    console.log('✅ SMTP server ready');
  }
});

// ─── Email Templates ───────────────────────────────────────────────────────

const BASE_STYLES = `
  <style>
    body { margin: 0; padding: 0; background: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .container { max-width: 480px; margin: 0 auto; padding: 40px 24px; }
    .card { background: #ffffff; border-radius: 16px; padding: 40px 32px; box-shadow: 0 4px 24px rgba(0,0,0,0.1); }
    .logo { text-align: center; margin-bottom: 28px; }
    .logo-text { font-size: 22px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px; }
    .logo-text span { color: #059669; }
    h1 { font-size: 20px; font-weight: 700; color: #0f172a; margin: 0 0 12px; }
    p { font-size: 15px; line-height: 1.6; color: #475569; margin: 0 0 20px; }
    .button { display: inline-block; background: linear-gradient(135deg, #10b981, #059669); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-weight: 600; font-size: 15px; box-shadow: 0 4px 12px rgba(16,185,129,0.3); }
    .button:hover { background: linear-gradient(135deg, #059669, #047857); }
    .divider { height: 1px; background: #e2e8f0; margin: 28px 0; }
    .footer { text-align: center; font-size: 13px; color: #94a3b8; line-height: 1.5; }
    .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 6px; font-size: 13px; color: #92400e; margin: 20px 0; }
    .code { font-family: 'SF Mono', Monaco, monospace; background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-size: 13px; color: #0f172a; }
  </style>
`;

function buildEmail({ subject, preheader, body }) {
  return {
    subject,
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
        ${BASE_STYLES}
      </head>
      <body>
        <div class="container">
          <div class="card">
            <div class="logo">
              <div class="logo-text">Gully<span>Bid</span></div>
            </div>
            ${body}
            <div class="divider"></div>
            <div class="footer">
              <p style="margin:0 0 8px;">GullyBid — India's fastest-growing cricket auction platform</p>
              <p style="margin:0; font-size: 12px; color: #cbd5e1;">This is an automated message. Please do not reply to this email.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `,
    text: preheader, // Fallback plain text
  };
}

// ─── Exported Email Senders ────────────────────────────────────────────────

export class EmailService {
  /**
   * Send password reset email with secure reset link.
   */
  static async sendPasswordReset({ to, name, resetUrl }) {
    const { subject, html, text } = buildEmail({
      subject: 'Reset your GullyBid password',
      preheader: `Hi ${name}, we received a request to reset your password. Click the link below to choose a new one. This link expires in 15 minutes.`,
      body: `
        <h1>Password reset requested</h1>
        <p>Hi ${name},</p>
        <p>We received a request to reset the password for your GullyBid account. Click the button below to set a new password:</p>
        <p style="text-align: center; margin: 28px 0;">
          <a href="${resetUrl}" class="button">Reset my password</a>
        </p>
        <p>Or copy and paste this link into your browser:</p>
        <p style="word-break: break-all;"><span class="code">${resetUrl}</span></p>
        <div class="warning">
          <strong>⏱️ This link expires in 15 minutes</strong><br>
          For security, this link can only be used once. If you didn't request this reset, you can safely ignore this email — your password will not be changed.
        </div>
      `,
    });

    await transporter.sendMail({
      from: `"GullyBid Security" <${env.FROM_EMAIL}>`,
      to,
      subject,
      html,
      text,
      headers: {
        'X-Priority': '1',
        'X-Mailer': 'GullyBid-Mail-Service/1.0',
      },
    });
  }

  /**
   * Notify user that their password was changed.
   */
  static async sendPasswordChanged({ to, name }) {
    const { subject, html, text } = buildEmail({
      subject: 'Your GullyBid password was changed',
      preheader: `Hi ${name}, your password was successfully changed. If you didn't do this, contact us immediately.`,
      body: `
        <h1>Password changed successfully</h1>
        <p>Hi ${name},</p>
        <p>Your GullyBid account password was just changed. If you made this change, you're all set — no further action needed.</p>
        <div class="warning" style="background: #fee2e2; border-left-color: #ef4444; color: #991b1b;">
          <strong>🚨 Didn't do this?</strong><br>
          If you didn't change your password, your account may have been compromised. Please reset your password immediately and contact our support team.
        </div>
      `,
    });

    await transporter.sendMail({
      from: `"GullyBid Security" <${env.FROM_EMAIL}>`,
      to,
      subject,
      html,
      text,
    });
  }
}