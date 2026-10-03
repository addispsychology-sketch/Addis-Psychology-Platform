function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
}

function safeLink(value: string): string {
  if (value === '{{ .ConfirmationURL }}') return value;
  const url = new URL(value);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('Unsupported email link.');
  return escapeHtml(url.href);
}

/**
 * Addis Psychology Platform — Editorial RawBlock Email Templates
 * Bulletproof HTML/CSS compatible with Gmail, Apple Mail, Outlook, iOS, and Android.
 */

interface BaseEmailOptions {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  bodyHtml: string;
  ctaText?: string;
  ctaUrl?: string;
  footerNote?: string;
}

export function renderRawBlockEmail({
  eyebrow = 'CONFIDENTIAL / ADDIS PSYCHOLOGY',
  title,
  subtitle,
  bodyHtml,
  ctaText,
  ctaUrl,
  footerNote,
}: BaseEmailOptions): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #f7f7f7;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #000000;
      -webkit-font-smoothing: antialiased;
    }
    table { border-collapse: collapse; }
    .container {
      max-width: 600px;
      margin: 40px auto;
      background-color: #ffffff;
      border: 3px solid #000000;
      box-shadow: 6px 6px 0px #000000;
    }
    .header-bar {
      padding: 24px 32px;
      border-bottom: 3px solid #000000;
      background-color: #ffffff;
    }
    .brand-mark {
      display: inline-block;
      width: 38px;
      height: 38px;
      background-color: #000000;
      color: #ffffff;
      font-family: 'Arial Black', Impact, sans-serif;
      font-size: 20px;
      line-height: 38px;
      text-align: center;
      vertical-align: middle;
      font-weight: 900;
      margin-right: 12px;
    }
    .brand-name {
      display: inline-block;
      vertical-align: middle;
      font-family: 'Arial Black', Impact, sans-serif;
      font-size: 15px;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      color: #000000;
    }
    .brand-sub {
      display: block;
      font-family: 'Courier New', Courier, monospace;
      font-size: 9px;
      letter-spacing: 1px;
      color: #777777;
      margin-top: 2px;
    }
    .content-area {
      padding: 36px 32px;
    }
    .eyebrow {
      font-family: 'Courier New', Courier, monospace;
      font-size: 11px;
      font-weight: bold;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      color: #666666;
      margin-bottom: 12px;
    }
    .title {
      font-family: 'Arial Black', Impact, sans-serif;
      font-size: 32px;
      line-height: 1.15;
      letter-spacing: -1px;
      text-transform: uppercase;
      color: #000000;
      margin: 0 0 16px 0;
    }
    .subtitle {
      font-size: 16px;
      line-height: 1.5;
      color: #333333;
      margin-bottom: 24px;
      padding-bottom: 20px;
      border-bottom: 2px solid #eeeeee;
    }
    .body-copy {
      font-size: 15px;
      line-height: 1.6;
      color: #222222;
      margin: 20px 0;
    }
    .card-box {
      border: 2px solid #000000;
      background-color: #fafafa;
      padding: 20px 24px;
      margin: 24px 0;
    }
    .btn-solid {
      display: inline-block;
      background-color: #000000;
      color: #ffffff !important;
      border: 3px solid #000000;
      padding: 14px 28px;
      font-family: 'Arial Black', Impact, sans-serif;
      font-size: 13px;
      letter-spacing: 1px;
      text-transform: uppercase;
      text-decoration: none;
      font-weight: bold;
      text-align: center;
      margin: 20px 0 10px;
    }
    .link-fallback {
      font-family: 'Courier New', Courier, monospace;
      font-size: 11px;
      word-break: break-all;
      color: #555555;
      background-color: #f2f2f2;
      padding: 12px;
      border: 1px solid #cccccc;
      margin-top: 14px;
    }
    .footer-bar {
      border-top: 3px solid #000000;
      padding: 24px 32px;
      background-color: #ffffff;
      font-family: 'Courier New', Courier, monospace;
      font-size: 11px;
      line-height: 1.6;
      color: #777777;
    }
    .footer-bar a {
      color: #000000;
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div style="padding: 20px 10px;">
    <table class="container" role="presentation" width="100%" align="center">
      <tr>
        <td class="header-bar">
          <table role="presentation" width="100%">
            <tr>
              <td>
                <span class="brand-mark">AP</span>
                <div class="brand-name">
                  ADDIS PSYCHOLOGY
                  <span class="brand-sub">SUPPORT. ON YOUR TERMS. · ADDIS ABABA</span>
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td class="content-area">
          <div class="eyebrow">${escapeHtml(eyebrow)}</div>
          <h1 class="title">${escapeHtml(title)}</h1>
          ${subtitle ? `<div class="subtitle">${escapeHtml(subtitle)}</div>` : ''}
          <div class="body-copy">
            ${bodyHtml}
          </div>
          ${ctaText && ctaUrl ? `
            <table role="presentation" width="100%" style="margin-top: 24px;">
              <tr>
                <td align="left">
                  <a href="${safeLink(ctaUrl)}" class="btn-solid" target="_blank">${escapeHtml(ctaText)} &rarr;</a>
                </td>
              </tr>
            </table>
            <div style="margin-top: 16px; font-size: 12px; color: #777777;">
              Or copy and paste this link in your browser:
              <div class="link-fallback">${safeLink(ctaUrl)}</div>
            </div>
          ` : ''}
        </td>
      </tr>
      <tr>
        <td class="footer-bar">
          <table role="presentation" width="100%">
            <tr>
              <td>
                <strong>ADDIS PSYCHOLOGY PLATFORM</strong><br>
                A confidential, dignified space for mental wellness in Addis Ababa.<br>
                ${footerNote ? `<div style="margin-top: 6px; color: #444444;">${escapeHtml(footerNote)}</div>` : ''}
                <div style="margin-top: 10px; font-size: 10px; color: #999999;">
                  For your privacy, personal therapy chat transcripts and clinical notes are never transmitted via email.
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>`;
}

/**
 * Renders the Confirmation Email template (used by Supabase Auth and website)
 */
export function renderEmailConfirmationTemplate(confirmUrl = '{{ .ConfirmationURL }}', name = ''): string {
  return renderRawBlockEmail({
    eyebrow: '01 / EMAIL CONFIRMATION',
    title: 'Welcome to Addis Psychology.',
    subtitle: name ? `Good to have you here, ${name}.` : 'Good to have you here.',
    bodyHtml: `
      <p style="margin: 0 0 16px;">
        Thank you for taking the first step. You've created an account to access confidential therapy sessions, appointments, and support in Addis Ababa.
      </p>
      <div class="card-box">
        <strong style="display: block; font-family: 'Arial Black', sans-serif; font-size: 14px; text-transform: uppercase; margin-bottom: 6px;">
          🔒 Private & Confidential
        </strong>
        <p style="margin: 0; font-size: 13px; color: #444444;">
          Your identity and appointment details remain protected. Please confirm your email to activate your account and verify your communication preferences.
        </p>
      </div>
      <p style="margin: 16px 0 0;">
        Click the button below to confirm your email and return to your personal space:
      </p>
    `,
    ctaText: 'Confirm My Email',
    ctaUrl: confirmUrl,
    footerNote: 'If you did not create an Addis Psychology account, you can safely ignore this email.',
  });
}

/**
 * Renders the Password Reset Email template
 */
export function renderPasswordResetTemplate(resetUrl = '{{ .ConfirmationURL }}'): string {
  return renderRawBlockEmail({
    eyebrow: 'SECURITY / RECOVERY',
    title: 'Reset Your Password.',
    subtitle: 'A request was received to reset your account password.',
    bodyHtml: `
      <p style="margin: 0 0 16px;">
        You can safely set a new password for your Addis Psychology account by clicking the button below. This link will expire shortly for your security.
      </p>
      <div class="card-box">
        <strong style="display: block; font-family: 'Arial Black', sans-serif; font-size: 14px; text-transform: uppercase; margin-bottom: 6px;">
          🛡️ Didn't request this?
        </strong>
        <p style="margin: 0; font-size: 13px; color: #444444;">
          If you didn't ask to reset your password, you can safely disregard this message. Your existing password remains unchanged and secure.
        </p>
      </div>
    `,
    ctaText: 'Reset Password',
    ctaUrl: resetUrl,
    footerNote: 'For security reasons, never forward this email to anyone else.',
  });
}

/**
 * Renders an Appointment Notification / Reminder email
 */
export function renderAppointmentEmail({
  recipientName,
  summary,
  appointmentPath,
  accountPath,
  isReminder = false,
}: {
  recipientName?: string;
  summary: string;
  appointmentPath: string;
  accountPath: string;
  isReminder?: boolean;
}): { subject: string; html: string; text: string } {
  const subject = isReminder
    ? '📅 Reminder: Your Upcoming Addis Psychology Appointment'
    : '📅 Addis Psychology: Appointment Update';

  const eyebrow = isReminder ? 'REMINDER / APPOINTMENT' : 'UPDATE / APPOINTMENT';
  const title = isReminder ? 'Your Session Is Approaching.' : 'Appointment Update.';
  const subtitle = recipientName ? `Hello ${recipientName},` : 'Hello,';

  const bodyHtml = `
    <div class="card-box">
      <strong style="display: block; font-family: 'Arial Black', sans-serif; font-size: 14px; text-transform: uppercase; margin-bottom: 8px;">
        ${isReminder ? '⏰ Upcoming Session Details' : '📋 Session Status'}
      </strong>
      <p style="margin: 0; font-size: 14px; font-weight: 500; line-height: 1.6; white-space: pre-line;">
        ${escapeHtml(summary)}
      </p>
    </div>
    <p style="font-size: 14px; line-height: 1.6; color: #333333;">
      Please take a moment to review your appointment details, join instructions, or reschedule if needed.
    </p>
  `;

  const html = renderRawBlockEmail({
    eyebrow,
    title,
    subtitle,
    bodyHtml,
    ctaText: 'View Appointment',
    ctaUrl: appointmentPath,
    footerNote: `Manage your notification settings in My Account: ${accountPath}`,
  });

  const text = `Addis Psychology\n\n${summary}\n\nOpen your appointment: ${appointmentPath}\n\nManage notifications: ${accountPath}\n\nFor your privacy, message contents are never included in email notifications.`;

  return { subject, html, text };
}

/**
 * Renders a General Announcement email
 */
export function renderAnnouncementEmail({
  title,
  message,
  actionText,
  actionUrl,
}: {
  title: string;
  message: string;
  actionText?: string;
  actionUrl?: string;
}): { subject: string; html: string; text: string } {
  const subject = `Addis Psychology: ${escapeHtml(title)}`;

  const bodyHtml = `
    <div style="font-size: 15px; line-height: 1.7; color: #222222; margin: 16px 0;">
      ${escapeHtml(message).replace(/\n/g, '<br>')}
    </div>
  `;

  const html = renderRawBlockEmail({
    eyebrow: 'ANNOUNCEMENT / ADDIS PSYCHOLOGY',
    title,
    bodyHtml,
    ctaText: actionText,
    ctaUrl: actionUrl,
  });

  const text = `Addis Psychology\n\n${escapeHtml(title)}\n\n${message}\n\n${actionUrl ? `Visit: ${actionUrl}\n\n` : ''}`;

  return { subject, html, text };
}
