'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, Bell, CalendarDays, CheckCircle2, ChevronDown, ChevronUp, Eye, EyeOff, LockKeyhole, MessageCircle, ShieldCheck, UserRound } from 'lucide-react';
import { authenticatedFetch, getSupabase } from '@/lib/supabase';
import { normalizePhone } from '@/lib/booking-validation';
import { telegramSignIn } from '@/lib/telegram-client';
import { TERMS_VERSION } from '@/lib/payment-policy';
import { usePlatform } from './Platform';

export default function AccountPanel() {
  const { userId, ownTherapistId, refreshWallet } = usePlatform();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') || '';
  const destination = /^\/(?!\/)/.test(next) && !next.includes('\\') ? next : '';
  const [mode, setMode] = useState<'signin' | 'signup' | 'reset' | 'verify-code'>('signin');
  const [method, setMethod] = useState<'email' | 'phone'>('email');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [showTermsDrawer, setShowTermsDrawer] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState<number | null>(null);
  const [prefs, setPrefs] = useState({ telegram_notifications: true, email_notifications: true });
  const [profileReady, setProfileReady] = useState(false);
  const [revision, setRevision] = useState(0);
  const bot = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;

  useEffect(() => {
    let alive = true;
    const db = getSupabase();
    if (!db || !userId) return;
    void Promise.all([
      db.auth.getUser(),
      db.from('telegram_accounts').select('telegram_id,verified_phone').eq('user_id', userId).maybeSingle(),
      db.from('account_preferences').select('telegram_notifications,email_notifications').eq('user_id', userId).maybeSingle()
    ]).then(([auth, telegram, preferences]) => {
      if (!alive) return;
      const user = auth.data.user;
      setName(String(user?.user_metadata.full_name || ''));
      setEmail(user?.email?.endsWith('@telegram.addis.invalid') ? '' : user?.email || '');
      setPhone(telegram.data?.verified_phone || '');
      setConnected(telegram.data?.telegram_id || null);
      setPrefs(preferences.data || { telegram_notifications: true, email_notifications: true });
      setProfileReady(!auth.error && !telegram.error && !preferences.error);
    });
    return () => { alive = false; };
  }, [userId, revision]);

  async function perform(action: () => Promise<void>) {
    setBusy(true); setNotice('');
    try { await action(); } catch (error) { setNotice(error instanceof Error ? error.message : 'Please try again.'); }
    finally { setBusy(false); }
  }

  async function recordTerms() {
    try {
      await authenticatedFetch('/api/terms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accepted: true, audience: 'client', version: TERMS_VERSION })
      });
      await refreshWallet();
    } catch {}
  }

  async function submit() {
    await perform(async () => {
      const db = getSupabase();
      if (!db) throw new Error('Account sign-in is being prepared. Please come back shortly.');

      if (mode === 'reset') {
        const { error } = await db.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin + '/account' });
        if (error) throw error;
        setNotice('If an account exists for that email, you’ll receive a reset link. Open it, then set your new password here.');
        return;
      }

      if (mode === 'signin' && method === 'phone') {
        const response = await fetch('/api/auth/phone', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: normalizePhone(phone), password })
        });
        const session = await response.json();
        if (!response.ok) throw new Error(session.error);
        const { error } = await db.auth.setSession(session);
        if (error) throw error;
        setPassword('');
        setNotice('You’re signed in. Welcome to Addis.');
        if (destination) router.replace(destination);
        return;
      }

      if (mode === 'signup') {
        if (!agreeTerms) throw new Error('You must accept the Addis Psychology Terms and Conditions to create an account.');
        const result = await db.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              full_name: name.trim(),
              terms_accepted: true,
              terms_version: TERMS_VERSION,
              ...(phone.trim() ? { contact_phone: normalizePhone(phone) } : {})
            },
            emailRedirectTo: window.location.origin + '/account'
          }
        });
        if (result.error) throw result.error;
        setPassword('');

        if (result.data.session) {
          await recordTerms();
          setNotice('You’re signed in. Welcome to Addis.');
          if (destination) router.replace(destination);
        } else {
          // Switch to 6-digit confirmation code verification
          setMode('verify-code');
          setNotice(`A 6-digit verification code was sent to ${email.trim()}. Enter it below to activate your account.`);
        }
        return;
      }

      // Default signin with email/password
      const result = await db.auth.signInWithPassword({ email: email.trim(), password });
      if (result.error) throw result.error;
      setPassword('');
      if (result.data.session) {
        setNotice('You’re signed in. Welcome to Addis.');
        if (destination) router.replace(destination);
      }
    });
  }

  async function verifyOtpCode() {
    await perform(async () => {
      const db = getSupabase();
      if (!db) throw new Error('Authentication unavailable.');
      const code = otpCode.trim();
      if (!/^\d{6}$/.test(code)) throw new Error('Please enter the 6-digit verification code.');

      const { data, error } = await db.auth.verifyOtp({
        email: email.trim(),
        token: code,
        type: 'signup'
      });
      if (error) {
        // Also attempt email verification type if signup type differs in provider config
        const fallback = await db.auth.verifyOtp({
          email: email.trim(),
          token: code,
          type: 'email'
        });
        if (fallback.error) throw error;
      }

      await recordTerms();
      setNotice('Email verified! Welcome to Addis Psychology.');
      setMode('signin');
      if (destination) router.replace(destination);
    });
  }

  async function resendCode() {
    await perform(async () => {
      const db = getSupabase();
      if (!db) throw new Error('Service unavailable.');
      const { error } = await db.auth.resend({
        type: 'signup',
        email: email.trim()
      });
      if (error) throw error;
      setNotice(`A new 6-digit code was sent to ${email.trim()}.`);
    });
  }

  async function connectTelegram() {
    await perform(async () => {
      await telegramSignIn(!!userId);
      setRevision(n => n + 1);
      setNotice(userId ? 'Telegram connected. Open the bot and press Start to receive notifications.' : 'Welcome. Your Telegram account is ready.');
      if (!userId && destination) router.replace(destination);
    });
  }

  async function saveProfile() {
    await perform(async () => {
      const db = getSupabase();
      if (!db || !userId) throw new Error('Please sign in.');
      const { data: current } = await db.auth.getUser();
      const update: { data: { full_name: string }; email?: string; password?: string } = { data: { full_name: name.trim() } };
      if (email.trim() && email.trim() !== current.user?.email) update.email = email.trim();
      if (password) { if (password.length < 12) throw new Error('Use at least 12 characters for your password.'); update.password = password; }
      const { error } = await db.auth.updateUser(update, { emailRedirectTo: window.location.origin + '/account' });
      if (error) throw error;
      if (profileReady) {
        const saved = await db.from('account_preferences').upsert({ user_id: userId, ...prefs });
        if (saved.error) throw new Error('Your account was saved, but notification preferences could not be saved yet.');
      }
      setPassword('');
      setNotice(update.email ? 'Check your email to confirm the new address. Your other changes are saved.' : 'Your changes are saved.');
    });
  }

  return (
    <section className="account-layout">
      <div className="account-intro">
        <span className="account-eyebrow">YOUR SPACE / ADDIS PSYCHOLOGY</span>
        <h1>{userId ? <>A little space.<br />Just for you.</> : <>Good to<br />have you here.</>}</h1>
        <p>{userId ? 'Your sessions, conversations, and preferences. Together in one place.' : 'Support starts with a simple hello. One account for your conversations, appointments, and peace of mind.'}</p>
        <div className="account-benefits">
          <span><ShieldCheck size={19} /> Private conversations</span>
          <span><CalendarDays size={19} /> Sessions that fit your day</span>
          <span><Bell size={19} /> Reminders your way</span>
        </div>
        <div className="account-help">
          <span>ARE YOU A THERAPIST?</span>
          <p>Use the same sign-in. Your workspace appears once your practice is connected.</p>
          <Link href={userId && ownTherapistId ? '/portal' : '/register'}>
            {ownTherapistId ? 'Open therapist workspace' : 'Apply to join our therapists'} <ArrowRight size={15} />
          </Link>
        </div>
      </div>

      <div className="account-card">
        <div className="account-card-heading">
          <span className="account-symbol"><UserRound size={23} /></span>
          <div>
            <span className="account-eyebrow">{userId ? 'WELCOME BACK' : 'LET’S GET STARTED'}</span>
            <h2>
              {userId
                ? 'Your account'
                : mode === 'signup'
                ? 'Join Addis'
                : mode === 'verify-code'
                ? 'Confirm your code'
                : mode === 'reset'
                ? 'Reset password'
                : 'Sign in'}
            </h2>
          </div>
        </div>

        {!userId ? (
          <>
            {mode !== 'reset' && mode !== 'verify-code' && (
              <div className="account-tabs">
                <button type="button" aria-pressed={mode === 'signin'} onClick={() => { setMode('signin'); setNotice(''); }}>
                  Sign in
                </button>
                <button type="button" aria-pressed={mode === 'signup'} onClick={() => { setMode('signup'); setMethod('email'); setNotice(''); }}>
                  Create account
                </button>
              </div>
            )}

            {bot && mode !== 'reset' && mode !== 'verify-code' && (
              <>
                <button className="account-telegram" disabled={busy} onClick={() => void connectTelegram()}>
                  <MessageCircle size={18} /> Continue with Telegram <ArrowRight size={16} />
                </button>
                <p className="account-small">Already have an Addis account? Sign in below first, then connect Telegram.</p>
                <div className="account-divider"><span>or use your {method}</span></div>
              </>
            )}

            {mode === 'signin' && (
              <div className="account-method">
                <button aria-pressed={method === 'email'} onClick={() => setMethod('email')}>Email</button>
                <button aria-pressed={method === 'phone'} onClick={() => setMethod('phone')}>Phone number</button>
              </div>
            )}

            {/* ── MODE: VERIFY CODE (OTP) ── */}
            {mode === 'verify-code' ? (
              <form onSubmit={e => { e.preventDefault(); void verifyOtpCode(); }}>
                <p style={{ fontSize: '14px', lineHeight: 1.6, margin: '0 0 16px', color: 'var(--muted-text)' }}>
                  We sent a 6-digit confirmation code to <strong>{email}</strong>. Enter it below to activate your account and start your care.
                </p>
                <label>
                  6-Digit Verification Code
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    required
                    autoFocus
                    value={otpCode}
                    onChange={e => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    style={{
                      fontFamily: 'Space Mono, monospace',
                      fontSize: '28px',
                      letterSpacing: '8px',
                      textAlign: 'center',
                      fontWeight: 700,
                      padding: '14px',
                    }}
                  />
                </label>
                <button className="solid account-submit" disabled={busy || otpCode.length !== 6}>
                  {busy ? 'Verifying…' : 'Confirm Code & Enter'} <ArrowRight size={17} />
                </button>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px', fontSize: '12px' }}>
                  <button type="button" className="account-text-button" style={{ padding: 0 }} onClick={() => void resendCode()} disabled={busy}>
                    Resend code
                  </button>
                  <button type="button" className="account-text-button" style={{ padding: 0 }} onClick={() => { setMode('signup'); setNotice(''); }}>
                    Use different email
                  </button>
                </div>
              </form>
            ) : (
              /* ── STANDARD SIGNIN / SIGNUP FORM ── */
              <form onSubmit={e => { e.preventDefault(); void submit(); }}>
                {mode === 'signup' && (
                  <label>
                    Your name
                    <input autoComplete="name" required minLength={2} maxLength={100} value={name} onChange={e => setName(e.target.value)} placeholder="What should we call you?" />
                  </label>
                )}
                {mode === 'signup' && (
                  <label>
                    Phone number <span className="account-optional">optional</span>
                    <input type="tel" autoComplete="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+251 … or 09…" />
                    <small>For appointment reminders. Only shared with your therapist.</small>
                  </label>
                )}
                {method === 'phone' && mode === 'signin' ? (
                  <label>
                    Phone number
                    <input type="tel" autoComplete="tel" required value={phone} onChange={e => setPhone(e.target.value)} placeholder="+251 …" />
                    <small>Use the number you verified through our Telegram bot.</small>
                  </label>
                ) : (
                  <label>
                    Email address
                    <input type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
                  </label>
                )}
                {mode !== 'reset' && (
                  <label>
                    Password
                    <div className="account-password">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        minLength={mode === 'signup' ? 12 : undefined}
                        required
                        autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder={mode === 'signup' ? 'At least 12 characters' : 'Your password'}
                      />
                      <button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(!showPassword)}>
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </label>
                )}

                {/* ── DETAILED TERMS & CONDITIONS ACCEPTANCE ON SIGNUP ── */}
                {mode === 'signup' && (
                  <div style={{ margin: '20px 0 16px', border: '2px solid var(--ink)', padding: '16px', background: 'var(--surface-soft)' }}>
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', margin: 0, textTransform: 'none', letterSpacing: 0, fontSize: '13px', lineHeight: 1.5, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        required
                        checked={agreeTerms}
                        onChange={e => setAgreeTerms(e.target.checked)}
                        style={{ marginTop: '3px', width: 'auto', flexShrink: 0 }}
                      />
                      <span>
                        <strong>I agree to the Addis Psychology Terms &amp; Conditions</strong>, including our 5% platform service fee, payment through treasury payee <strong>Dawit Aynalem</strong> (Telebirr 0990171738 / CBE 1000605180519), the 24-hour cancellation rule for 100% unused session refunds, emergency rescheduling protection, and 24-hour refund processing.
                      </span>
                    </label>

                    <button
                      type="button"
                      onClick={() => setShowTermsDrawer(!showTermsDrawer)}
                      style={{
                        marginTop: '12px',
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        fontSize: '11px',
                        fontFamily: 'Space Mono, monospace',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        color: 'var(--ink)',
                        cursor: 'pointer',
                        textDecoration: 'underline'
                      }}
                    >
                      {showTermsDrawer ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      {showTermsDrawer ? 'Hide terms summary' : 'Read key policy details'}
                    </button>

                    {showTermsDrawer && (
                      <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid var(--rule-soft)', fontSize: '12px', lineHeight: 1.6, color: 'var(--text)' }}>
                        <p style={{ margin: '0 0 8px' }}><strong>🌿 Services Provided:</strong> One-to-one confidential text messaging, recorded audio notes, live audio consultations, verified practitioner directory, and booking management.</p>
                        <p style={{ margin: '0 0 8px' }}><strong>💳 Payment &amp; Wallet:</strong> Manual transfers to Dawit Aynalem via Telebirr (0990171738) or CBE (1000605180519). Verified funds are credited to your secure prepaid wallet.</p>
                        <p style={{ margin: '0 0 8px' }}><strong>🪙 5% Platform Fee:</strong> A 5% Addis Psychology service fee is applied to therapy appointments and text/voice packages when payment is made. This fee is non-refundable upon verification.</p>
                        <p style={{ margin: '0 0 8px' }}><strong>⏱️ 24-Hour Cancellation &amp; Refund:</strong> Cancel or request changes at least 24 hours before your session to receive a 100% refund of unused session value. For multi-session packs (e.g. 4 sessions), remaining unused sessions are refunded in full when requested 24 hours in advance.</p>
                        <p style={{ margin: '0 0 8px' }}><strong>🚨 Emergencies:</strong> If an unforeseen emergency prevents session attendance, your funds remain reserved and will be applied to an agreed replacement date.</p>
                        <p style={{ margin: '0 0 8px' }}><strong>⚡ 24-Hour Payouts:</strong> Approved refunds from your available wallet balance are processed and transferred to your receiving account within 24 hours.</p>
                        <p style={{ margin: '0 0 8px' }}><strong>🔒 Confidentiality:</strong> All interactions adhere to strict clinical ethics and professional privacy standards. Message content is never transmitted via email.</p>
                        <Link href="/terms" target="_blank" style={{ fontSize: '11px', fontWeight: 700 }}>Read complete legal terms &rarr;</Link>
                      </div>
                    )}
                  </div>
                )}

                <button className="solid account-submit" disabled={busy || (mode === 'signup' && !agreeTerms)}>
                  {busy ? 'One moment…' : mode === 'signup' ? 'Create my account' : mode === 'reset' ? 'Send reset link' : 'Sign in'} <ArrowRight size={17} />
                </button>
              </form>
            )}

            {mode !== 'verify-code' && (
              <button
                className="account-text-button"
                type="button"
                onClick={() => {
                  setMode(mode === 'reset' ? 'signin' : 'reset');
                  setMethod('email');
                  setNotice('');
                }}
              >
                {mode === 'reset' ? 'Back to sign in' : 'Forgot your password?'}
              </button>
            )}

            <p className="account-small"><LockKeyhole size={13} /> Your browser remembers you after you sign in. Sign out on shared devices.</p>
          </>
        ) : (
          <>
            <nav className="account-shortcuts" aria-label="Account shortcuts">
              <Link href={ownTherapistId ? '/portal' : '/appointments'}><CalendarDays size={19} /> {ownTherapistId ? 'Workspace' : 'Appointments'}</Link>
              <Link href={ownTherapistId ? '/portal?tab=chat' : '/chat'}><MessageCircle size={19} /> Messages</Link>
            </nav>
            {destination && <Link className="account-return" href={destination}>Continue where you left off <ArrowRight size={16} /></Link>}
            <form onSubmit={e => { e.preventDefault(); void saveProfile(); }}>
              <label>Your name<input autoComplete="name" maxLength={100} value={name} onChange={e => setName(e.target.value)} /></label>
              <label>Email for reminders<input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Add an email address" /><small>We’ll ask you to confirm a new address.</small></label>
              <label>New password <span className="account-optional">optional</span><input type="password" minLength={12} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Leave blank to keep your password" /></label>
              <div className="account-connection">
                <strong><MessageCircle size={18} /> Telegram {connected ? 'connected ✓' : 'not connected'}</strong>
                <p>{connected ? `Telegram ID ${connected}. ${phone ? 'Your phone is ready for phone-and-password sign-in.' : 'To add phone sign-in, open the bot, send /phone, and share your own number. Then set a password above.'}` : 'Connect once to receive private message alerts and appointment reminders.'}</p>
                {connected && bot ? (
                  <a href={`https://t.me/${bot}?start=connect`} target="_blank" rel="noopener noreferrer">Open bot & press Start <ArrowRight size={14} /></a>
                ) : (
                  <button type="button" disabled={busy || !bot} onClick={() => void connectTelegram()}>{bot ? 'Connect Telegram' : 'Telegram setup in progress'}</button>
                )}
              </div>
              <fieldset className="account-notifications" disabled={!profileReady}>
                <legend>Remind me through</legend>
                <label><input type="checkbox" checked={prefs.telegram_notifications} onChange={e => setPrefs({ ...prefs, telegram_notifications: e.target.checked })} /> Telegram</label>
                <label><input type="checkbox" checked={prefs.email_notifications} onChange={e => setPrefs({ ...prefs, email_notifications: e.target.checked })} /> Email</label>
              </fieldset>
              <button className="solid account-submit" disabled={busy}>{busy ? 'Saving…' : 'Save changes'} <ArrowRight size={17} /></button>
            </form>
            <button className="account-text-button" onClick={() => void perform(async () => { await getSupabase()?.auth.signOut(); setPassword(''); setNotice('You’re signed out.'); })}>
              Sign out
            </button>
          </>
        )}

        {notice && <p className="account-notice" role="status">{notice}</p>}
      </div>
    </section>
  );
}
