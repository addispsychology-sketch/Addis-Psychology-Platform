'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { usePlatform } from './Platform';
import { authenticatedFetch, getSupabase } from '@/lib/supabase';

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
  if (booked) return <section className="booking-details booking-success" role="status"><ShieldCheck size={34} /><h2>Your request is in.</h2><p>Your therapist will review your appointment. Check My appointments for confirmation; payment has not been collected.</p><Link className="solid" href="/appointments">View my appointments <ArrowRight size={17} /></Link></section>;
  if (!userId) return <section className="booking-details"><span className="account-eyebrow">ONE SIMPLE STEP</span><h2>Keep your appointment in one place.</h2><p>Sign in or create your account to request this session and receive updates.</p><Link className="solid" href={`/account?next=${encodeURIComponent(`/schedule/${therapist}?date=${day}&time=${time}&medium=${medium}`)}`}>Sign in / Create account <ArrowRight size={17} /></Link></section>;
  return <section className="booking-details"><span className="account-eyebrow">03 / YOUR DETAILS</span><h2>Let’s make it personal.</h2><p>Just the essentials so your therapist can arrange your session.</p>
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
