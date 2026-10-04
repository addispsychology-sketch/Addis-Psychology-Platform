'use client';

import { Suspense, useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import NextLink from 'next/link';
import { usePlatform, statusLabel } from '@/components/Platform';
import { Header, Footer, DemoNote, Photo, Modal } from '@/components/Shell';
import PrivateAudio from '@/components/PrivateAudio';
import { createVoiceRecorder } from '@/lib/voice';
import { requestCall } from '@/components/AudioCalls';
import PortalCalendar from '@/components/PortalCalendar';
import PortalSettings from '@/components/PortalSettings';
import { dateKey } from '@/lib/calendar';
import { motion } from 'framer-motion';

const CLINICAL_TEMPLATES = [
  {
    label: 'Warm Welcome',
    text: 'Hello. I have received your message and welcome you to our space. How are you holding up at this moment?',
  },
  {
    label: 'Grounding Technique',
    text: 'When overwhelm surfaces, remember the 4-7-8 breathing practice: inhale for 4 seconds, hold for 7, and exhale slowly for 8.',
  },
  {
    label: 'Session Preparation',
    text: 'I look forward to our upcoming appointment. Take a moment before we meet to write down any specific topics on your mind.',
  },
  {
    label: 'Check-in Encouragement',
    text: 'Thank you for reaching out so candidly. Acknowledging these feelings is a meaningful act of self-care.',
  },
];

function TherapistPortalInner() {
  const { t, people, loadMoreMessages, userId, ownTherapistId, conversations, activeConversation, setActiveConversation, state, messages, reply, money, date, clear, settings, updateSettings, updateAppointment } =
    usePlatform();
  const searchParams = useSearchParams();
  const linkedConversation = searchParams.get('conversation');
  const initialTherapist = Number(searchParams.get('therapist') || (people[0] ? people[0].id : 1));

  const id = ownTherapistId || initialTherapist;
  const [tab, setTab] = useState<'overview' | 'chat' | 'calendar' | 'rates' | 'profile'>(linkedConversation || searchParams.get('tab') === 'chat' ? 'chat' : 'overview');
  const [showChatInfo, setShowChatInfo] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [remoteTyping, setRemoteTyping] = useState(false);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  useEffect(() => { const c = conversations.find(c => c.id === activeConversation); setActiveConvId(c ? c.id : null); }, [activeConversation, conversations]);
  useEffect(() => {
    if (!activeConvId || !userId) return;
    const { getSupabase } = require('@/lib/supabase');
    const db = getSupabase();
    if (!db) return;
    const ch = db.channel('typing:' + activeConvId);
    ch.on('broadcast', { event: 'typing' }, (p: { payload: { u?: string } }) => {
      if (p.payload.u !== userId) {
        setRemoteTyping(true);
        clearTimeout((window as any).typingT2);
        (window as any).typingT2 = setTimeout(() => setRemoteTyping(false), 3000);
      }
    }).subscribe();
    return () => { ch.unsubscribe(); };
  }, [activeConvId, userId]);

  const notifyTyping = () => {
    if (!activeConvId || !userId) return;
    const { getSupabase } = require('@/lib/supabase');
    const db = getSupabase();
    if (db) db.channel('typing:' + activeConvId).send({ type: 'broadcast', event: 'typing', payload: { u: userId } });
  };
  const [reset, setReset] = useState(false);

  // Voice recording state for therapist
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [draftAudio, setDraftAudio] = useState('');
  const recorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const alive = useRef(true);
  const recordingPending = useRef(false);
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const person = people.find(p => p.id === ownTherapistId);
  const personSettings = settings(id);
  const appointments = state.appointments.filter(a => a.therapist === id);
  const receipts = state.receipts.filter(r => r.therapist === id);
  const thread = messages.filter(m => m.therapist === id && m.conversationId === activeConversation);
  const pendingAppointments = appointments.filter(a => a.status === 'pending');
  const todayBookings = appointments.filter(a => a.date === dateKey() && a.status !== 'cancelled');

  useEffect(() => {
    if (!linkedConversation || !conversations.some(c => c.id === linkedConversation && c.therapist_id === ownTherapistId)) return;
    setActiveConversation(linkedConversation);
  }, [linkedConversation, conversations, ownTherapistId, setActiveConversation]);

  useEffect(() => {
    if (tab === 'chat') {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [tab, thread.length]);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
      if (recorderRef.current && recorderRef.current.state === 'recording') {
        recorderRef.current.stop();
      }
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  async function startRecording() {
    if (!activeConversation || recordingPending.current || sendingRef.current || recorderRef.current?.state === 'recording') return;
    recordingPending.current = true;
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordingPending.current = false;
      if (!alive.current) { mediaStream.getTracks().forEach(t => t.stop()); return; }
      streamRef.current = mediaStream;
      const rec = createVoiceRecorder(mediaStream);
      recorderRef.current = rec;
      const chunks: BlobPart[] = [];
      rec.ondataavailable = e => {
        if (e.data.size) chunks.push(e.data);
      };
      rec.onstop = () => {
        if (timerRef.current) clearInterval(timerRef.current);
        mediaStream.getTracks().forEach(t => t.stop());
        if (!alive.current) return;
        if (chunks.length) {
          setDraftAudio(URL.createObjectURL(new Blob(chunks, { type: rec.mimeType })));
        }
        setRecording(false);
      };
      rec.start();
      setRecording(true);
      setRecordSeconds(0);
      let sec = 0;
      timerRef.current = setInterval(() => {
        sec++;
        setRecordSeconds(sec);

      }, 1000);
    } catch {
      recordingPending.current = false;
      streamRef.current?.getTracks().forEach(t => t.stop());
      alert(t('Could not access microphone.', 'ማይክሮፎን ማግኘት አልተቻለም።'));
    }
  }

  useEffect(() => { return () => { if (draftAudio) URL.revokeObjectURL(draftAudio); }; }, [draftAudio]);

  async function handleSendVoice() {
    if (!draftAudio || sendingRef.current) return;
    sendingRef.current = true; setSending(true);
    if (await reply(id, undefined, draftAudio)) setDraftAudio('');
    sendingRef.current = false; setSending(false);
  }

  async function handleSendText() {
    if (!replyText.trim() || sendingRef.current) return;
    sendingRef.current = true; setSending(true);
    if (await reply(id, replyText.trim())) setReplyText('');
    sendingRef.current = false; setSending(false);
  }

  function togglePresence(nextStatus: 'available' | 'busy' | 'offline') {
    updateSettings(id, { ...personSettings, presence: nextStatus });
  }

  const tabs: [typeof tab, string, string, number?][] = [
    ['overview', '📊', t('Overview', 'አጠቃላይ')],
    ['chat', '💬', t('Live Chat Desk', 'የቀጥታ ቻት'), thread.length],
    ['calendar', '📅', t('Calendar & Bookings', 'የቀጠሮ ሰሌዳ'), pendingAppointments.length],
    ['rates', '⚙️', t('Rates & Schedule', 'ዋጋና የሥራ ሰዓት')],
    ['profile', '👤', t('Profile & Bio', 'መገለጫና ፎቶ')],
  ];

  if (!userId || !person) {
    return (
      <>
        <Header />
        <main className="platform-main">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            style={{ maxWidth: '660px', margin: '48px auto 0' }}
          >
            <span className="eyebrow">THERAPIST PORTAL</span>
            <h1 style={{ fontSize: 'clamp(32px, 4vw, 54px)', margin: '12px 0 8px', letterSpacing: '-1.5px', lineHeight: 1.05 }}>
              {!userId ? (
                <>Your practice.<br /><span style={{ display: 'inline-block', background: 'var(--ink)', color: 'var(--paper)', padding: '0 12px' }}>Awaits.</span></>
              ) : (
                <>Almost<br />there.</>
              )}
            </h1>
            <p style={{ fontSize: '16px', maxWidth: '520px', borderTop: '3px solid var(--ink)', paddingTop: '16px', marginTop: '20px', color: 'var(--muted-text)' }}>
              {!userId
                ? 'The therapist portal is your private clinical workspace — for client conversations, appointment management, and your public practice profile.'
                : 'Your Addis account is ready. Complete your practitioner registration to unlock your full clinical workspace.'}
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: !userId ? '1fr 1fr' : '1fr', gap: '16px', marginTop: '36px' }}>
              {!userId ? (
                <>
                  <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2, duration: 0.4 }}
                    style={{ border: '4px solid var(--ink)', padding: '28px 24px', background: 'var(--ink)', color: 'var(--paper)', display: 'flex', flexDirection: 'column' }}
                  >
                    <div style={{ fontSize: '32px', marginBottom: '14px' }}>👤</div>
                    <strong style={{ display: 'block', fontFamily: 'Archivo Black, sans-serif', fontSize: '20px', marginBottom: '10px', color: 'var(--paper)' }}>Sign In</strong>
                    <p style={{ fontSize: '13px', color: '#bbb', margin: '0 0 24px', flex: 1 }}>Already a registered practitioner? Access your clinical workspace.</p>
                    <NextLink href="/account?next=/portal" className="solid" style={{ background: 'var(--paper)', color: 'var(--ink)', borderColor: 'var(--paper)', fontSize: '11px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', padding: '10px 18px' }}>Sign in →</NextLink>
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3, duration: 0.4 }}
                    style={{ border: '4px solid var(--ink)', padding: '28px 24px', display: 'flex', flexDirection: 'column' }}
                  >
                    <div style={{ fontSize: '32px', marginBottom: '14px' }}>🩺</div>
                    <strong style={{ display: 'block', fontFamily: 'Archivo Black, sans-serif', fontSize: '20px', marginBottom: '10px' }}>Join as Practitioner</strong>
                    <p style={{ fontSize: '13px', color: 'var(--muted-text)', margin: '0 0 24px', flex: 1 }}>Apply to list your practice and start receiving bookings through Addis Psychology.</p>
                    <NextLink href="/register" className="solid" style={{ fontSize: '11px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', padding: '10px 18px' }}>Apply now →</NextLink>
                  </motion.div>
                </>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.4 }}
                  style={{ border: '4px solid var(--ink)', padding: '32px 28px', background: 'var(--ink)', color: 'var(--paper)', display: 'flex', flexDirection: 'column' }}
                >
                  <div style={{ fontSize: '32px', marginBottom: '14px' }}>🩺</div>
                  <strong style={{ display: 'block', fontFamily: 'Archivo Black, sans-serif', fontSize: '24px', marginBottom: '10px', color: 'var(--paper)' }}>Register your practice</strong>
                  <p style={{ fontSize: '14px', color: '#bbb', margin: '0 0 28px', maxWidth: '480px' }}>Your Addis account is ready. Complete your practitioner profile to get listed and start receiving bookings from clients.</p>
                  <NextLink href="/register" className="solid" style={{ background: 'var(--paper)', color: 'var(--ink)', borderColor: 'var(--paper)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', padding: '12px 24px', width: 'fit-content' }}>Complete registration →</NextLink>
                </motion.div>
              )}
            </div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              style={{ marginTop: '40px', borderTop: '2px solid var(--rule-soft)', paddingTop: '20px', display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}
            >
              <span style={{ fontSize: '11px', fontFamily: 'Space Mono, monospace', color: 'var(--muted-text)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Questions?</span>
              <NextLink href="/register" style={{ fontSize: '12px', fontWeight: 700 }}>Learn about joining →</NextLink>
              <NextLink href="/therapists" style={{ fontSize: '12px' }}>Browse directory →</NextLink>
            </motion.div>
          </motion.div>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Header />
      <main className={`platform-main wide therapist-portal ${tab === 'chat' ? 'portal-chat-open' : ''}`} style={{ paddingBottom: '80px' }}>
        <DemoNote />

        {/* ── PRACTITIONER HERO BAR ── */}
        <section className="portal-hero-card">
          <div className="portal-hero-profile">
            <Photo id={id} name={person.name} src={personSettings.photo} />
            <div className="portal-hero-meta">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span className="eyebrow">{person.title}</span>
                {person.badge && <span className="admin-badge green">{person.badge}</span>}
              </div>
              <h1 style={{ fontSize: 'clamp(24px, 3.5vw, 36px)', margin: '4px 0 6px' }}>
                {person.name}
              </h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <div className="portal-presence-toggle">
                  <span style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 700 }}>
                    {t('Status:', 'ሁኔታ:')}
                  </span>
                  {(['available', 'busy', 'offline'] as const).map(st => (
                    <button
                      key={st}
                      type="button"
                      className={`presence-btn ${personSettings.presence === st ? 'active ' + st : ''}`}
                      onClick={() => togglePresence(st)}
                    >
                      <span className={`chat-avail-dot ${st === 'available' ? 'live' : ''}`} />
                      {st === 'available' ? t('Available', 'ዝግጁ') : st === 'busy' ? t('In Session', 'በቀጠሮ ላይ') : t('Offline', 'ከመስመር ውጭ')}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Practitioner Switcher & Quick Register Link */}
          <div className="portal-hero-controls">
            <label style={{ margin: 0 }}>
              <span className="eyebrow" style={{ color: 'var(--ink)' }}>
                {t('CLIENT CONVERSATION', 'የደንበኛ ውይይት')}
              </span>
              <select
                disabled={recording || sending || Boolean(draftAudio)}
                value={activeConversation}
                onChange={e => {
                  setActiveConversation(e.target.value);
                  setReplyText('');
                  setDraftAudio('');
                }}
                style={{ marginTop: '6px' }}
              >
                <option value="">Select a client conversation</option>
                {conversations.filter(c => c.therapist_id === id).map(c => <option key={c.id} value={c.id}>Client {c.client_id.slice(0, 8)}</option>)}
              </select>
            </label>

            <NextLink href="/register" className="portal-register-chip">
              <span>+ {t('Register New Practitioner', 'አዲስ ባለሙያ ይመዝገቡ')}</span>
            </NextLink>
          </div>
        </section>

        {/* ── PORTAL NAVIGATION TABS ── */}
        <nav className="portal-tabs-upgraded" aria-label={t('Portal navigation', 'የፖርታል ማውጫ')}>
          {tabs.map(([key, icon, label, badgeCount]) => (
            <button
              key={key}
              aria-pressed={tab === key}
              onClick={() => setTab(key)}
              className="portal-tab-btn"
            >
              <span>{icon}</span>
              <strong>{label}</strong>
              {badgeCount !== undefined && badgeCount > 0 && (
                <span className="portal-tab-badge">{badgeCount}</span>
              )}
            </button>
          ))}
        </nav>

        {/* ══ TAB 1: OVERVIEW ════════════════════════════════════ */}
        {tab === 'overview' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
            <div className="admin-metrics">
              <div className="admin-metric-card">
                <small>{t("Today's Appointments", 'የዛሬ ቀጠሮዎች')}</small>
                <strong>{todayBookings.length}</strong>
                <span className="trend">
                  {todayBookings.length > 0 ? t('Active schedule', 'ቀጠሮ አለዎት') : t('Clear today', 'ዛሬ ክፍት ነው')}
                </span>
              </div>
              <div className="admin-metric-card">
                <small>{t('Pending Inquiries / Bookings', 'በመጠባበቅ ላይ ያሉ')}</small>
                <strong style={{ color: pendingAppointments.length > 0 ? 'var(--danger)' : 'inherit' }}>
                  {pendingAppointments.length}
                </strong>
                <span className="trend">
                  {pendingAppointments.length > 0 ? '⚠ ' + t('Requires confirmation', 'ማረጋገጫ ይፈልጋል') : '✓ ' + t('All confirmed', 'ሁሉም የተረጋገጡ')}
                </span>
              </div>
              <div className="admin-metric-card">
                <small>{t('Live Chat Messages', 'የቻት መልዕክቶች')}</small>
                <strong>{thread.length}</strong>
                <span className="trend">
                  <NextLink href="#" onClick={e => { e.preventDefault(); setTab('chat'); }} style={{ fontSize: '11px', textDecoration: 'underline' }}>
                    {t('Open desk →', 'ቻት ክፈት →')}
                  </NextLink>
                </span>
              </div>
              <div className="admin-metric-card">
                <small>{t('Simulated Practice Revenue', 'ጠቅላላ ገቢ (ማሳያ)')}</small>
                <strong>{money(receipts.reduce((n, r) => n + r.amount, 0))}</strong>
                <span className="trend">{receipts.length} {t('package orders', 'የጥቅል ሽያጮች')}</span>
              </div>
            </div>

            {/* Quick Actions & Pending Requests */}
            {pendingAppointments.length > 0 && (
              <div className="portal-alert-card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <h3 style={{ fontSize: '18px', margin: '0 0 4px' }}>
                      ⚡ {t('Action Required: Pending Appointments', 'ትኩረት: ማረጋገጫ የሚጠብቁ ቀጠሮዎች')}
                    </h3>
                    <p style={{ margin: 0, fontSize: '13px' }}>
                      {t('You have clients waiting for booking confirmation.', 'ቀጠሮ ያቀረቡ ደንበኞች አሉ።')}
                    </p>
                  </div>
                  <button className="solid compact" onClick={() => setTab('calendar')}>
                    {t('Manage in Calendar', 'በቀጠሮ ሰሌዳው ይመልከቱ')} →
                  </button>
                </div>
              </div>
            )}

            <div className="portal-overview-grid">
              {/* Upcoming Appointments */}
              <div className="admin-chart-box">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '18px' }}>{t('Upcoming Appointments', 'መጪ ቀጠሮዎች')}</h3>
                  <button onClick={() => setTab('calendar')} style={{ fontSize: '11px', padding: '6px 10px' }}>
                    {t('Full Calendar', 'ሙሉ ሰሌዳ')}
                  </button>
                </div>

                {!appointments.some(a => a.date >= dateKey() && a.status !== 'cancelled') ? (
                  <div className="empty-state">
                    <p>{t('No appointment requests yet. New requests will appear here.', 'ቀጠሮ የለም። እንደ ደንበኛ የሙከራ ቀጠሮ ይያዙ።')}</p>
                    <NextLink className="solid compact" href={`/schedule/${id}`}>
                      {t('Simulate Client Booking', 'ቀጠሮ ይሞክሩ')}
                    </NextLink>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {appointments
                      .filter(a => a.date >= dateKey() && a.status !== 'cancelled')
                      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
                      .map(a => (
                        <div key={a.id} className="portal-appointment-row">
                          <div>
                            <strong>{a.client}</strong>{a.phone && <p><a href={`tel:${a.phone}`}>{a.phone}</a>{a.language && ` · ${a.language}`}</p>}
                            <small style={{ display: 'block', color: 'var(--muted-text)', marginTop: '2px' }}>
                              📅 {date(`${a.date}T12:00`)} · ⏰ {a.time} ({a.medium === 'online' ? '💻 Online' : '🏥 In-person'})
                            </small>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className={`admin-badge ${a.status === 'confirmed' ? 'green' : 'amber'}`}>
                              {statusLabel(a.status, t)}
                            </span>
                            {a.status === 'pending' && (
                              <small>Awaiting Addis Psychology confirmation</small>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* Chat & Package Activity */}
              <div className="admin-chart-box">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '18px' }}>{t('Client Inquiries & Chat', 'የደንበኛ ውይይቶች')}</h3>
                  <button onClick={() => setTab('chat')} className="solid compact">
                    💬 {t('Open Desk', 'ቻት ክፈት')}
                  </button>
                </div>

                {!thread.length ? (
                  <p className="muted">{t('No messages in this visit yet.', 'መልዕክት የለም።')}</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {thread.slice(-3).map(m => (
                      <div key={m.id} style={{ border: '1px solid var(--ink)', padding: '10px', background: m.from === 'therapist' ? 'var(--surface-soft)' : 'var(--paper)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontFamily: 'Space Mono, monospace' }}>
                          <strong>{m.from === 'client' ? t('Client Inquiry', 'የደንበኛ ጥያቄ') : person.name}</strong>
                          <span>{new Date(m.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <p style={{ margin: '6px 0 0', fontSize: '13px' }}>
                          {m.text || t('🎙️ Voice recording', '🎙️ የድምፅ መልዕክት')}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ marginTop: '20px', borderTop: '2px solid var(--ink)', paddingTop: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700 }}>{t('Practice Rates', 'የቀጠሮ ዋጋዎች')}</span>
                    <NextLink href="#" onClick={e => { e.preventDefault(); setTab('rates'); }} style={{ fontSize: '11px' }}>
                      {t('Adjust →', 'አስተካክል →')}
                    </NextLink>
                  </div>
                  <div style={{ display: 'flex', gap: '16px', marginTop: '6px', fontSize: '12px' }}>
                    <span>💻 Online: <strong>{money(personSettings.online)}</strong></span>
                    <span>🏥 In-Person: <strong>{money(personSettings.inperson)}</strong></span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ══ TAB 2: DEDICATED THERAPIST LIVE CHAT DESK ══════════ */}
        {tab === 'chat' && (
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className={`therapist-chat-workspace ${showChatInfo ? 'show-chat-info' : ''}`}
          >
            {/* Header / Sub-bar */}
            <div className="therapist-chat-header">
              <button type="button" onClick={() => setTab('overview')} aria-label={t('Back to portal', 'ወደ ፖርታል ተመለስ')}>←</button>
              <Photo id={id} name={person.name} />
              <div className="therapist-desk-title">
                <span className="eyebrow">{t('CONFIDENTIAL CLINICAL DESK', 'የባለሙያ ሚስጥራዊ ቻት')}</span>
                <h2>{person.name}</h2>
              </div>
              <div className="therapist-desk-actions">
                <button disabled={!activeConversation} onClick={() => requestCall(activeConversation)}>📞 Audio call</button>
                <button className="chat-info-toggle" aria-expanded={showChatInfo} onClick={() => setShowChatInfo(v => !v)}>{t('Client & tools', 'ደንበኛ እና መሳሪያዎች')}</button>
                <NextLink href={`/chat?therapist=${id}`} className="solid compact client-preview-link" style={{ textDecoration: 'none' }}>
                  👀 {t('Preview Client View', 'የደንበኛውን ገጽ እይ')} ↗
                </NextLink>
              </div>
            </div>

            {/* Split workspace: Client metadata on left, Chat stream on right */}
            <div className="therapist-chat-split">
              {/* Left Column: Client Case Info & Quick Clinical Actions */}
              <aside className="therapist-chat-client-info">
                <div className="client-info-card">
                  <div className="client-avatar-badge">
                    <span>👤</span>
                  </div>
                  <h3 style={{ fontSize: '16px', margin: '8px 0 2px' }}>
                    {t('Active Client', 'ተጠቃሚ')}
                  </h3>
                  <small style={{ color: 'var(--muted-text)', fontFamily: 'Space Mono, monospace' }}>
                    {activeConversation ? `Conversation ${activeConversation.slice(0, 8)}` : 'No client selected'}
                  </small>

                  <div style={{ margin: '14px 0', borderTop: '2px solid var(--ink)', paddingTop: '10px', fontSize: '12px' }}>
                    <p style={{ margin: '4px 0' }}>
                      💬 <strong>{thread.filter(m => m.from === 'client').length}</strong> {t('incoming notes', 'የተላኩ ማስታወሻዎች')}
                    </p>
                    <p style={{ margin: '4px 0' }}>
                      🔒 {t('Private participant-only conversation', 'በመሳሪያው ብቻ የሚቀመጥ ሚስጥር')}
                    </p>
                  </div>
                </div>

                {/* Quick Clinical Response Presets */}
                <div className="clinical-presets-box">
                  <span className="eyebrow">{t('CLINICAL PRESET RESPONSES', 'ዝግጁ የሕክምና ምላሾች')}</span>
                  <div className="presets-list">
                    {CLINICAL_TEMPLATES.map((tmpl, idx) => (
                      <button
                        key={idx}
                        type="button"
                        className="preset-btn"
                        onClick={() => setReplyText(tmpl.text)}
                      >
                        <strong>+ {tmpl.label}</strong>
                        <small>{tmpl.text.slice(0, 60)}…</small>
                      </button>
                    ))}
                  </div>
                </div>
              </aside>

              {/* Right Column: Live Conversation Thread & Practitioner Composer */}
              <div className="therapist-chat-main">
                <div className="therapist-message-stream">
                  {!thread.length ? (
                    <div className="empty-chat-desk">
                      <span style={{ fontSize: '32px' }}>💬</span>
                      <h3>{t('No messages in this thread yet.', 'እስካሁን ምንም መልዕክት የለም።')}</h3>
                      <p>
                        {t(
                          'Clients will send text or voice check-ins here. You can send a welcome note to initiate communication.',
                          'ደንበኞች መልዕክት ሲልኩ እዚህ ይደርሳል። ሰላምታ ለመላክ ከዚህ በታች መጻፍ ይችላሉ።'
                        )}
                      </p>
                    </div>
                  ) : (
                    thread.map(m => {
                      const isMe = m.from === 'therapist';
                      return (
                        <motion.article
                          key={m.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`therapist-message-bubble ${isMe ? 'from-therapist' : 'from-client'}`}
                        >
                          <div className="msg-header">
                            <strong>{isMe ? person.name : t('Client', 'ደንበኛ')}</strong>
                            <time>
                              {new Date(m.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </time>
                          </div>
                          {m.text && <p className="msg-content">{m.text}</p>}
                          {m.audio && (
                            <div className="msg-audio-wrap">
                              <PrivateAudio src={m.audio} />
                            </div>
                          )}
                        </motion.article>
                      );
                    })
                  )}
                  <button type="button" onClick={loadMoreMessages}>Load earlier messages</button>
                  {remoteTyping && <div style={{ padding: '8px 16px', color: 'var(--muted-text)', fontStyle: 'italic', fontSize: '12px', alignSelf: 'flex-start' }}>Typing...</div>}
                  <div ref={chatBottomRef} />
                </div>

                {/* Practitioner Composer */}
                <div className="therapist-composer-dock">
                  {recording ? (
                    <div className="recording-live-strip">
                      <span className="recording-pulse" />
                      <strong>
                        {t('Recording Clinical Voice Note', 'የድምፅ ማስታወሻ በመቅዳት ላይ')}: {Math.floor(recordSeconds / 60)}:{String(recordSeconds % 60).padStart(2, '0')}
                      </strong>
                      <button onClick={() => recorderRef.current?.stop()} className="solid compact">
                        {t('Done Recording', 'ጨርስ')}
                      </button>
                    </div>
                  ) : draftAudio ? (
                    <div className="audio-preview-strip">
                      <audio controls src={draftAudio} style={{ flex: 1 }} />
                      <button type="button" onClick={() => setDraftAudio('')}>
                        {t('Discard', 'ሰርዝ')}
                      </button>
                      <button type="button" className="solid" onClick={handleSendVoice}>
                        🎙️ {t('Send Voice Response', 'የድምፅ ምላሽ ላክ')}
                      </button>
                    </div>
                  ) : (
                    <form
                      onSubmit={e => {
                        e.preventDefault();
                        handleSendText();
                      }}
                      className="therapist-input-form"
                    >
                      <textarea
                        rows={2}
                        aria-label={t('Reply to client', 'ለደንበኛ ምላሽ')}
                        value={replyText}
                        onChange={e => { setReplyText(e.target.value); notifyTyping(); }}
                        placeholder={t('Type a clinical response or guidance… (Press Enter to send)', 'የሕክምና ምላሽ ይጻፉ… (ለመላክ Enter ይጫኑ)')}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendText();
                          }
                        }}
                      />
                      <div className="therapist-input-actions">
                        <button
                          type="button"
                          onClick={startRecording}
                          title={t('Record voice note', 'የድምፅ መልዕክት ቅረፅ')}
                          style={{ fontSize: '18px', padding: '0 14px' }}
                        >
                          🎙️
                        </button>
                        <button type="submit" className="solid" disabled={sending || !activeConversation || !replyText.trim()}>
                          {t('Send Reply', 'ምላሽ ላክ')} →
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </div>
            </div>
          </motion.section>
        )}

        {/* ══ TAB 3: CALENDAR & APPOINTMENTS ══════════════════════ */}
        {tab === 'calendar' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
            <PortalCalendar key={id} id={id} />
          </motion.div>
        )}

        {/* ══ TAB 4: RATES & WORKING HOURS ════════════════════════ */}
        {tab === 'rates' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
            <PortalSettings key={`rates-${id}`} id={id} />
          </motion.div>
        )}

        {/* ══ TAB 5: PUBLIC PROFILE & PHOTO ═══════════════════════ */}
        {tab === 'profile' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
            <PortalSettings key={`profile-${id}`} id={id} profile />
          </motion.div>
        )}

        {/* ── FOOTER ACTIONS & RESET MODAL ── */}
        <div className="portal-footer" style={{ marginTop: '40px' }}>
          <small>
            {t(
              'Messages are stored in Supabase. Voice notes are stored privately in Cloudflare R2.',
              'የማሳያ መረጃ በዚህ አሳሽ ይቀመጣል።'
            )}
          </small>
          <button onClick={() => setReset(true)} style={{ fontSize: '11px' }}>
            {t('Reset local preferences', 'የማሳያ መረጃ አጥፋ')}
          </button>
        </div>

        {reset && (
          <Modal title={t('Reset local preferences?', 'የዚህን አሳሽ ማሳያ ዳግም ያስጀምሩ?')} close={() => setReset(false)}>
            <p>
              {t(
                'This resets local preferences. It does not delete your cloud messages or practice.',
                'ይህ የተቀመጡ የማሳያ ቀጠሮዎችን፣ የተመዘገቡ ባለሙያዎችንና መልዕክቶችን ከዚህ አሳሽ ያስወግዳል።'
              )}
            </p>
            <button
              className="solid"
              onClick={() => {
                clear();
                setReset(false);
                setTab('overview');
              }}
            >
              {t('Reset preferences', 'ማሳያውን ዳግም ጀምር')}
            </button>
          </Modal>
        )}
      </main>
      <Footer />
    </>
  );
}

export default function PortalPage() {
  return (
    <Suspense>
      <TherapistPortalInner />
    </Suspense>
  );
}
