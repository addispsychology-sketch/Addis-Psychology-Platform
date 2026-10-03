'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { usePlatform } from './Platform';
import { authenticatedFetch, getSupabase } from '@/lib/supabase';
import { motion } from 'framer-motion';

export default function BookingDetails({ therapist, day, time, medium, available }: { therapist: number; day: string; time: string; medium: 'online' | 'inperson'; available: boolean }) {
  const { userId, refreshAppointments } = usePlatform();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [language, setLanguage] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [booked, setBooked] = useState(false);
  useEffect(() => {
    let alive = true;
    void getSupabase()?.auth.getUser().then(({ data }) => {
      if (!alive || !data.user) return;
      setName(String(data.user.user_metadata.full_name || ''));
      setPhone(data.user.phone ? '+' + data.user.phone.replace(/^\+/, '') : '');
    });
    return () => { alive = false; };
  }, [userId]);
  if (booked) return <section className="booking-details booking-success" role="status"><ShieldCheck size={34} /><h2>Your request is in.</h2><p>Addis Psychology will review and confirm your appointment. Once confirmed, arrange payment directly with your therapist. No payment has been collected here.</p><Link className="solid" href="/appointments">View my appointments <ArrowRight size={17} /></Link></section>;
  if (!userId) return (
    <section className="booking-details">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <span className="account-eyebrow">ONE SIMPLE STEP</span>
        <h2 style={{ fontSize: 'clamp(26px, 3vw, 38px)', margin: '10px 0 6px', letterSpacing: '-0.5px' }}>Your session,<br /><span style={{ display: 'inline-block', background: 'var(--ink)', color: 'var(--paper)', padding: '2px 10px' }}>secured.</span></h2>
        <p style={{ fontSize: '15px', borderTop: '3px solid var(--ink)', paddingTop: '16px', marginTop: '16px', maxWidth: '440px' }}>Create your free account to request this session and receive appointment updates. It takes under a minute.</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginTop: '28px', maxWidth: '480px' }}>
          <motion.div
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15, duration: 0.35 }}
            style={{ border: '3px solid var(--ink)', padding: '20px 18px', background: 'var(--ink)', color: 'var(--paper)', display: 'flex', flexDirection: 'column' }}
          >
            <span style={{ fontSize: '22px', marginBottom: '10px' }}>🔑</span>
            <strong style={{ display: 'block', fontFamily: 'Archivo Black, sans-serif', fontSize: '16px', marginBottom: '6px', color: 'var(--paper)' }}>Sign In</strong>
            <p style={{ fontSize: '12px', color: '#bbb', margin: '0 0 16px', flex: 1 }}>Have an account? Sign in and book instantly.</p>
            <Link className="solid" style={{ background: 'var(--paper)', color: 'var(--ink)', borderColor: 'var(--paper)', fontSize: '11px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px' }} href={`/account?next=${encodeURIComponent(`/schedule/${therapist}?date=${day}&time=${time}&medium=${medium}`)}`}>Sign in <ArrowRight size={14} /></Link>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.25, duration: 0.35 }}
            style={{ border: '3px solid var(--ink)', padding: '20px 18px', display: 'flex', flexDirection: 'column' }}
          >
            <span style={{ fontSize: '22px', marginBottom: '10px' }}>🙋</span>
            <strong style={{ display: 'block', fontFamily: 'Archivo Black, sans-serif', fontSize: '16px', marginBottom: '6px' }}>Join Free</strong>
            <p style={{ fontSize: '12px', color: 'var(--muted-text)', margin: '0 0 16px', flex: 1 }}>New here? Create your account in seconds.</p>
            <Link className="solid" style={{ fontSize: '11px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px' }} href={`/account?next=${encodeURIComponent(`/schedule/${therapist}?date=${day}&time=${time}&medium=${medium}`)}`}>Create account <ArrowRight size={14} /></Link>
          </motion.div>
        </div>
        <p style={{ fontSize: '12px', marginTop: '20px', color: 'var(--muted-text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldCheck size={14} /> No medical history needed here. Discuss personal concerns privately with your therapist.
        </p>
      </motion.div>
    </section>
  );

  return <section className="booking-details"><span className="account-eyebrow">03 / YOUR DETAILS</span><h2>Let’s make it personal.</h2><p>Request your time. Addis Psychology confirms your booking, then you pay your therapist directly. Messaging package payments are separate.</p>
    <form onSubmit={async e => {
      e.preventDefault(); if (busy) return;
      setBusy(true); setNotice('');
      try {
        await authenticatedFetch('/api/bookings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ therapist, date: day, time, medium, name, phone, language, consent }) });
        setBooked(true); await refreshAppointments();
      } catch (error) { setNotice(error instanceof Error ? error.message : 'Please try again.'); }
      finally { setBusy(false); }
    }}>
      <div className="booking-contact-grid"><label>Your name<input required autoComplete="name" minLength={2} maxLength={100} value={name} onChange={e => setName(e.target.value)} placeholder="Your full name" /></label><label>Phone number<input required type="tel" autoComplete="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+251 … or 09…" /><small>Only shared with your therapist.</small></label></div>
      <label>Preferred language <span className="account-optional">optional</span><select value={language} onChange={e => setLanguage(e.target.value)}><option value="">No preference</option><option>Amharic</option><option>English</option><option>Afaan Oromo</option><option>Tigrinya</option><option>Other — please ask me</option></select></label>
      <label className="booking-consent"><input type="checkbox" required checked={consent} onChange={e => setConsent(e.target.checked)} /><span>I agree to share these contact details with my therapist to arrange this session.</span></label>
      <div className="booking-confirm-row"><p><ShieldCheck size={16} /> No medical history needed here. Discuss personal concerns privately with your therapist.</p><button className="solid" disabled={!day || !time || !available || !consent || busy}>{busy ? 'Sending request…' : 'Request appointment'} <ArrowRight size={17} /></button></div>
      {notice && <p className="account-notice" role="alert">{notice}</p>}
    </form>
  </section>;
}
