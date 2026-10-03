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
 * Addis Psychology Platform — Beautiful Email Templates
 * Bulletproof HTML/CSS compatible with Gmail, Apple Mail, Outlook, iOS, and Android.
 * Design: editorial monochrome with warm accents, inspired by the platform's RawBlock aesthetic.
 */

interface BaseEmailOptions {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  bodyHtml: string;
  ctaText?: string;
  ctaUrl?: string;
  footerNote?: string;
  accentColor?: string;
}

export function renderRawBlockEmail({
  eyebrow = 'CONFIDENTIAL / ADDIS PSYCHOLOGY',
  title,
  subtitle,
  bodyHtml,
  ctaText,
  ctaUrl,
  footerNote,
  accentColor = '#000000',
}: BaseEmailOptions): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Work+Sans:wght@400;600;700&display=swap');
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 0;
      background-color: #f0ede8;
      font-family: 'Work Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #111111;
      -webkit-font-smoothing: antialiased;
    }
    table { border-collapse: collapse; }
    img { border: 0; }
    .wrapper {
      max-width: 640px;
      margin: 0 auto;
      padding: 32px 16px;
    }
    .container {
      background-color: #ffffff;
      border: 4px solid #000000;
      box-shadow: 8px 8px 0px #000000;
      overflow: hidden;
    }
    .header-bar {
      padding: 28px 40px;
      border-bottom: 4px solid #000000;
      background-color: #ffffff;
    }
    .brand-wrap {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .brand-mark {
      display: inline-block;
      width: 48px;
      height: 48px;
      background-color: #000000;
      color: #ffffff;
      font-family: 'Arial Black', Impact, sans-serif;
      font-size: 22px;
      line-height: 48px;
      text-align: center;
      font-weight: 900;
      letter-spacing: -1px;
      flex-shrink: 0;
    }
    .brand-text {}
    .brand-name {
      display: block;
      font-family: 'Arial Black', Impact, sans-serif;
      font-size: 16px;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: #000000;
      font-weight: 900;
      line-height: 1.2;
    }
    .brand-sub {
      display: block;
      font-family: 'Courier New', Courier, monospace;
      font-size: 9px;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      color: #888888;
      margin-top: 3px;
    }
    .hero-band {
      background-color: ${accentColor === '#000000' ? '#000000' : accentColor};
      color: #ffffff;
      padding: 32px 40px;
      border-bottom: 4px solid #000000;
    }
    .hero-eyebrow {
      font-family: 'Courier New', Courier, monospace;
      font-size: 10px;
      font-weight: bold;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: rgba(255,255,255,0.6);
      margin: 0 0 12px 0;
    }
    .hero-title {
      font-family: 'Arial Black', Impact, sans-serif;
      font-size: clamp(28px, 5vw, 40px);
      line-height: 1.1;
      letter-spacing: -1.5px;
      text-transform: uppercase;
      color: #ffffff;
      margin: 0 0 10px 0;
    }
    .hero-subtitle {
      font-size: 16px;
      line-height: 1.5;
      color: rgba(255,255,255,0.85);
      margin: 0;
    }
    .content-area {
      padding: 40px 40px 32px;
    }
    .body-copy {
      font-size: 15px;
      line-height: 1.7;
      color: #333333;
      margin: 0 0 20px;
    }
    .otp-block {
      border: 4px solid #000000;
      background-color: #f8f8f5;
      padding: 32px 24px;
      text-align: center;
      margin: 28px 0;
    }
    .otp-label {
      font-family: 'Courier New', Courier, monospace;
      font-size: 10px;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: #888888;
      margin: 0 0 16px;
    }
    .otp-code {
      font-family: 'Courier New', Courier, monospace;
      font-size: 52px;
      font-weight: 900;
      letter-spacing: 12px;
      color: #000000;
      margin: 0 0 8px;
      line-height: 1;
    }
    .otp-expiry {
      font-family: 'Courier New', Courier, monospace;
      font-size: 11px;
      color: #888888;
      margin: 0;
    }
    .info-card {
      border: 2px solid #000000;
      background-color: #faf9f6;
      padding: 20px 24px;
      margin: 24px 0;
    }
    .info-card-title {
      font-family: 'Arial Black', sans-serif;
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin: 0 0 10px;
      color: #000000;
    }
    .info-card-body {
      font-size: 13px;
      line-height: 1.6;
      color: #555555;
      margin: 0;
    }
    .session-detail-row {
      display: flex;
      justify-content: space-between;
      padding: 12px 0;
      border-bottom: 1px solid #eeeeee;
      font-size: 14px;
    }
    .session-detail-row:last-child { border-bottom: none; }
    .session-detail-label {
      font-family: 'Courier New', Courier, monospace;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #888888;
      display: block;
      margin-bottom: 3px;
    }
    .session-detail-value {
      font-weight: 700;
      color: #000000;
    }
    .btn-solid {
      display: inline-block;
      background-color: #000000;
      color: #ffffff !important;
      border: 3px solid #000000;
      padding: 16px 32px;
      font-family: 'Arial Black', Impact, sans-serif;
      font-size: 13px;
      letter-spacing: 1px;
      text-transform: uppercase;
      text-decoration: none;
      font-weight: bold;
      text-align: center;
    }
    .btn-solid:hover { background-color: #333333; }
    .divider {
      height: 4px;
      background-color: #000000;
      margin: 32px 0;
    }
    .feature-grid {
      display: table;
      width: 100%;
      margin: 20px 0;
    }
    .feature-item {
      display: table-cell;
      padding: 16px;
      border: 2px solid #000000;
      text-align: center;
      font-size: 12px;
      line-height: 1.4;
      vertical-align: top;
      width: 33.33%;
    }
    .feature-icon {
      font-size: 24px;
      display: block;
      margin-bottom: 8px;
    }
    .footer-bar {
      border-top: 4px solid #000000;
      padding: 28px 40px;
      background-color: #f8f8f5;
      font-family: 'Courier New', Courier, monospace;
      font-size: 11px;
      line-height: 1.7;
      color: #777777;
    }
    .footer-bar a { color: #000000; text-decoration: underline; }
    .footer-links {
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid #dddddd;
    }
    .payment-box {
      border: 3px solid #000000;
      background-color: #000000;
      color: #ffffff;
      padding: 24px;
      margin: 24px 0;
    }
    .payment-title {
      font-family: 'Arial Black', sans-serif;
      font-size: 15px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #ffffff;
      margin: 0 0 16px;
    }
    .payment-row {
      display: flex;
      justify-content: space-between;
      font-size: 13px;
      padding: 6px 0;
      border-bottom: 1px solid rgba(255,255,255,0.15);
    }
    .payment-row:last-child { border-bottom: none; }
    .payment-label { color: rgba(255,255,255,0.6); font-family: 'Courier New', Courier, monospace; font-size: 10px; text-transform: uppercase; }
    .payment-value { color: #ffffff; font-weight: 700; }
  </style>
</head>
<body>
  <div class="wrapper">
    <table class="container" role="presentation" width="100%">
      <!-- HEADER -->
      <tr>
        <td class="header-bar">
          <table role="presentation" width="100%">
            <tr>
              <td>
                <table role="presentation">
                  <tr>
                    <td style="width:48px;vertical-align:middle;">
                      <div class="brand-mark">AP</div>
                    </td>
                    <td style="padding-left:14px;vertical-align:middle;">
                      <span class="brand-name">ADDIS PSYCHOLOGY</span>
                      <span class="brand-sub">SUPPORT. ON YOUR TERMS. · ADDIS ABABA</span>
                    </td>
                  </tr>
                </table>
              </td>
              <td style="text-align:right;vertical-align:middle;">
                <span style="font-family:'Courier New',monospace;font-size:10px;color:#aaaaaa;text-transform:uppercase;letter-spacing:1px;">CONFIDENTIAL</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- HERO BAND -->
      <tr>
        <td class="hero-band">
          <p class="hero-eyebrow">${escapeHtml(eyebrow)}</p>
          <h1 class="hero-title">${escapeHtml(title)}</h1>
          ${subtitle ? `<p class="hero-subtitle">${escapeHtml(subtitle)}</p>` : ''}
        </td>
      </tr>

      <!-- CONTENT -->
      <tr>
        <td class="content-area">
          ${bodyHtml}
          ${ctaText && ctaUrl ? `
            <table role="presentation" width="100%" style="margin-top:28px;">
              <tr>
                <td>
                  <a href="${safeLink(ctaUrl)}" class="btn-solid" target="_blank">${escapeHtml(ctaText)} &rarr;</a>
                </td>
              </tr>
            </table>
            <p style="margin-top:14px;font-size:12px;color:#888888;font-family:'Courier New',monospace;">
              Or copy this link into your browser:<br>
              <span style="word-break:break-all;color:#555555;">${safeLink(ctaUrl)}</span>
            </p>
          ` : ''}
        </td>
      </tr>

      <!-- FOOTER -->
      <tr>
        <td class="footer-bar">
          <table role="presentation" width="100%">
            <tr>
              <td>
                <strong style="color:#000000;">ADDIS PSYCHOLOGY PLATFORM</strong><br>
                A confidential, dignified space for mental wellness in Addis Ababa.<br>
                ${footerNote ? `<div style="margin-top:8px;color:#555555;">${escapeHtml(footerNote)}</div>` : ''}
                <div class="footer-links">
                  <a href="https://addis-psychology-platform.vercel.app/therapists">Browse Therapists</a> &nbsp;·&nbsp;
                  <a href="https://addis-psychology-platform.vercel.app/account">My Account</a> &nbsp;·&nbsp;
                  <a href="https://addis-psychology-platform.vercel.app/terms">Terms &amp; Privacy</a>
                </div>
                <div style="margin-top:10px;font-size:10px;color:#aaaaaa;">
                  For your privacy, therapy chat transcripts and clinical notes are never sent by email.
                  This email was sent to you because you have an Addis Psychology account.
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
 * Renders the OTP Confirmation Email template.
 * Supabase now sends a 6-digit OTP code instead of a magic link.
 */
export function renderEmailConfirmationTemplate(confirmUrl = '{{ .ConfirmationURL }}', name = ''): string {
  // Extract OTP from URL if available, otherwise show the button flow
  const greeting = name ? `Welcome, ${name}.` : 'Welcome aboard.';

  return renderRawBlockEmail({
    eyebrow: '01 / ACCOUNT CONFIRMATION',
    title: 'You\'re almost in.',
    subtitle: greeting,
    accentColor: '#000000',
    bodyHtml: `
      <p class="body-copy">
        Thank you for joining Addis Psychology — a confidential space for mental wellness in Addis Ababa.
        One quick step to activate your account: confirm your email address below.
      </p>

      <div class="otp-block">
        <p class="otp-label">🔐 Your Verification Code</p>
        <p class="otp-code">{{ .Token }}</p>
        <p class="otp-expiry">Valid for 60 minutes · Do not share this code with anyone</p>
      </div>

      <p class="body-copy" style="font-size:14px;color:#666666;">
        Or click the button below to confirm automatically:
      </p>

      <table role="presentation" width="100%" style="margin:0 0 24px;">
        <tr>
          <td>
            <a href="${safeLink(confirmUrl)}" class="btn-solid" target="_blank">Confirm My Email &rarr;</a>
          </td>
        </tr>
      </table>

      <div class="info-card">
        <p class="info-card-title">🛡️ Your Privacy &amp; Security</p>
        <p class="info-card-body">
          Your identity, appointments, and conversations are protected.
          Never share this verification code with anyone — our team will never ask for it.
          If you didn't create an account, you can safely ignore this email.
        </p>
      </div>

      <div style="height:1px;background:#eeeeee;margin:28px 0;"></div>

      <table role="presentation" width="100%" style="margin-bottom:8px;">
        <tr>
          <td style="width:33%;padding:16px 8px 16px 0;border-right:2px solid #eeeeee;text-align:center;vertical-align:top;">
            <span style="font-size:28px;display:block;margin-bottom:8px;">💬</span>
            <span style="font-size:12px;font-weight:700;display:block;text-transform:uppercase;letter-spacing:0.5px;">Private Chat</span>
            <span style="font-size:11px;color:#888888;">Text &amp; voice sessions</span>
          </td>
          <td style="width:33%;padding:16px;border-right:2px solid #eeeeee;text-align:center;vertical-align:top;">
            <span style="font-size:28px;display:block;margin-bottom:8px;">📅</span>
            <span style="font-size:12px;font-weight:700;display:block;text-transform:uppercase;letter-spacing:0.5px;">Appointments</span>
            <span style="font-size:11px;color:#888888;">Book live sessions</span>
          </td>
          <td style="width:33%;padding:16px 0 16px 8px;text-align:center;vertical-align:top;">
            <span style="font-size:28px;display:block;margin-bottom:8px;">🔒</span>
            <span style="font-size:12px;font-weight:700;display:block;text-transform:uppercase;letter-spacing:0.5px;">Confidential</span>
            <span style="font-size:11px;color:#888888;">Your data is safe</span>
          </td>
        </tr>
      </table>
    `,
    footerNote: 'If you did not create an Addis Psychology account, please ignore this email.',
  });
}

/**
 * Renders the Password Reset Email template
 */
export function renderPasswordResetTemplate(resetUrl = '{{ .ConfirmationURL }}'): string {
  return renderRawBlockEmail({
    eyebrow: 'SECURITY / ACCOUNT RECOVERY',
    title: 'Reset your password.',
    subtitle: 'A password reset was requested for your account.',
    accentColor: '#000000',
    bodyHtml: `
      <p class="body-copy">
        We received a request to reset the password for your Addis Psychology account.
        Click the button below to set a new password. This link expires in 1 hour for your security.
      </p>

      <div class="info-card" style="border-color:#cc0000;">
        <p class="info-card-title">⚠️ Didn't request this?</p>
        <p class="info-card-body">
          If you didn't ask to reset your password, your account may be at risk.
          You can safely ignore this email — your existing password remains unchanged.
          Consider updating your password and enabling Telegram notifications for security alerts.
        </p>
      </div>

      <p class="body-copy" style="font-size:13px;color:#666666;">
        For your security, never forward this email to anyone else. Our support team will never ask for your password.
      </p>
    `,
    ctaText: 'Reset My Password',
    ctaUrl: resetUrl,
    footerNote: 'This link expires in 1 hour. For security reasons, never share this link.',
  });
}

/**
 * Renders a beautiful Appointment Notification / Reminder email
 * Used for both clients and therapists
 */
export function renderAppointmentEmail({
  recipientName,
  recipientRole = 'client',
  summary,
  appointmentPath,
  accountPath,
  isReminder = false,
  therapistName,
  clientName,
  sessionDate,
  sessionTime,
  sessionMedium,
  sessionPrice,
}: {
  recipientName?: string;
  recipientRole?: 'client' | 'therapist';
  summary: string;
  appointmentPath: string;
  accountPath: string;
  isReminder?: boolean;
  therapistName?: string;
  clientName?: string;
  sessionDate?: string;
  sessionTime?: string;
  sessionMedium?: string;
  sessionPrice?: string;
}): { subject: string; html: string; text: string } {
  const subject = isReminder
    ? `📅 Reminder: Your Addis Psychology Session${sessionDate ? ` on ${sessionDate}` : ''}`
    : `📅 Addis Psychology: Appointment ${recipientRole === 'therapist' ? 'Request' : 'Update'}`;

  const eyebrow = isReminder ? 'REMINDER / UPCOMING SESSION' : (recipientRole === 'therapist' ? 'NEW BOOKING / ACTION REQUIRED' : 'UPDATE / APPOINTMENT');
  const title = isReminder ? 'Your session is approaching.' : (recipientRole === 'therapist' ? 'New session booked.' : 'Appointment update.');
  const subtitle = recipientName
    ? `Hello ${escapeHtml(recipientName)},`
    : (recipientRole === 'therapist' ? 'A client has scheduled a session with you.' : 'Here are your latest session details.');

  const sessionDetailsHtml = (therapistName || clientName || sessionDate || sessionTime) ? `
    <div style="border:3px solid #000000;margin:24px 0;overflow:hidden;">
      <div style="background:#000000;color:#ffffff;padding:14px 20px;font-family:'Arial Black',sans-serif;font-size:13px;text-transform:uppercase;letter-spacing:1px;">
        ${isReminder ? '⏰ Session Details' : '📋 Booking Information'}
      </div>
      <div style="padding:20px;">
        <table role="presentation" width="100%">
          ${sessionDate ? `<tr><td style="padding:10px 0;border-bottom:1px solid #eeeeee;">
            <span style="font-family:'Courier New',monospace;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#888888;display:block;">Date</span>
            <strong style="font-size:16px;">${escapeHtml(sessionDate)}</strong>
          </td></tr>` : ''}
          ${sessionTime ? `<tr><td style="padding:10px 0;border-bottom:1px solid #eeeeee;">
            <span style="font-family:'Courier New',monospace;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#888888;display:block;">Time (Addis Ababa · UTC+3)</span>
            <strong style="font-size:16px;">${escapeHtml(sessionTime)}</strong>
          </td></tr>` : ''}
          ${therapistName && recipientRole === 'client' ? `<tr><td style="padding:10px 0;border-bottom:1px solid #eeeeee;">
            <span style="font-family:'Courier New',monospace;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#888888;display:block;">Therapist</span>
            <strong>${escapeHtml(therapistName)}</strong>
          </td></tr>` : ''}
          ${clientName && recipientRole === 'therapist' ? `<tr><td style="padding:10px 0;border-bottom:1px solid #eeeeee;">
            <span style="font-family:'Courier New',monospace;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#888888;display:block;">Client</span>
            <strong>${escapeHtml(clientName)}</strong>
          </td></tr>` : ''}
          ${sessionMedium ? `<tr><td style="padding:10px 0;border-bottom:1px solid #eeeeee;">
            <span style="font-family:'Courier New',monospace;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#888888;display:block;">Format</span>
            <strong>${escapeHtml(sessionMedium)}</strong>
          </td></tr>` : ''}
          ${sessionPrice ? `<tr><td style="padding:10px 0;">
            <span style="font-family:'Courier New',monospace;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#888888;display:block;">Session Fee</span>
            <strong>${escapeHtml(sessionPrice)}</strong>
          </td></tr>` : ''}
        </table>
      </div>
    </div>
  ` : `
    <div class="info-card">
      <p class="info-card-title">${isReminder ? '⏰ Upcoming Session' : '📋 Session Status'}</p>
      <p class="info-card-body" style="white-space:pre-line;">${escapeHtml(summary)}</p>
    </div>
  `;

  const reminderTipHtml = isReminder ? `
    <div style="border-left:4px solid #000000;padding:12px 16px;background:#faf9f6;margin:20px 0;font-size:13px;color:#555555;">
      <strong>Preparing for your session:</strong><br>
      Find a private, quiet space · Test your device and connection · Have some water nearby ·
      It's okay to arrive with whatever is on your mind.
    </div>
    <p style="font-size:13px;color:#888888;margin-bottom:0;">
      Need to reschedule? Please do so at least <strong>24 hours before</strong> your session
      to retain your full booking value.
    </p>
  ` : '';

  const therapistActionHtml = recipientRole === 'therapist' && !isReminder ? `
    <div style="background:#f0fdf0;border:2px solid #008000;padding:16px 20px;margin:20px 0;">
      <strong style="color:#005500;font-size:13px;">✅ Action Required</strong>
      <p style="margin:6px 0 0;font-size:13px;color:#005500;">
        Please review this booking request in your portal and confirm or request a change with the client.
      </p>
    </div>
  ` : '';

  const bodyHtml = `
    <p class="body-copy">${subtitle}</p>
    ${sessionDetailsHtml}
    ${therapistActionHtml}
    ${reminderTipHtml}
    <p class="body-copy" style="font-size:13px;color:#666666;">
      View full details, join instructions, and manage your booking in your account.
    </p>
  `;

  const html = renderRawBlockEmail({
    eyebrow,
    title,
    accentColor: isReminder ? '#1a1a2e' : '#000000',
    bodyHtml,
    ctaText: recipientRole === 'therapist' ? 'Open My Portal' : 'View My Appointment',
    ctaUrl: appointmentPath,
    footerNote: `Manage notification preferences in Account settings: ${accountPath}`,
  });

  const text = `Addis Psychology\n\n${title}\n\n${summary}\n\nView appointment: ${appointmentPath}\nManage notifications: ${accountPath}\n\nFor your privacy, message contents are never included in email notifications.`;

  return { subject, html, text };
}

/**
 * Beautiful new-message notification for therapists
 */
export function renderNewMessageEmail({
  therapistName,
  clientInitials,
  chatUrl,
  accountUrl,
}: {
  therapistName: string;
  clientInitials?: string;
  chatUrl: string;
  accountUrl: string;
}): { subject: string; html: string; text: string } {
  const subject = `💬 New message from a client — Addis Psychology`;

  const bodyHtml = `
    <p class="body-copy">
      Hello ${escapeHtml(therapistName)},
    </p>
    <p class="body-copy">
      A client has sent you a new private message on Addis Psychology.
      For their confidentiality, the message content is not included in this notification.
    </p>

    <div style="border:4px solid #000000;padding:32px;text-align:center;margin:28px 0;background:#f8f8f5;">
      <div style="width:64px;height:64px;background:#000000;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px;">
        <span style="color:#ffffff;font-size:24px;font-weight:900;font-family:'Arial Black',sans-serif;">${escapeHtml(clientInitials || '?')}</span>
      </div>
      <p style="font-family:'Courier New',monospace;font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#888888;margin:0 0 8px;">New Private Message</p>
      <p style="font-size:15px;color:#333333;margin:0;">Open your workspace to read and reply securely.</p>
    </div>

    <table role="presentation" width="100%" style="margin:0 0 24px;">
      <tr>
        <td>
          <a href="${safeLink(chatUrl)}" class="btn-solid" target="_blank">Open My Portal &rarr;</a>
        </td>
      </tr>
    </table>

    <div class="info-card">
      <p class="info-card-title">🔒 Privacy Reminder</p>
      <p class="info-card-body">
        Message content is never transmitted by email to protect client confidentiality.
        Always use the secure Addis Psychology platform or Telegram bot to read and reply to client messages.
        Check your workspace even when notifications are delayed or muted.
      </p>
    </div>
  `;

  const html = renderRawBlockEmail({
    eyebrow: 'PRIVATE MESSAGE / THERAPIST NOTIFICATION',
    title: 'New message waiting.',
    accentColor: '#000000',
    bodyHtml,
    footerNote: `Manage notification settings: ${accountUrl}`,
  });

  const text = `Addis Psychology\n\nHello ${therapistName},\n\nA client has sent you a new private message. Open your portal to read and reply:\n${chatUrl}\n\nFor confidentiality, message content is never included in email notifications.\n\nManage notifications: ${accountUrl}`;

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
  const subject = `Addis Psychology: ${title}`;

  const bodyHtml = `
    <div style="font-size:15px;line-height:1.7;color:#333333;margin:16px 0;">
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

  const text = `Addis Psychology\n\n${title}\n\n${message}\n\n${actionUrl ? `Visit: ${actionUrl}\n\n` : ''}`;

  return { subject, html, text };
}
