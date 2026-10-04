'use client';

import { getSupabase } from '@/lib/supabase';
import type { Appointment } from '@/components/Platform';
import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePlatform, statusLabel } from '@/components/Platform';
import { Header, Footer, Photo, Modal } from '@/components/Shell';
import { dateKey } from '@/lib/calendar';
import { motion } from 'framer-motion';
import AdminBroadcast from '@/components/AdminBroadcast';

type Tab = 'overview' | 'therapists' | 'clients' | 'bookings' | 'messages' | 'packages' | 'broadcast' | 'settings';

interface AdminUser {
  id: string;
  email?: string;
  name: string;
}

interface LivePractice {
  id: number;
  user_id: string;
  approved: boolean;
  profile: {
    name: string;
    title: string;
    bio?: string;
    specialties?: string[];
    languages?: string[];
    priceOnline?: number;
    priceInPerson?: number;
  };
  settings: {
    online?: number;
    inperson?: number;
    presence?: 'available' | 'busy' | 'offline';
    photo?: string;
  };
  application?: {
    email?: string;
    phone?: string;
    license?: string;
  } | null;
}

interface LivePayment {
  id: string;
  user_id: string;
  kind: string;
  principal_cents: number;
  fee_cents?: number;
  method: string;
  reference: string;
  proof_path?: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

export default function AdminPortal() {
  const { t, people, state, messages, money, date, settings, deleteTherapist } = usePlatform();
  const [passphrase, setPassphrase] = useState('');
  const [authInput, setAuthInput] = useState('');
  const [authError, setAuthError] = useState('');
  const [tab, setTab] = useState<Tab>('overview');

  // Live admin data from /api/admin
  const [liveUsers, setLiveUsers] = useState<AdminUser[]>([]);
  const [livePractices, setLivePractices] = useState<LivePractice[]>([]);
  const [livePayments, setLivePayments] = useState<LivePayment[]>([]);
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [paymentSearch, setPaymentSearch] = useState('');
  const [receiptUrl, setReceiptUrl] = useState('');
  const [verifiedPayments, setVerifiedPayments] = useState<Record<string, boolean>>({});
  const [adminNotice, setAdminNotice] = useState('');
  const [busyAction, setBusyAction] = useState(false);

  // Default passphrase for demonstration. Set NEXT_PUBLIC_ADMIN_PASSPHRASE env var in production.
  const [auth, setAuth] = useState(false);
  const [bookings, setBookings] = useState<Appointment[]>([]);
  async function adminRequest(init: RequestInit = {}, secret = passphrase, path = '/api/admin') {
    const token = (await getSupabase()?.auth.getSession())?.data.session?.access_token;
    return fetch(path, { ...init, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(secret ? { 'x-admin-passphrase': secret } : {}), ...init.headers } });
  }
  function readBookings(rows: Record<string, unknown>[]) {
    return rows.map(a => { const local = new Date(Date.parse(String(a.starts_at)) + 10800000).toISOString(); return { id: String(a.id), therapist: Number(a.therapist_id), date: local.slice(0,10), time: local.slice(11,16), medium: a.medium, status: a.status, price: a.price, client: a.client_name, phone: a.phone, language: a.language } as Appointment; });
  }
  async function signInAdmin(secret = '') {
    setAuthError('');
    try {
      const response = await adminRequest({}, secret);
      const data = await response.json();
      if(!response.ok) throw new Error(data.error || 'Administrator access required.');
      setLiveUsers(data.users || []);
      setLivePractices(data.practices || []);
      setLivePayments(data.payments || []);
      setBookings(readBookings(data.appointments || []));
      setPassphrase(secret);
      setAuth(true);
    } catch(error) {
      setAuthError(error instanceof Error ? error.message : 'Please try again.');
    }
  }
  async function handleReviewPayment(id: string, approve: boolean) {
    setBusyAction(true);
    setAdminNotice('');
    try {
      const response = await adminRequest({
        method: 'POST',
        body: JSON.stringify({ action: 'payment', id, verified: verifiedPayments[id] === true, approve })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to review payment.');
      setLivePayments(current => current.map(p => p.id === id ? { ...p, status: approve ? 'approved' : 'rejected' } : p));
      setAdminNotice(approve ? 'Payment request approved and wallet/credits credited to client!' : 'Payment request marked as rejected.');
    } catch (error) {
      setAdminNotice(error instanceof Error ? error.message : 'Could not review payment.');
    } finally {
      setBusyAction(false);
    }
  }
  async function handleApprovePractice(id: number, approve: boolean) {
    setBusyAction(true);
    setAdminNotice('');
    try {
      const response = await adminRequest({
        method: 'POST',
        body: JSON.stringify({ action: 'practice', id, approved: approve })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to update practitioner status.');
      setLivePractices(current => current.map(p => p.id === id ? { ...p, approved: approve } : p));
      setAdminNotice(approve ? 'Practitioner approved and published to the public directory!' : 'Practitioner unapproved and hidden from public directory.');
    } catch (error) {
      setAdminNotice(error instanceof Error ? error.message : 'Could not update practitioner.');
    } finally {
      setBusyAction(false);
    }
  }
  async function updateAppointment(id: string, patch: Partial<Appointment>) {
    setBusyAction(true); setAdminNotice('');
    try { const response = await adminRequest({ method: 'POST', body: JSON.stringify({action:'booking',id,status:patch.status}) }); const result = await response.json(); if(!response.ok) throw new Error(result.error); setBookings(rows => rows.map(a => a.id === id ? {...a,...patch} : a)); setAdminNotice('Booking updated. The client can see the new status.'); }
    catch(error) { setAdminNotice(error instanceof Error ? error.message : 'Could not update booking.'); }
    finally { setBusyAction(false); }
  }

  // Booking filters & search
  const [bookingFilter, setBookingFilter] = useState<'all' | 'pending' | 'confirmed' | 'cancelled' | 'completed'>('all');
  const [bookingSearch, setBookingSearch] = useState('');
  const [therapistSearch, setTherapistSearch] = useState('');
  const [clientSearch, setClientSearch] = useState('');

  async function handleDeleteAccount(userId: string, label: string, isTherapist = false, therapistId?: number) {
    if (!confirm(t(
      `Permanently delete account for "${label}"? This will remove all their credentials and platform data. This action is irreversible.`,
      `"${label}" መለያ በቋሚነት ይሰረዝ? ይህ እርምጃ ሊመለስ አይችልም።`
    ))) {
      return;
    }

    setBusyAction(true);
    setAdminNotice('');
    try {
      const res = await adminRequest({ method: 'POST', body: JSON.stringify({ action: 'delete', id: userId, confirmation: 'DELETE' }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Account could not be deleted.');
      if (isTherapist && therapistId) deleteTherapist(therapistId);
      setLiveUsers(prev => prev.filter(u => u.id !== userId));
      setAdminNotice('Account successfully deleted.');
    } catch (error) {
      setAdminNotice(error instanceof Error ? error.message : 'Could not delete account.');
    } finally {
      setBusyAction(false);
    }
  }

  if (!auth) {
    return (
      <>
        <Header />
        <main className="platform-main">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            style={{ maxWidth: '640px', margin: '60px auto 0' }}
          >
            <span className="eyebrow">PLATFORM GOVERNANCE</span>
            <h1 style={{ fontSize: 'clamp(32px, 4vw, 54px)', margin: '12px 0 8px', letterSpacing: '-1.5px', lineHeight: 1.05 }}>
              Admin Console.<br />
              <span style={{ display: 'inline-block', background: 'var(--ink)', color: 'var(--paper)', padding: '0 12px' }}>
                Restricted.
              </span>
            </h1>
            <p style={{ fontSize: '16px', maxWidth: '520px', borderTop: '3px solid var(--ink)', paddingTop: '16px', marginTop: '20px', color: 'var(--muted-text)' }}>
              {t(
                'This console is reserved for platform administrators to review practitioner applications, supervise schedules, and maintain clinical compliance.',
                'ይህ ክፍል ለአስተዳዳሪዎች ብቻ የተከለለ ነው። የተመዘገቡ ባለሙያዎችን ለመከታተልና ቀጠሮዎችን ለማስተዳደር ይግቡ።'
              )}
            </p>

            {/* Admin sign-in card */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.4 }}
              style={{ border: '4px solid var(--ink)', padding: '32px', background: 'var(--ink)', color: 'var(--paper)', marginTop: '32px' }}
            >
              <div style={{ fontSize: '36px', marginBottom: '16px' }}>🛡️</div>
              <strong style={{ display: 'block', fontFamily: 'Archivo Black, sans-serif', fontSize: '22px', marginBottom: '12px', color: 'var(--paper)' }}>
                Admin Access
              </strong>
              <p style={{ fontSize: '14px', color: '#bbb', margin: '0 0 24px' }}>
                Enter your administrator passphrase to access the management console.
              </p>
              <button className="solid" onClick={() => void signInAdmin()}>Continue with my authorized account →</button><p><Link href="/account?next=/admin">Sign in through Telegram first</Link></p><form onSubmit={e => {
                e.preventDefault();
                void signInAdmin(authInput);
              }}>
                <input
                  type="password"
                  placeholder="Administrator passphrase"
                  value={authInput}
                  onChange={e => setAuthInput(e.target.value)}
                  style={{ background: 'rgba(255,255,255,0.1)', borderColor: 'rgba(255,255,255,0.3)', color: 'var(--paper)', marginBottom: '12px' }}
                  autoComplete="current-password"
                />
                {authError && <p style={{ color: '#ff6b6b', fontSize: '13px', margin: '0 0 12px' }}>⚠ {authError}</p>}
                <button type="submit" style={{ background: 'var(--paper)', color: 'var(--ink)', borderColor: 'var(--paper)', fontWeight: 700, width: '100%', padding: '14px' }}>
                  Enter Admin Console →
                </button>
              </form>
            </motion.div>

            <div style={{ marginTop: '32px', display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
              <Link href="/portal" style={{ fontSize: '12px', fontWeight: 700 }}>Therapist portal →</Link>
              <Link href="/therapists" style={{ fontSize: '12px' }}>Browse therapists →</Link>
              <Link href="/register" style={{ fontSize: '12px' }}>Join practice →</Link>
            </div>
          </motion.div>
        </main>
        <Footer />
      </>
    );
  }

  // ── Computed stats ───────────────────────────────────────────
  const today = dateKey();
  const totalBookings = bookings.length;
  const todayBookings = bookings.filter(a => a.date === today && a.status !== 'cancelled').length;
  const totalRevenue = state.receipts.reduce((n, r) => n + r.amount, 0);
  const pendingAppts = bookings.filter(a => a.status === 'pending');
  const allMessages = messages;
  const pendingPracticesCount = livePractices.filter(p => !p.approved).length;

  const pendingPaymentsCount = livePayments.filter(p => p.status === 'pending').length;

  const tabs: [Tab, string, number?][] = [
    ['overview', t('Overview', 'አጠቃላይ')],
    ['therapists', t('Therapists & Applicants', 'ባለሙያዎችና ማመልከቻዎች'), pendingPracticesCount || undefined],
    ['clients', t('Client Accounts', 'የደንበኛ መለያዎች'), liveUsers.length || undefined],
    ['bookings', t('Bookings', 'ቀጠሮዎች'), pendingAppts.length],
    ['messages', t('Messages', 'መልዕክቶች'), allMessages.length],
    ['packages', t('Package sales', 'ጥቅሎች'), pendingPaymentsCount || undefined],
    ['broadcast', t('Channel Broadcast', 'Channel Broadcast')],
    ['settings', t('Settings', 'ቅንብሮች')],
  ];

  const navIcons: Record<Tab, string> = {
    overview: '📊',
    therapists: '👥',
    clients: '👤',
    bookings: '📅',
    messages: '💬',
    packages: '🛍️',
    broadcast: '📢',
    settings: '⚙️',
  };

  // ── Bar chart helper ─────────────────────────────────────────
  const therapistBookingCounts = people.map(p => ({
    id: p.id,
    name: p.name.split(' ')[0],
    count: bookings.filter(a => a.therapist === p.id && a.status !== 'cancelled').length,
  }));
  const maxCount = Math.max(1, ...therapistBookingCounts.map(x => x.count));

  const packageRevByTherapist = people.map(p => ({
    id: p.id,
    name: p.name.split(' ')[0],
    amount: state.receipts.filter(r => r.therapist === p.id).reduce((n, r) => n + r.amount, 0),
  }));
  const maxRev = Math.max(1, ...packageRevByTherapist.map(x => x.amount));

  // Filtered bookings
  const filteredBookings = bookings
    .filter(a => (bookingFilter === 'all' ? true : a.status === bookingFilter))
    .filter(a => {
      if (!bookingSearch.trim()) return true;
      const term = bookingSearch.toLowerCase();
      const clientMatch = a.client.toLowerCase().includes(term);
      const therapistName = people.find(p => p.id === a.therapist)?.name.toLowerCase() || '';
      return clientMatch || therapistName.includes(term);
    })
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

  return (
    <>
      <Header />
      <div className="admin-layout">
        {/* ── SIDEBAR ── */}
        <aside className="admin-sidebar">
          <div className="admin-sidebar-brand">
            <span>{t('MANAGEMENT CONSOLE', 'አስተዳደር')}</span>
            <h2>{t('Admin Portal', 'አስተዳዳሪ')}</h2>
          </div>
          <ul className="admin-nav">
            {tabs.map(([key, label, count]) => (
              <li key={key}>
                <button className={tab === key ? 'active' : ''} onClick={() => { setTab(key); setAdminNotice(''); }}>
                  <span className="nav-icon">{navIcons[key]}</span>
                  <span style={{ flex: 1, textAlign: 'left' }}>{label}</span>
                  {count !== undefined && count > 0 && (
                    <span className="portal-tab-badge" style={{ marginLeft: 'auto' }}>
                      {count}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
          <div className="admin-sidebar-footer">
            <small>{t('Admin Console · Addis Psychology', 'ፕላትፎርም አስተዳደር')}</small>
            <br />
            <button
              style={{ marginTop: '8px', fontSize: '10px', color: 'var(--danger)', borderColor: 'var(--danger)' }}
              onClick={() => { setPassphrase(''); setAuth(false); }}
            >
              {t('Sign out', 'ውጣ')}
            </button>
          </div>
        </aside>

        {/* ── MAIN CONTENT ── */}
        <main className="admin-content">
          {adminNotice && (
            <div style={{ padding: '14px 20px', background: 'var(--ink)', color: 'var(--paper)', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>✓ {adminNotice}</span>
              <button style={{ color: 'var(--paper)', border: 'none', background: 'none', padding: 0 }} onClick={() => setAdminNotice('')}>✕</button>
            </div>
          )}

          {/* Mobile tab switcher */}
          <div className="admin-mobile-tabs">
            {tabs.map(([key, label, count]) => (
              <button
                key={key}
                aria-pressed={tab === key}
                onClick={() => { setTab(key); setAdminNotice(''); }}
                style={{ fontSize: '11px', padding: '7px 10px' }}
              >
                {navIcons[key]} {label} {count !== undefined && count > 0 ? `(${count})` : ''}
              </button>
            ))}
          </div>

          {/* ══ OVERVIEW ══════════════════════════════════════════ */}
          {tab === 'overview' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <span className="eyebrow">{t('DASHBOARD OVERVIEW', 'ዳሽቦርድ')}</span>
              <h1>{t('Platform at a glance.', 'አጠቃላይ እይታ።')}</h1>

              <div className="admin-metrics" style={{ marginTop: '20px' }}>
                <div className="admin-metric-card">
                  <small>{t('Total bookings', 'ጠቅላላ ቀጠሮዎች')}</small>
                  <strong>{totalBookings}</strong>
                  <span className="trend">Across {people.length} practitioners</span>
                </div>
                <div className="admin-metric-card">
                  <small>{t("Today's sessions", 'የዛሬ ቀጠሮዎች')}</small>
                  <strong>{todayBookings}</strong>
                  <span className="trend">{todayBookings > 0 ? 'Active schedule' : 'Clear today'}</span>
                </div>
                <div className="admin-metric-card">
                  <small>{t('Package revenue', 'ጥቅል ሽያጭ')}</small>
                  <strong>{money(totalRevenue)}</strong>
                  <span className="trend">{state.receipts.length} orders processed</span>
                </div>
                <div className="admin-metric-card">
                  <small>{t('Pending approvals', 'በቀጠሮ ጠያቂዎች')}</small>
                  <strong style={{ color: pendingAppts.length > 0 ? 'var(--danger)' : 'inherit' }}>
                    {pendingAppts.length}
                  </strong>
                  <span className="trend">
                    {pendingAppts.length > 0 ? '⚠ ' + t('needs attention', 'ትኩረት ያስፈልጋቸዋል') : '✓ ' + t('all clear', 'ሁሉም ጥሩ ነው')}
                  </span>
                </div>
              </div>

              {/* Quick actions */}
              <div className="admin-section" style={{ margin: '28px 0' }}>
                <div className="admin-section-header">
                  <h2>{t('Quick Actions', 'ፈጣን ድርጊቶች')}</h2>
                </div>
                <div className="admin-quick-actions">
                  <button onClick={() => setTab('therapists')}>
                    <strong>👥</strong>
                    {t('Manage Therapists & Applicants', 'ባለሙያዎች')}
                  </button>
                  <button onClick={() => setTab('clients')}>
                    <strong>👤</strong>
                    {t('Manage Client Accounts', 'ደንበኛ መለያዎች')}
                  </button>
                  <button onClick={() => setTab('bookings')}>
                    <strong>📅</strong>
                    {t('Review Pending Bookings', 'ቀጠሮዎች')}
                  </button>
                  <button onClick={() => setTab('messages')}>
                    <strong>💬</strong>
                    {t('Inspect Live Messages', 'መልዕክቶች')}
                  </button>
                  <Link href="/register" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '14px 18px', border: '2px solid var(--ink)', textDecoration: 'none', background: 'var(--ink)', color: 'var(--paper)' }}>
                    <strong>➕</strong>
                    <span>{t('Register New Therapist', 'አዲስ ባለሙያ ምዝገባ')}</span>
                  </Link>
                </div>
              </div>

              {/* Charts */}
              <div className="admin-chart-row">
                <div className="admin-chart-box">
                  <h3>{t('Bookings by therapist', 'ቀጠሮዎች በባለሙያ')}</h3>
                  <div className="admin-bar-chart">
                    {therapistBookingCounts.map(({ id: therapistId, name, count }) => (
                      <div key={therapistId} className="admin-bar-wrap">
                        <div
                          className="admin-bar"
                          style={{
                            height: `${(count / maxCount) * 100}%`,
                            minHeight: count > 0 ? '8px' : '2px',
                            background: count > 0 ? 'var(--ink)' : 'var(--rule-soft)',
                          }}
                        />
                        <div className="admin-bar-label">
                          {name}
                          <br />
                          {count}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="admin-chart-box">
                  <h3>{t('Package revenue by therapist', 'ጥቅሎች በባለሙያ')}</h3>
                  <div className="admin-bar-chart">
                    {packageRevByTherapist.map(({ id: therapistId, name, amount }) => (
                      <div key={therapistId} className="admin-bar-wrap">
                        <div
                          className="admin-bar"
                          style={{
                            height: `${(amount / maxRev) * 100}%`,
                            minHeight: amount > 0 ? '8px' : '2px',
                            background: amount > 0 ? 'var(--ink)' : 'var(--rule-soft)',
                          }}
                        />
                        <div className="admin-bar-label">
                          {name}
                          <br />
                          {amount > 0 ? money(amount) : '—'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ══ THERAPISTS & APPLICANTS ════════════════════════════ */}
          {tab === 'therapists' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h1>{t('Practitioners & Applications', 'ባለሙያዎችና ማመልከቻዎች')}</h1>
                  <p className="muted" style={{ margin: '4px 0 0' }}>
                    {t(
                      'Manage practicing clinicians and review new therapist registrations submitted from the join form.',
                      'የባለሙያዎችን ዝርዝርና አዳዲስ ማመልከቻዎችን ይቆጣጠሩ።'
                    )}
                  </p>
                </div>
                <Link href="/register" className="solid compact" style={{ textDecoration: 'none' }}>
                  + {t('Add Practitioner Application', 'አዲስ ባለሙያ ጨምር')}
                </Link>
              </div>

              {/* Search filter */}
              <div style={{ margin: '20px 0 10px', maxWidth: '420px' }}>
                <input
                  type="search"
                  placeholder={t('Search practitioner by name or title…', 'በስም ወይም በማዕረግ ፈልግ…')}
                  value={therapistSearch}
                  onChange={e => setTherapistSearch(e.target.value)}
                />
              </div>

              <div className="admin-section">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>{t('Practitioner', 'ባለሙያ')}</th>
                      <th>{t('Approval Status', 'የማረጋገጫ ሁኔታ')}</th>
                      <th>{t('Presence', 'ሁኔታ')}</th>
                      <th>{t('Online / In-Person', 'ዋጋ')}</th>
                      <th>{t('Bookings', 'ቀጠሮዎች')}</th>
                      <th>{t('Actions', 'ድርጊቶች')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(livePractices.length > 0
                      ? livePractices.map(lp => ({
                          id: lp.id,
                          user_id: lp.user_id,
                          name: lp.profile?.name || 'Practitioner',
                          title: lp.profile?.title || 'Therapist',
                          photo: lp.settings?.photo || '',
                          online: lp.settings?.online || lp.profile?.priceOnline || 1100,
                          inperson: lp.settings?.inperson || lp.profile?.priceInPerson || 1500,
                          presence: lp.settings?.presence || 'offline',
                          approved: lp.approved,
                          application: lp.application,
                        }))
                      : people.map(p => ({
                          id: p.id,
                          user_id: String(p.id),
                          name: p.name,
                          title: p.title,
                          photo: settings(p.id).photo,
                          online: settings(p.id).online,
                          inperson: settings(p.id).inperson,
                          presence: settings(p.id).presence,
                          approved: !state.registeredTherapists?.some(r => r.id === p.id),
                          application: null as { email?: string; phone?: string; license?: string } | null,
                        }))
                    )
                      .filter(p =>
                        p.name.toLowerCase().includes(therapistSearch.toLowerCase()) ||
                        p.title.toLowerCase().includes(therapistSearch.toLowerCase()) ||
                        (p.application?.email || '').toLowerCase().includes(therapistSearch.toLowerCase()) ||
                        (p.application?.phone || '').includes(therapistSearch)
                      )
                      .map(p => {
                        const bCount = bookings.filter(
                          a => a.therapist === p.id && a.status !== 'cancelled'
                        ).length;

                        return (
                          <tr key={p.id}>
                            <td data-label={t('Practitioner', 'ባለሙያ')}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <Photo id={p.id} name={p.name} src={p.photo} />
                                <div>
                                  <strong>{p.name}</strong>
                                  <small style={{ display: 'block', color: 'var(--muted-text)' }}>{p.title}</small>
                                  {p.application && (
                                    <div style={{ fontSize: '11px', color: 'var(--muted-text)', marginTop: '2px', fontFamily: 'Space Mono, monospace' }}>
                                      {p.application.email && <span>✉ {p.application.email} </span>}
                                      {p.application.phone && <span>· ☎ {p.application.phone}</span>}
                                      {p.application.license && <span style={{ display: 'block' }}>Lic: {p.application.license}</span>}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td data-label={t('Approval Status', 'የማረጋገጫ ሁኔታ')}>
                              {p.approved ? (
                                <span className="admin-badge green">
                                  ✓ {t('Approved & Live', 'የጸደቀ')}
                                </span>
                              ) : (
                                <span className="admin-badge amber">
                                  ⏳ {t('Pending Review', 'በመጠባበቅ ላይ')}
                                </span>
                              )}
                            </td>
                            <td data-label={t('Presence', 'ሁኔታ')}>
                              <span
                                className={`admin-badge ${
                                  p.presence === 'available' ? 'green' : p.presence === 'busy' ? 'amber' : 'grey'
                                }`}
                              >
                                {p.presence}
                              </span>
                            </td>
                            <td data-label={t('Online / In-Person', 'ዋጋ')}>
                              {money(p.online)} / {money(p.inperson)}
                            </td>
                            <td data-label={t('Bookings', 'ቀጠሮዎች')}>
                              <strong>{bCount}</strong>
                            </td>
                            <td data-label={t('Actions', 'ድርጊቶች')}>
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                                {!p.approved ? (
                                  <button
                                    className="solid"
                                    disabled={busyAction}
                                    onClick={() => void handleApprovePractice(p.id, true)}
                                    style={{ fontSize: '11px', padding: '6px 12px', background: '#2e7d32', borderColor: '#2e7d32' }}
                                  >
                                    ✓ {t('Approve Practice', 'አጽድቅ')}
                                  </button>
                                ) : (
                                  <button
                                    disabled={busyAction}
                                    onClick={() => void handleApprovePractice(p.id, false)}
                                    style={{ fontSize: '10px', padding: '4px 8px', color: 'var(--ink)', borderColor: 'var(--ink)' }}
                                  >
                                    {t('Unapprove / Hide', 'ሰርዝ')}
                                  </button>
                                )}
                                <Link
                                  href={`/portal?therapist=${p.id}`}
                                  style={{ fontSize: '11px', fontWeight: 700 }}
                                >
                                  {t('Portal →', 'ፖርታል →')}
                                </Link>
                                <Link
                                  href={`/chat?therapist=${p.id}`}
                                  style={{ fontSize: '11px' }}
                                >
                                  {t('Chat →', 'ቻት →')}
                                </Link>
                                <button
                                  disabled={busyAction}
                                  onClick={() => handleDeleteAccount(p.user_id, p.name, true, p.id)}
                                  style={{ fontSize: '10px', padding: '3px 8px', color: 'var(--danger)', borderColor: 'var(--danger)' }}
                                  title={t('Permanently remove therapist account', 'የባለሙያ መለያ ሰርዝ')}
                                >
                                  🗑 {t('Delete', 'ሰርዝ')}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {/* ══ CLIENT ACCOUNTS ════════════════════════════════════ */}
          {tab === 'clients' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h1>{t('Client Accounts', 'የደንበኛ መለያዎች')}</h1>
                  <p className="muted" style={{ margin: '4px 0 0' }}>
                    {t(
                      'Manage registered client accounts. Deleting an account removes access permanently.',
                      'የተመዘገቡ ደንበኞችን ያስተዳድሩ። መለያ መሰረዝ ዘላቂ ነው።'
                    )}
                  </p>
                </div>
              </div>

              {/* Search clients */}
              <div style={{ margin: '20px 0 10px', maxWidth: '420px' }}>
                <input
                  type="search"
                  placeholder={t('Search client by name or ID…', 'በስም ወይም በመለያ ቁጥር ፈልግ…')}
                  value={clientSearch}
                  onChange={e => setClientSearch(e.target.value)}
                />
              </div>

              <div className="admin-section" style={{ marginTop: '20px' }}>
                {(() => {
                  // Merge live users from Supabase Auth + local appointment clients
                  const localClientIds = Array.from(
                    new Set(bookings.map(a => a.client).filter(c => c && c !== 'demo-client'))
                  );

                  type DisplayClient = { id: string; name: string; email?: string; bookingCount: number };
                  const map = new Map<string, DisplayClient>();

                  // Add live users from auth
                  liveUsers.forEach(u => {
                    const count = bookings.filter(a => a.client === u.id).length;
                    map.set(u.id, { id: u.id, name: u.name, email: u.email, bookingCount: count });
                  });

                  // Add local clients with bookings if not already present
                  localClientIds.forEach(id => {
                    if (!map.has(id)) {
                      const count = bookings.filter(a => a.client === id).length;
                      map.set(id, { id, name: id.slice(0, 16) + '…', bookingCount: count });
                    }
                  });

                  // If still empty (e.g. fresh installation), show sample demo client
                  if (map.size === 0) {
                    map.set('client-sample-1', { id: 'client-sample-1', name: 'Almaz Tadesse', email: 'almaz.client@example.et', bookingCount: 2 });
                    map.set('client-sample-2', { id: 'client-sample-2', name: 'Yared Bekele', email: 'yared.b@example.et', bookingCount: 1 });
                  }

                  const clientsList = Array.from(map.values()).filter(c =>
                    c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
                    (c.email || '').toLowerCase().includes(clientSearch.toLowerCase()) ||
                    c.id.toLowerCase().includes(clientSearch.toLowerCase())
                  );

                  return clientsList.length === 0 ? (
                    <div className="empty-state">
                      <p>{t('No client accounts found.', 'ምንም ደንበኛ አልተገኘም።')}</p>
                    </div>
                  ) : (
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>{t('Client', 'ደንበኛ')}</th>
                          <th>{t('Email / Identifier', 'ኢሜይል / መለያ')}</th>
                          <th>{t('Bookings', 'ቀጠሮዎች')}</th>
                          <th>{t('Actions', 'ድርጊቶች')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {clientsList.map(c => (
                          <tr key={c.id}>
                            <td data-label={t('Client', 'ደንበኛ')}>
                              <strong>{c.name}</strong>
                            </td>
                            <td data-label={t('Email / Identifier', 'ኢሜይል')}>
                              <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '12px' }}>
                                {c.email || c.id}
                              </span>
                            </td>
                            <td data-label={t('Bookings', 'ቀጠሮዎች')}>
                              <span className="admin-badge grey">{c.bookingCount}</span>
                            </td>
                            <td data-label={t('Actions', 'ድርጊቶች')}>
                              <button
                                disabled={busyAction}
                                onClick={() => handleDeleteAccount(c.id, c.name || c.email || c.id)}
                                style={{
                                  fontSize: '11px',
                                  padding: '5px 12px',
                                  color: 'var(--danger)',
                                  borderColor: 'var(--danger)',
                                  background: 'transparent',
                                }}
                              >
                                🗑 {t('Delete Account', 'መለያ ሰርዝ')}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  );
                })()}
              </div>
            </motion.div>
          )}

          {/* ══ BOOKINGS MANAGEMENT ════════════════════════════════ */}
          {tab === 'bookings' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h1>{t('Bookings & Scheduling Desk', 'የቀጠሮዎች አስተዳደር')}</h1>
                  <p className="muted" style={{ margin: '4px 0 0' }}>
                    {t('Confirm, complete, or reschedule client appointments.', 'የደንበኞችን ቀጠሮዎች ያረጋግጡ ወይም ያስተካክሉ።')}
                  </p>
                </div>
              </div>

              {/* Filters & Search Bar */}
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', margin: '20px 0' }}>
                <div className="segmented">
                  {(['all', 'pending', 'confirmed', 'completed', 'cancelled'] as const).map(st => (
                    <button
                      key={st}
                      type="button"
                      aria-pressed={bookingFilter === st}
                      onClick={() => setBookingFilter(st)}
                      style={{ fontSize: '11px', textTransform: 'capitalize' }}
                    >
                      {st === 'all' ? t('All Bookings', 'ሁሉም') : statusLabel(st as 'pending' | 'confirmed' | 'cancelled' | 'completed', t) || st}
                    </button>
                  ))}
                </div>

                <div style={{ flex: 1, minWidth: '220px' }}>
                  <input
                    type="search"
                    placeholder={t('Search by client or therapist name…', 'በደንበኛ ወይም በባለሙያ ስም ፈልግ…')}
                    value={bookingSearch}
                    onChange={e => setBookingSearch(e.target.value)}
                    style={{ margin: 0, padding: '8px 12px', fontSize: '12px' }}
                  />
                </div>
              </div>

              {!filteredBookings.length ? (
                <div className="empty-state">
                  <p>{t('No bookings matching this filter.', 'ምንም ቀጠሮ አልተገኘም።')}</p>
                  <button onClick={() => { setBookingFilter('all'); setBookingSearch(''); }}>
                    {t('Clear Filters', 'ማጣሪያ አጥፋ')}
                  </button>
                </div>
              ) : (
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>{t('Client', 'ደንበኛ')}</th>
                      <th>{t('Therapist', 'ባለሙያ')}</th>
                      <th>{t('Date & Time', 'ቀንና ሰዓት')}</th>
                      <th>{t('Medium', 'ዓይነት')}</th>
                      <th>{t('Price', 'ዋጋ')}</th>
                      <th>{t('Status', 'ሁኔታ')}</th>
                      <th>{t('Actions', 'ድርጊት')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBookings.map(a => (
                      <tr key={a.id}>
                        <td data-label={t('Client', 'ደንበኛ')}>
                          <strong>{a.client === 'demo-client' ? t('Demo Client', 'ደንበኛ') : a.client}</strong>
                        </td>
                        <td data-label={t('Therapist', 'ባለሙያ')}>{people.find(p => p.id === a.therapist)?.name}</td>
                        <td data-label={t('Date & Time', 'ቀንና ሰዓት')}>
                          {date(`${a.date}T12:00`)} · {a.time}
                        </td>
                        <td data-label={t('Medium', 'ዓይነት')}>{a.medium === 'online' ? '💻 Online' : '🏥 In-person'}</td>
                        <td data-label={t('Price', 'ዋጋ')}>{money(a.price)}</td>
                        <td data-label={t('Status', 'ሁኔታ')}>
                          <span
                            className={`admin-badge ${
                              a.status === 'confirmed'
                                ? 'green'
                                : a.status === 'pending'
                                ? 'amber'
                                : a.status === 'cancelled'
                                ? 'grey'
                                : 'green'
                            }`}
                          >
                            {statusLabel(a.status, t)}
                          </span>
                        </td>
                        <td data-label={t('Actions', 'ድርጊት')}>
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            {a.status === 'pending' && (
                              <button
                                style={{ fontSize: '10px', padding: '4px 8px' }}
                                onClick={() => updateAppointment(a.id, { status: 'confirmed' })}
                              >
                                ✓ {t('Confirm', 'አረጋግጥ')}
                              </button>
                            )}
                            {a.status === 'confirmed' && (
                              <button
                                style={{ fontSize: '10px', padding: '4px 8px' }}
                                onClick={() => updateAppointment(a.id, { status: 'completed' })}
                              >
                                {t('Mark Done', 'ጨርስ')}
                              </button>
                            )}
                            {a.status !== 'cancelled' && a.status !== 'completed' && (
                              <button
                                style={{ fontSize: '10px', padding: '4px 8px', color: 'var(--danger)', borderColor: 'var(--danger)' }}
                                onClick={() => updateAppointment(a.id, { status: 'cancelled' })}
                              >
                                {t('Cancel', 'ሰርዝ')}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </motion.div>
          )}

          {/* ══ MESSAGES ══════════════════════════════════════════ */}
          {tab === 'messages' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h1>{t('All Messages & Transcripts', 'ሁሉም መልዕክቶች')}</h1>
                  <p className="muted" style={{ margin: '4px 0 0' }}>
                    {t('Live confidential communication stream between clients and practitioners.', 'የቀጥታ ውይይቶች መዝገብ።')}
                  </p>
                </div>
                <Link href="/chat" className="solid compact" style={{ textDecoration: 'none' }}>
                  💬 {t('Open Messenger View', 'የቻት ገጽ ክፈት')}
                </Link>
              </div>

              {!allMessages.length ? (
                <div className="empty-state">
                  <p>{t('No messages yet.', 'መልዕክቶች የሉም።')}</p>
                </div>
              ) : (
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>{t('Sender', 'ላኪ')}</th>
                      <th>{t('Therapist', 'ባለሙያ')}</th>
                      <th>{t('Content', 'ይዘት')}</th>
                      <th>{t('Timestamp', 'ሰዓት')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allMessages.map(m => (
                      <tr key={m.id}>
                        <td data-label={t('Sender', 'ላኪ')}>
                          <span className={`admin-badge ${m.from === 'client' ? 'amber' : 'green'}`}>
                            {m.from === 'client' ? t('Client', 'ደንበኛ') : t('Therapist', 'ባለሙያ')}
                          </span>
                        </td>
                        <td data-label={t('Therapist', 'ባለሙያ')}>{people.find(p => p.id === m.therapist)?.name}</td>
                        <td data-label={t('Content', 'ይዘት')} style={{ maxWidth: '340px' }}>
                          {m.text ? (
                            <p style={{ margin: 0, fontSize: '13px' }}>{m.text}</p>
                          ) : (
                            <span>🎙️ {t('Audio recording', 'ድምፅ ቅጂ')}</span>
                          )}
                        </td>
                        <td data-label={t('Timestamp', 'ሰዓት')} style={{ whiteSpace: 'nowrap', fontSize: '11px', fontFamily: 'Space Mono, monospace' }}>
                          {new Date(m.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </motion.div>
          )}

          {/* ══ PACKAGES ══════════════════════════════════════════ */}
          {tab === 'packages' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <h1>{t('Package Sales & Payment Approvals', 'የጥቅሎች ሽያጭና ክፍያ ማጽደቅ')}</h1>

              {/* ── Payment Requests (requires admin action) ── */}
              <div style={{ margin: '24px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: '20px' }}>
                      {t('Pending Payment Requests', 'ያልተፈቀዱ ክፍያዎች')}
                      {pendingPaymentsCount > 0 && (
                        <span className="portal-tab-badge" style={{ marginLeft: '10px', fontSize: '12px', background: 'var(--danger)', color: '#fff' }}>
                          {pendingPaymentsCount} {t('pending', 'በጠባቂ')}
                        </span>
                      )}
                    </h2>
                    <p className="muted" style={{ margin: '4px 0 0', fontSize: '13px' }}>
                      {t('Open the payment screenshot and match the recipient, amount and transaction to your bank records before approving. Approval adds credits immediately.', 'የTelebirr ወይም CBE ዋቢ ቁጥር ካረጋገጡ በኋላ ያጽድቁ ወይም ይሰርዙ። ሲፈቀድ ወዲያው ለደንበኛ ክሬዲት ይደርሳል።')}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {(['all', 'pending', 'approved', 'rejected'] as const).map(f => (
                      <button
                        key={f}
                        type="button"
                        aria-pressed={paymentFilter === f}
                        onClick={() => setPaymentFilter(f)}
                        style={{ fontSize: '11px', padding: '6px 14px', textTransform: 'capitalize' }}
                      >
                        {f === 'all' ? t('All', 'ሁሉም') : f === 'pending' ? t('Pending', 'በጠባቂ') : f === 'approved' ? t('Approved', 'ተፈቅዷል') : t('Rejected', 'ተሰርዟል')}
                      </button>
                    ))}
                    <input
                      type="search"
                      placeholder={t('Search reference…', 'ዋቢ ቁጥር ፈልግ…')}
                      value={paymentSearch}
                      onChange={e => setPaymentSearch(e.target.value)}
                      style={{ margin: 0, padding: '6px 12px', fontSize: '12px', minWidth: '180px' }}
                    />
                  </div>
                </div>

                {livePayments.length === 0 ? (
                  <div className="empty-state">
                    <p>{t('No payment requests yet.', 'ምንም ክፍያ ጥያቄ የለም።')}</p>
                  </div>
                ) : (
                  (() => {
                    const filtered = livePayments
                      .filter(p => paymentFilter === 'all' || p.status === paymentFilter)
                      .filter(p => !paymentSearch.trim() || p.reference.toLowerCase().includes(paymentSearch.toLowerCase()));
                    return filtered.length === 0 ? (
                      <div className="empty-state"><p>{t('No matching requests.', 'ምንም አልተገኘም።')}</p></div>
                    ) : (
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>{t('Date', 'ቀን')}</th>
                            <th>{t('Client ID', 'ደንበኛ')}</th>
                            <th>{t('Package', 'ጥቅል')}</th>
                            <th>{t('Amount', 'ዋጋ')}</th>
                            <th>{t('Method · Receipt', 'ዘዴ · ዋቢ')}</th>
                            <th>{t('Status', 'ሁኔታ')}</th>
                            <th>{t('Actions', 'ድርጊቶች')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filtered.map(p => {
                            const totalCents = p.principal_cents + (p.fee_cents || 0);
                            const userEmail = liveUsers.find(u => u.id === p.user_id)?.email || p.user_id.slice(0, 12) + '…';
                            return (
                              <tr key={p.id} style={{ background: p.status === 'pending' ? 'var(--accent-soft, #fffdf2)' : undefined }}>
                                <td data-label={t('Date', 'ቀን')} style={{ fontSize: '12px', fontFamily: 'Space Mono, monospace', whiteSpace: 'nowrap' }}>
                                  {new Date(p.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                </td>
                                <td data-label={t('Client ID', 'ደንበኛ')}>
                                  <span style={{ fontSize: '12px', fontFamily: 'Space Mono, monospace' }}>{userEmail}</span>
                                </td>
                                <td data-label={t('Package', 'ጥቅል')} style={{ textTransform: 'capitalize', fontWeight: 700 }}>
                                  {p.kind === 'comprehensive' ? '⭐ Comprehensive Care' : p.kind}
                                </td>
                                <td data-label={t('Amount', 'ዋጋ')}>
                                  <strong>{money(totalCents / 100)}</strong>
                                  <br />
                                  <span style={{ fontSize: '11px', color: 'var(--muted-text)' }}>
                                    {money(p.principal_cents / 100)} + {money((p.fee_cents || 0) / 100)} fee
                                  </span>
                                </td>
                                <td data-label={t('Method · Reference', 'ዘዴ · ዋቢ')}>
                                  <span style={{ display: 'inline-block', fontSize: '10px', fontWeight: 700, padding: '2px 6px', background: p.method === 'telebirr' ? '#6c2bd9' : '#1a5c9a', color: '#fff', marginBottom: '4px', borderRadius: '2px' }}>
                                    {p.method.toUpperCase()}
                                  </span>
                                  <br />
                                  <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '12px', fontWeight: 700, letterSpacing: '0.05em' }}>
                                    {p.proof_path ? <button type="button" onClick={async () => { try { const result = await adminRequest({}, passphrase, '/api/payment-proof?id=' + p.id); const data = await result.json(); if (!result.ok) throw new Error(data.error); setReceiptUrl(data.url); } catch (error) { setAdminNotice(error instanceof Error ? error.message : 'Could not open screenshot.'); } }}>View payment screenshot ↗</button> : p.reference}
                                  </span>
                                </td>
                                <td data-label={t('Status', 'ሁኔታ')}>
                                  <span className={`admin-badge ${p.status === 'pending' ? 'amber' : p.status === 'approved' ? 'green' : 'grey'}`} style={{ textTransform: 'capitalize' }}>
                                    {p.status === 'pending' ? '⏳ ' + t('Pending', 'በጠባቂ') : p.status === 'approved' ? '✓ ' + t('Approved', 'ተፈቅዷል') : '✕ ' + t('Rejected', 'ተሰርዟል')}
                                  </span>
                                </td>
                                <td data-label={t('Actions', 'ድርጊቶች')}>
                                  {p.status === 'pending' ? (
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                                      <label><input type="checkbox" checked={!!verifiedPayments[p.id]} onChange={e => setVerifiedPayments(current => ({ ...current, [p.id]: e.target.checked }))} /> Receipt matches the amount, recipient and transaction in my bank records</label>
                                      <button
                                        className="solid"
                                        disabled={busyAction || !verifiedPayments[p.id]}
                                        onClick={() => void handleReviewPayment(p.id, true)}
                                        style={{ fontSize: '11px', padding: '6px 12px', background: '#2e7d32', borderColor: '#2e7d32' }}
                                      >
                                        ✓ {t('Approve & Credit', 'አጽድቅና ጥቅል ስጥ')}
                                      </button>
                                      <button
                                        disabled={busyAction}
                                        onClick={() => void handleReviewPayment(p.id, false)}
                                        style={{ fontSize: '10px', padding: '4px 8px', color: 'var(--danger)', borderColor: 'var(--danger)' }}
                                      >
                                        ✕ {t('Reject', 'ሰርዝ')}
                                      </button>
                                    </div>
                                  ) : (
                                    <span style={{ fontSize: '11px', color: 'var(--muted-text)' }}>{t('Reviewed', 'ታይቷል')}</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    );
                  })()
                )}
              </div>

              {/* ── Package Revenue Metrics ── */}
              <div style={{ borderTop: '3px solid var(--ink)', paddingTop: '24px', marginTop: '32px' }}>
                <h2 style={{ margin: '0 0 16px' }}>{t('Revenue Summary', 'የሽያጭ ማጠቃለያ')}</h2>
                <div className="admin-metrics" style={{ gridTemplateColumns: 'repeat(3,minmax(0,1fr))', margin: '0 0 20px' }}>
                  <div className="admin-metric-card">
                    <small>{t('Total package revenue', 'ጠቅላላ ጥቅሎች')}</small>
                    <strong>{money(totalRevenue)}</strong>
                  </div>
                  <div className="admin-metric-card">
                    <small>{t('Total purchases', 'ጠቅላላ ግዢዎች')}</small>
                    <strong>{state.receipts.length}</strong>
                  </div>
                  <div className="admin-metric-card">
                    <small>{t('Avg per purchase', 'አማካኝ')}</small>
                    <strong>
                      {state.receipts.length ? money(Math.round(totalRevenue / state.receipts.length)) : '—'}
                    </strong>
                  </div>
                </div>

                {!state.receipts.length ? (
                  <div className="empty-state">
                    <p>{t('No package purchases yet.', 'ጥቅሎች አልተገዙም።')}</p>
                  </div>
                ) : (
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>{t('Date', 'ቀን')}</th>
                        <th>{t('Therapist', 'ባለሙያ')}</th>
                        <th>{t('Package', 'ጥቅል')}</th>
                        <th>{t('Amount', 'ዋጋ')}</th>
                        <th>{t('Receipt ID', 'ደረሰኝ')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {state.receipts.map(r => (
                        <tr key={r.id}>
                          <td data-label={t('Date', 'ቀን')}>{date(r.at)}</td>
                          <td data-label={t('Therapist', 'ባለሙያ')}>{people.find(p => p.id === r.therapist)?.name}</td>
                          <td data-label={t('Package', 'ጥቅል')} style={{ textTransform: 'capitalize', fontWeight: 600 }}>{r.bundle}</td>
                          <td data-label={t('Amount', 'ዋጋ')}>{money(r.amount)}</td>
                          <td data-label={t('Receipt ID', 'ደረሰኝ')} style={{ fontSize: '11px', fontFamily: 'Space Mono,monospace', color: 'var(--muted-text)' }}>
                            {r.id.slice(0, 12)}…
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </motion.div>
          )}

          {/* ══ SETTINGS ══════════════════════════════════════════ */}
          {tab === 'broadcast' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <h1>{t('Channel Broadcast', 'Channel Broadcast')}</h1>
              <AdminBroadcast people={people} adminRequest={adminRequest} />
            </motion.div>
          )}
          {tab === 'settings' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <h1>{t('Platform Governance & Settings', 'ቅንብሮች')}</h1>
              <div className="notice" style={{ margin: '16px 0 24px' }}>
                {t(
                  'These are platform-level administrative controls. Configure global flags, payment verification, and practitioner onboarding approvals.',
                  'ይህ የአስተዳደር ቅንብሮች ክፍል ነው።'
                )}
              </div>

              <div className="admin-section">
                <div className="admin-section-header">
                  <h2>{t('Quick Portals & Navigation', 'ፈጣን አገናኞች')}</h2>
                </div>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <Link className="solid" href="/portal">
                    {t('Therapist Portal', 'የባለሙያ ፖርታል')}
                  </Link>
                  <Link href="/register" style={{ padding: '10px 16px', border: '2px solid var(--ink)', textDecoration: 'none', fontWeight: 700 }}>
                    {t('Register New Practitioner', 'ባለሙያ ምዝገባ')}
                  </Link>
                  <Link href="/therapists" style={{ padding: '10px 16px', border: '2px solid var(--ink)', textDecoration: 'none' }}>
                    {t('Client Directory', 'የደንበኛ ዝርዝር')}
                  </Link>
                  <Link href="/chat" style={{ padding: '10px 16px', border: '2px solid var(--ink)', textDecoration: 'none' }}>
                    {t('Live Messenger', 'የቀጥታ ቻት')}
                  </Link>
                </div>
              </div>

              <div className="admin-section" style={{ marginTop: '24px' }}>
                <div className="admin-section-header">
                  <h2>{t('Platform Payment Configuration', 'የክፍያ መረጃ')}</h2>
                </div>
                <div style={{ padding: '24px', border: '3px solid var(--ink)', fontFamily: 'Space Mono, monospace', fontSize: '13px', background: 'var(--surface-soft)' }}>
                  <div style={{ marginBottom: '14px', fontSize: '15px' }}>
                    <strong>Payee Name:</strong> Dawit Aynalem
                  </div>
                  <div style={{ marginBottom: '8px' }}>📱 <strong>Telebirr:</strong> 0990171738</div>
                  <div style={{ marginBottom: '8px' }}>🏦 <strong>Commercial Bank of Ethiopia (CBE):</strong> 1000605180519</div>
                  <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '2px solid var(--rule-soft)' }}>
                    <strong>Platform Service Fee:</strong> 5% applied to appointments and text/voice packages
                  </div>
                  <div style={{ marginTop: '8px', color: 'var(--muted-text)', fontSize: '12px' }}>
                    24-hour turnaround commitment on verified client refund requests.
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </main>
      </div>
      {receiptUrl && <Modal title="Payment screenshot" close={() => setReceiptUrl('')}><p>Match the amount, recipient and transaction with your bank records before approving.</p><Image src={receiptUrl} alt="Submitted payment receipt" width={900} height={1200} unoptimized style={{width:'100%',height:'auto'}} /><a href={receiptUrl} target="_blank" rel="noopener noreferrer">Open full-size screenshot</a></Modal>}<Footer />
    </>
  );
}

