import { mkdirSync, writeFileSync } from 'node:fs';
import { renderEmailConfirmationTemplate, renderPasswordResetTemplate, renderAuthEmail } from '../lib/email-templates.ts';
const origin = process.env.APP_URL || 'https://addis-psychology-platform.vercel.app';
const confirmationUrl = origin + '/auth/confirm?token_hash={{ .TokenHash }}&type=email';
const recoveryUrl = origin + '/auth/confirm?token_hash={{ .TokenHash }}&type=recovery';
mkdirSync(new URL('../supabase/templates/', import.meta.url), { recursive: true });
for (const [name, html] of Object.entries({
  confirmation: renderEmailConfirmationTemplate(confirmationUrl),
  recovery: renderPasswordResetTemplate(recoveryUrl),
  email_change: renderAuthEmail({ title: 'Your email. Updated.', preheader: 'Confirm your email address for Addis Psychology.', copy: 'Confirm this email address to finish updating your account. You may need to confirm through both your current and new inbox.', action: 'Confirm email address', url: '{{ .ConfirmationURL }}' }),
})) writeFileSync(new URL('../supabase/templates/' + name + '.html', import.meta.url), html);
console.log('Generated confirmation, recovery and email-change HTML templates.');
