'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePlatform, statusLabel } from '@/components/Platform';
import { Header, Footer, Photo } from '@/components/Shell';
import { dateKey } from '@/lib/calendar';
import { motion } from 'framer-motion';


type Tab = 'overview' | 'therapists' | 'bookings' | 'messages' | 'packages' | 'settings';

export default function AdminPortal() {
  const { t, people, state, messages, money, date, settings, updateAppointment, deleteTherapist } = usePlatform();
  const auth = false; // Administration is restricted to the Supabase dashboard until server roles are implemented.
  const [tab, setTab] = useState<Tab>('overview');

  // Booking filters & search
  const [bookingFilter, setBookingFilter] = useState<'all' | 'pending' | 'confirmed' | 'cancelled' | 'completed'>('all');
  const [bookingSearch, setBookingSearch] = useState('');
  const [therapistSearch, setTherapistSearch] = useState('');

  if (!auth) return <><Header /><main className="platform-main" style={{ maxWidth: '520px', padding: '60px 24px' }}><span className="eyebrow">PLATFORM GOVERNANCE</span><h1>Admin Console</h1><div style={{ border: '3px solid var(--ink)', padding: '24px', background: 'var(--surface-soft)' }}><p>Web administration is not enabled. The project owner manages practice approvals in the Supabase dashboard.</p><Link href="/">Return home</Link></div></main><Footer /></>;

  // ── Computed stats ───────────────────────────────────────────
  const today = dateKey();
  const totalBookings = state.appointments.length;
  const todayBookings = state.appointments.filter(a => a.date === today && a.status !== 'cancelled').length;
  const totalRevenue = state.receipts.reduce((n, r) => n + r.amount, 0);
  const pendingAppts = state.appointments.filter(a => a.status === 'pending');
  const allMessages = messages;
  const registeredCount = state.registeredTherapists?.length || 0;

  const tabs: [Tab, string, number?][] = [
    ['overview', t('Overview', 'አጠቃላይ')],
    ['therapists', t('Therapists & Applicants', 'ባለሙያዎችና ማመልከቻዎች'), registeredCount],
    ['bookings', t('Bookings', 'ቀጠሮዎች'), pendingAppts.length],
    ['messages', t('Messages', 'መልዕክቶች'), allMessages.length],
    ['packages', t('Package sales', 'ጥቅሎች')],
    ['settings', t('Settings', 'ቅንብሮች')],
  ];

  const navIcons: Record<Tab, string> = {
    overview: '📊',
    therapists: '👥',
    bookings: '📅',
    messages: '💬',
    packages: '🛍️',
    settings: '⚙️',
  };

  // ── Bar chart helper ─────────────────────────────────────────
  const therapistBookingCounts = people.map(p => ({
    id: p.id,
    name: p.name.split(' ')[0],
    count: state.appointments.filter(a => a.therapist === p.id && a.status !== 'cancelled').length,
  }));
  const maxCount = Math.max(1, ...therapistBookingCounts.map(x => x.count));

  const packageRevByTherapist = people.map(p => ({
    id: p.id,
    name: p.name.split(' ')[0],
    amount: state.receipts.filter(r => r.therapist === p.id).reduce((n, r) => n + r.amount, 0),
  }));
  const maxRev = Math.max(1, ...packageRevByTherapist.map(x => x.amount));

  // Filtered bookings
  const filteredBookings = state.appointments
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
                <button className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>
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
            <small>{t('Interactive Demo Console', 'ማሳያ ሁኔታ')}</small>
            <br />
            <button style={{ marginTop: '8px', fontSize: '10px' }} disabled>
              {t('Sign out', 'ውጣ')}
            </button>
          </div>
        </aside>

        {/* ── MAIN CONTENT ── */}
        <main className="admin-content">
          {/* Mobile tab switcher */}
          <div className="admin-mobile-tabs">
            {tabs.map(([key, label, count]) => (
              <button
                key={key}
                aria-pressed={tab === key}
                onClick={() => setTab(key)}
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
                  <small>{t('Package revenue (demo)', 'ጥቅል ሽያጭ (ማሳያ)')}</small>
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
                  <h3>{t('Package revenue by therapist (demo)', 'ጥቅሎች በባለሙያ (ማሳያ)')}</h3>
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
                      <th>{t('Type / Source', 'ምንጭ')}</th>
                      <th>{t('Status', 'ሁኔታ')}</th>
                      <th>{t('Online / In-Person', 'ዋጋ')}</th>
                      <th>{t('Bookings', 'ቀጠሮዎች')}</th>
                      <th>{t('Actions', 'ድርጊቶች')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {people
                      .filter(p =>
                        p.name.toLowerCase().includes(therapistSearch.toLowerCase()) ||
                        p.title.toLowerCase().includes(therapistSearch.toLowerCase())
                      )
                      .map(p => {
                        const ps = settings(p.id);
                        const bCount = state.appointments.filter(
                          a => a.therapist === p.id && a.status !== 'cancelled'
                        ).length;
                        const isCustom = state.registeredTherapists?.some(r => r.id === p.id);

                        return (
                          <tr key={p.id}>
                            <td data-label={t('Practitioner', 'ባለሙያ')}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <Photo id={p.id} name={p.name} src={ps.photo} />
                                <div>
                                  <strong>{p.name}</strong>
                                  <small style={{ display: 'block', color: 'var(--muted-text)' }}>{p.title}</small>
                                </div>
                              </div>
                            </td>
                            <td data-label={t('Type / Source', 'ምንጭ')}>
                              {isCustom ? (
                                <span className="admin-badge amber">
                                  {t('Registered Applicant', 'የተመዘገበ አዲስ')}
                                </span>
                              ) : (
                                <span className="admin-badge grey">
                                  {t('Verified Staff', 'መደበኛ')}
                                </span>
                              )}
                            </td>
                            <td data-label={t('Status', 'ሁኔታ')}>
                              <span
                                className={`admin-badge ${
                                  ps.presence === 'available' ? 'green' : ps.presence === 'busy' ? 'amber' : 'grey'
                                }`}
                              >
                                {ps.presence}
                              </span>
                            </td>
                            <td data-label={t('Online / In-Person', 'ዋጋ')}>
                              {money(ps.online)} / {money(ps.inperson)}
                            </td>
                            <td data-label={t('Bookings', 'ቀጠሮዎች')}>
                              <strong>{bCount}</strong>
                            </td>
                            <td data-label={t('Actions', 'ድርጊቶች')}>
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                                <Link
                                  href={`/portal?therapist=${p.id}`}
                                  style={{ fontSize: '11px', fontWeight: 700 }}
                                >
                                  {t('Open Portal →', 'ፖርታል →')}
                                </Link>
                                <Link
                                  href={`/chat?therapist=${p.id}`}
                                  style={{ fontSize: '11px' }}
                                >
                                  {t('Chat →', 'ቻት →')}
                                </Link>
                                {isCustom && (
                                  <button
                                    onClick={() => {
                                      if (confirm(t('Remove this registered practitioner?', 'ይህ ባለሙያ ይሰረዝ?'))) {
                                        deleteTherapist(p.id);
                                      }
                                    }}
                                    style={{ fontSize: '10px', padding: '3px 6px', color: 'var(--danger)', borderColor: 'var(--danger)' }}
                                  >
                                    ✕ {t('Remove', 'ሰርዝ')}
                                  </button>
                                )}
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
              <h1>{t('Voice & Text Package Orders', 'የጥቅሎች ሽያጭ')}</h1>
              <div className="admin-metrics" style={{ gridTemplateColumns: 'repeat(3,minmax(0,1fr))', margin: '20px 0' }}>
                <div className="admin-metric-card">
                  <small>{t('Total package revenue (demo)', 'ጠቅላላ ጥቅሎች (ማሳያ)')}</small>
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
            </motion.div>
          )}

          {/* ══ SETTINGS ══════════════════════════════════════════ */}
          {tab === 'settings' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <h1>{t('Platform Governance & Settings', 'ቅንብሮች')}</h1>
              <div className="notice" style={{ margin: '16px 0 24px' }}>
                {t(
                  'These are platform-level administrative controls. Configure global flags, simulated billing accounts, and practitioner onboarding approvals.',
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
            </motion.div>
          )}
        </main>
      </div>
      <Footer />
    </>
  );
}
