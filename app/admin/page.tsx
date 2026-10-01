'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePlatform, statusLabel } from '@/components/Platform';
import { Header, Footer, Photo } from '@/components/Shell';
import { dateKey } from '@/lib/calendar';

const ADMIN_PASS = 'admin2024';

type Tab = 'overview' | 'therapists' | 'bookings' | 'messages' | 'packages' | 'settings';

export default function AdminPortal() {
  const { t, people, state, messages, money, date, settings, updateAppointment, updateSettings } = usePlatform();
  const [auth, setAuth] = useState(false);
  const [pass, setPass] = useState('');
  const [authError, setAuthError] = useState('');
  const [tab, setTab] = useState<Tab>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // ── Login gate ──────────────────────────────────────────────
  if (!auth) {
    return (
      <>
        <Header />
        <main className="platform-main" style={{ maxWidth: '480px' }}>
          <span className="eyebrow">{t('ADMIN ACCESS', 'አስተዳዳሪ')}</span>
          <h1>{t('Admin Portal', 'አስተዳዳሪ ፖርታል')}</h1>
          <p>{t('Enter the admin password to continue. This is a demonstration — no real accounts exist.', 'ለቀጣይ የአስተዳዳሪ የይለፍ ቃል ያስገቡ። ይህ ማሳያ ነው።')}</p>
          <form onSubmit={e => { e.preventDefault(); if (pass === ADMIN_PASS) { setAuth(true); setAuthError(''); } else setAuthError(t('Incorrect password. Try: admin2024', 'ተሳስቷል። ሞክሩ: admin2024')); }}>
            <label>
              {t('Admin password', 'የይለፍ ቃል')}
              <input type="password" value={pass} onChange={e => setPass(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
            </label>
            {authError && <p role="alert" style={{ color: '#c00', fontSize: '13px' }}>{authError}</p>}
            <button className="solid" type="submit">{t('Enter admin portal', 'ፖርታሉን ክፈት')}</button>
          </form>
          <p className="muted" style={{ marginTop: '24px' }}>{t('Hint: admin2024', 'ፍንጭ: admin2024')}</p>
        </main>
        <Footer />
      </>
    );
  }

  // ── Computed stats ───────────────────────────────────────────
  const today = dateKey();
  const totalBookings = state.appointments.length;
  const todayBookings = state.appointments.filter(a => a.date === today && a.status !== 'cancelled').length;
  const totalRevenue = state.receipts.reduce((n, r) => n + r.amount, 0);
  const pendingAppts = state.appointments.filter(a => a.status === 'pending');
  const allMessages = messages;

  const tabs: [Tab, string][] = [
    ['overview', t('Overview', 'አጠቃላይ')],
    ['therapists', t('Therapists', 'ባለሙያዎች')],
    ['bookings', t('Bookings', 'ቀጠሮዎች')],
    ['messages', t('Messages', 'መልዕክቶች')],
    ['packages', t('Package sales', 'ጥቅሎች')],
    ['settings', t('Settings', 'ቅንብሮች')],
  ];

  const navIcons: Record<Tab, string> = {
    overview: '📊', therapists: '👥', bookings: '📅',
    messages: '💬', packages: '🛍️', settings: '⚙️',
  };

  // ── Bar chart helper ─────────────────────────────────────────
  const therapistBookingCounts = people.map(p => ({
    name: p.name.split(' ')[0],
    count: state.appointments.filter(a => a.therapist === p.id && a.status !== 'cancelled').length,
  }));
  const maxCount = Math.max(1, ...therapistBookingCounts.map(x => x.count));

  const packageRevByTherapist = people.map(p => ({
    name: p.name.split(' ')[0],
    amount: state.receipts.filter(r => r.therapist === p.id).reduce((n, r) => n + r.amount, 0),
  }));
  const maxRev = Math.max(1, ...packageRevByTherapist.map(x => x.amount));

  return (
    <>
      <Header />
      <div className="admin-layout">
        {/* ── SIDEBAR ── */}
        <aside className="admin-sidebar">
          <div className="admin-sidebar-brand">
            <span>{t('MANAGEMENT', 'አስተዳደር')}</span>
            <h2>{t('Admin Portal', 'አስተዳዳሪ')}</h2>
          </div>
          <ul className="admin-nav">
            {tabs.map(([key, label]) => (
              <li key={key}>
                <button className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>
                  <span className="nav-icon">{navIcons[key]}</span>
                  {label}
                </button>
              </li>
            ))}
          </ul>
          <div className="admin-sidebar-footer">
            <small>{t('Demo mode — no real data', 'ማሳያ ሁኔታ')}</small><br />
            <button style={{ marginTop: '8px', fontSize: '10px' }} onClick={() => setAuth(false)}>{t('Sign out', 'ውጣ')}</button>
          </div>
        </aside>

        {/* ── MAIN CONTENT ── */}
        <main className="admin-content">
          {/* Mobile tab switcher */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '24px' }}>
            {tabs.map(([key, label]) => (
              <button key={key} aria-pressed={tab === key} onClick={() => setTab(key)} style={{ fontSize: '11px', padding: '7px 10px' }}>
                {navIcons[key]} {label}
              </button>
            ))}
          </div>

          {/* ══ OVERVIEW ══════════════════════════════════════════ */}
          {tab === 'overview' && (
            <>
              <span className="eyebrow">{t('DASHBOARD OVERVIEW', 'ዳሽቦርድ')}</span>
              <h1>{t('Care at a glance.', 'አጠቃላይ እይታ።')}</h1>

              <div className="admin-metrics">
                {([
                  [t('Total bookings', 'ጠቅላላ ቀጠሮዎች'), totalBookings, ''],
                  [t("Today's sessions", 'የዛሬ ቀጠሮዎች'), todayBookings, ''],
                  [t('Package revenue (demo)', 'ጥቅል ሽያጭ (ማሳያ)'), money(totalRevenue), ''],
                  [t('Pending approvals', 'በቀጠሮ ጠያቂዎች'), pendingAppts.length, pendingAppts.length > 0 ? '⚠ ' + t('needs attention', 'ትኩረት ያስፈልጋቸዋል') : '✓ ' + t('all clear', 'ሁሉም ጥሩ ነው')],
                ] as [string, string | number, string][]).map(([label, value, trend]) => (
                  <div key={label} className="admin-metric-card">
                    <small>{label}</small>
                    <strong>{value}</strong>
                    {trend && <span className="trend">{trend}</span>}
                  </div>
                ))}
              </div>

              {/* Charts */}
              <div className="admin-chart-row">
                <div className="admin-chart-box">
                  <h3>{t('Bookings by therapist', 'ቀጠሮዎች በባለሙያ')}</h3>
                  <div className="admin-bar-chart">
                    {therapistBookingCounts.map(({ name, count }) => (
                      <div key={name} className="admin-bar-wrap">
                        <div className="admin-bar" style={{ height: `${(count / maxCount) * 100}%`, minHeight: count > 0 ? '8px' : '2px', background: count > 0 ? '#000' : '#ddd' }} />
                        <div className="admin-bar-label">{name}<br />{count}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="admin-chart-box">
                  <h3>{t('Package revenue by therapist (demo)', 'ጥቅሎች በባለሙያ (ማሳያ)')}</h3>
                  <div className="admin-bar-chart">
                    {packageRevByTherapist.map(({ name, amount }) => (
                      <div key={name} className="admin-bar-wrap">
                        <div className="admin-bar" style={{ height: `${(amount / maxRev) * 100}%`, minHeight: amount > 0 ? '8px' : '2px', background: amount > 0 ? '#000' : '#ddd' }} />
                        <div className="admin-bar-label">{name}<br />{amount > 0 ? money(amount) : '—'}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Quick actions */}
              <div className="admin-section">
                <div className="admin-section-header"><h2>{t('Quick actions', 'ፈጣን ድርጊቶች')}</h2></div>
                <div className="admin-quick-actions">
                  {([
                    [t('View all therapists', 'ሁሉም ባለሙያዎች'), () => setTab('therapists'), '👥'],
                    [t('Pending bookings', 'ቀጠሮ ጥያቄዎች'), () => setTab('bookings'), '📅'],
                    [t('Read messages', 'መልዕክቶች አንብብ'), () => setTab('messages'), '💬'],
                    [t('Package sales', 'ጥቅሎች'), () => setTab('packages'), '🛍️'],
                  ] as [string, () => void, string][]).map(([label, action, icon]) => (
                    <button key={label} onClick={action}>
                      <strong>{icon}</strong>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ══ THERAPISTS ════════════════════════════════════════ */}
          {tab === 'therapists' && (
            <>
              <h1>{t('Therapists', 'ባለሙያዎች')}</h1>
              <div className="admin-section">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>{t('Therapist', 'ባለሙያ')}</th>
                      <th>{t('Title', 'ማዕረግ')}</th>
                      <th>{t('Status', 'ሁኔታ')}</th>
                      <th>{t('Online price', 'ዋጋ ኦንላይን')}</th>
                      <th>{t('In-person', 'በአካል')}</th>
                      <th>{t('Bookings', 'ቀጠሮዎች')}</th>
                      <th>{t('Actions', 'ድርጊቶች')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {people.map(p => {
                      const ps = settings(p.id);
                      const bCount = state.appointments.filter(a => a.therapist === p.id && a.status !== 'cancelled').length;
                      return (
                        <tr key={p.id}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div className="admin-therapist-avatar">{p.name.replace(/^Dr\.\s*/, '').split(' ').map(n => n[0]).join('').slice(0, 2)}</div>
                              <span>{p.name}</span>
                            </div>
                          </td>
                          <td>{p.title}</td>
                          <td>
                            <span className={`admin-badge ${ps.presence === 'available' ? 'green' : ps.presence === 'busy' ? 'amber' : 'grey'}`}>
                              {ps.presence}
                            </span>
                          </td>
                          <td>{money(ps.online)}</td>
                          <td>{money(ps.inperson)}</td>
                          <td>{bCount}</td>
                          <td>
                            <Link href={`/portal?therapist=${p.id}`} style={{ fontSize: '11px' }}>{t('Portal →', 'ፖርታል →')}</Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="notice">{t('To edit a therapist\'s rates, availability, or photo — use the Therapist Portal.', 'ዋጋ፣ ቀናት ወይም ፎቶ ለማስተካከል — የባለሙያ ፖርታሉን ይጠቀሙ።')} <Link href="/portal">{t('Go to portal →', 'ወደ ፖርታል →')}</Link></p>
            </>
          )}

          {/* ══ BOOKINGS ══════════════════════════════════════════ */}
          {tab === 'bookings' && (
            <>
              <h1>{t('All bookings', 'ሁሉም ቀጠሮዎች')}</h1>
              {!state.appointments.length ? (
                <div className="empty-state">
                  <p>{t('No bookings yet. Create one from the client directory.', 'ቀጠሮ የለም። ከደንበኞቹ ዝርዝር ይፍጠሩ።')}</p>
                  <Link className="solid" href="/therapists">{t('Go to directory', 'ወደ ዝርዝር')}</Link>
                </div>
              ) : (
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>{t('Client', 'ደንበኛ')}</th>
                      <th>{t('Therapist', 'ባለሙያ')}</th>
                      <th>{t('Date & time', 'ቀን')}</th>
                      <th>{t('Type', 'ዓይነት')}</th>
                      <th>{t('Price', 'ዋጋ')}</th>
                      <th>{t('Status', 'ሁኔታ')}</th>
                      <th>{t('Action', 'ድርጊት')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.appointments.slice().sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)).map(a => (
                      <tr key={a.id}>
                        <td>{a.client === 'demo-client' ? t('Demo client', 'ደንበኛ') : a.client}</td>
                        <td>{people.find(p => p.id === a.therapist)?.name}</td>
                        <td>{date(`${a.date}T12:00`)} · {a.time}</td>
                        <td>{a.medium === 'online' ? '💻' : '🏥'} {a.medium === 'online' ? t('Online', 'ኦንላይን') : t('In-person', 'በአካል')}</td>
                        <td>{money(a.price)}</td>
                        <td><span className={`admin-badge ${a.status === 'confirmed' ? 'green' : a.status === 'pending' ? 'amber' : a.status === 'cancelled' ? 'grey' : 'green'}`}>{statusLabel(a.status, t)}</span></td>
                        <td>
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            {a.status === 'pending' && <button style={{ fontSize: '10px', padding: '4px 8px' }} onClick={() => updateAppointment(a.id, { status: 'confirmed' })}>{t('Confirm', 'አረጋግጥ')}</button>}
                            {(a.status === 'pending' || a.status === 'confirmed') && <button style={{ fontSize: '10px', padding: '4px 8px' }} onClick={() => updateAppointment(a.id, { status: 'cancelled' })}>{t('Cancel', 'ሰርዝ')}</button>}
                            {a.status === 'confirmed' && <button style={{ fontSize: '10px', padding: '4px 8px' }} onClick={() => updateAppointment(a.id, { status: 'completed' })}>{t('Mark done', 'ጨርስ')}</button>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}

          {/* ══ MESSAGES ══════════════════════════════════════════ */}
          {tab === 'messages' && (
            <>
              <h1>{t('All messages', 'ሁሉም መልዕክቶች')}</h1>
              {!allMessages.length ? (
                <div className="empty-state"><p>{t('No messages yet.', 'መልዕክቶች የሉም።')}</p></div>
              ) : (
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>{t('From', 'ከ')}</th>
                      <th>{t('Therapist', 'ባለሙያ')}</th>
                      <th>{t('Type', 'ዓይነት')}</th>
                      <th>{t('Preview', 'ቅኝት')}</th>
                      <th>{t('Time', 'ሰዓት')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allMessages.map(m => (
                      <tr key={m.id}>
                        <td><span className={`admin-badge ${m.from === 'client' ? 'amber' : 'green'}`}>{m.from === 'client' ? t('Client', 'ደንበኛ') : t('Therapist', 'ባለሙያ')}</span></td>
                        <td>{people.find(p => p.id === m.therapist)?.name}</td>
                        <td>{m.audio ? '🎙 ' + t('Voice', 'ድምፅ') : '💬 ' + t('Text', 'ጽሑፍ')}</td>
                        <td style={{ maxWidth: '260px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.text ? m.text.slice(0, 80) : t('Audio recording', 'ድምፅ ቅጂ')}</td>
                        <td>{new Date(m.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}

          {/* ══ PACKAGES ══════════════════════════════════════════ */}
          {tab === 'packages' && (
            <>
              <h1>{t('Package sales', 'ጥቅሎች')}</h1>
              <div className="admin-metrics" style={{ gridTemplateColumns: 'repeat(3,minmax(0,1fr))' }}>
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
                  <strong>{state.receipts.length ? money(Math.round(totalRevenue / state.receipts.length)) : '—'}</strong>
                </div>
              </div>
              {!state.receipts.length ? (
                <div className="empty-state"><p>{t('No package purchases yet.', 'ጥቅሎች አልተገዙም።')}</p></div>
              ) : (
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>{t('Date', 'ቀን')}</th>
                      <th>{t('Therapist', 'ባለሙያ')}</th>
                      <th>{t('Package', 'ጥቅል')}</th>
                      <th>{t('Amount (demo)', 'ዋጋ (ማሳያ)')}</th>
                      <th>{t('Receipt ID', 'ደረሰኝ')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.receipts.map(r => (
                      <tr key={r.id}>
                        <td>{date(r.at)}</td>
                        <td>{people.find(p => p.id === r.therapist)?.name}</td>
                        <td style={{ textTransform: 'capitalize' }}>{r.bundle}</td>
                        <td>{money(r.amount)}</td>
                        <td style={{ fontSize: '11px', fontFamily: 'Space Mono,monospace', color: '#555' }}>{r.id.slice(0, 12)}…</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}

          {/* ══ SETTINGS ══════════════════════════════════════════ */}
          {tab === 'settings' && (
            <>
              <h1>{t('Platform settings', 'ቅንብሮች')}</h1>
              <div className="notice">{t('These are admin-level platform settings. In a production system this would control global discounts, feature flags, notification settings, and therapist approval workflows. For this demo, use the Therapist Portal to manage individual therapist settings.', 'ይህ የሙከራ ቅንብሮች ክፍል ነው። ለእያንዳንዱ ባለሙያ ቅንብሮች — የባለሙያ ፖርታሉን ይጠቀሙ።')}</div>

              <div className="admin-section">
                <div className="admin-section-header"><h2>{t('Quick links', 'ፈጣን አገናኞች')}</h2></div>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <Link className="solid" href="/portal">{t('Therapist portal', 'ፖርታል')}</Link>
                  <Link href="/therapists">{t('Client directory', 'ዝርዝር')}</Link>
                  <Link href="/appointments">{t('My bookings', 'ቀጠሮዎቼ')}</Link>
                  <Link href="/register">{t('Register therapist', 'ባለሙያ ምዝገባ')}</Link>
                </div>
              </div>

              <div className="admin-section" style={{ marginTop: '40px' }}>
                <div className="admin-section-header"><h2>{t('Therapist quick-status', 'ሁኔታ')}</h2></div>
                <table className="admin-table">
                  <thead>
                    <tr><th>{t('Therapist', 'ባለሙያ')}</th><th>{t('Presence', 'ሁኔታ')}</th><th>{t('Chat hours', 'ቻት')}</th><th>{t('Session days', 'ቀናት')}</th></tr>
                  </thead>
                  <tbody>
                    {people.map(p => {
                      const ps = settings(p.id);
                      return (
                        <tr key={p.id}>
                          <td>{p.name}</td>
                          <td><span className={`admin-badge ${ps.presence === 'available' ? 'green' : ps.presence === 'busy' ? 'amber' : 'grey'}`}>{ps.presence}</span></td>
                          <td style={{ fontFamily: 'Space Mono,monospace', fontSize: '11px' }}>{ps.chatStart}–{ps.chatEnd}</td>
                          <td style={{ fontFamily: 'Space Mono,monospace', fontSize: '11px' }}>{ps.days.map(d => ['Su','Mo','Tu','We','Th','Fr','Sa'][d]).join(', ')}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </main>
      </div>
      <Footer />
    </>
  );
}
