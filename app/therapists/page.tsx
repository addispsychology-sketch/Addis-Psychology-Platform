'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePlatform } from '@/components/Platform';
import { Page, DemoNote, Flower, Photo, Presence, Modal } from '@/components/Shell';
import BookingDetails from '@/components/BookingDetails';
import { discountedPrice } from '@/lib/commerce';
import { availableBookingSlots, upcomingBookingDays } from '@/lib/booking-slots';
import { therapistAvailability } from '@/lib/presence';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const AM_DAY_NAMES = ['እሑድ', 'ሰኞ', 'ማክሰኞ', 'ረቡዕ', 'ሐሙስ', 'ዓርብ', 'ቅዳሜ'];

function AvailabilityBlock({ id }: { id: number }) {
  const { settings, t } = usePlatform();
  const s = settings(id);
  const chatActive = therapistAvailability(s).isOnline;

  return (
    <div className="chat-availability-card">
      <h4>{t('Chat & voice hours', 'የቻትና ድምፅ ሰዓቶች')}</h4>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', margin: '8px 0' }}>
        {s.chatDays.map(d => (
          <span key={d} style={{ padding: '3px 8px', border: '1px solid var(--ink)', font: '10px Space Mono,monospace', background: 'var(--ink)', color: 'var(--paper)' }}>
            {t(DAY_NAMES[d], AM_DAY_NAMES[d])}
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px', font: '12px Space Mono,monospace' }}>
        <span>{s.chatStart} – {s.chatEnd} (UTC+3)</span>
        <span className={`presence ${chatActive ? 'available' : ''}`}>
          {chatActive ? t('Available now for chat', 'አሁን ለቻት ዝግጁ') : t('Replies during scheduled hours', 'በተገለጸው ሰዓት ምላሽ ይሰጣል')}
        </span>
      </div>
    </div>
  );
}

export default function Directory() {
  const { t, people: allPeople, directoryReady, directoryError, refreshDirectory, settings, state, save, money } = usePlatform();
  const people = allPeople.filter(p => !p.badge);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [profileId, setProfileId] = useState<number | null>(null);
  const [quickBookId, setQuickBookId] = useState<number | null>(null);

  // Quick book form state
  const [qbMedium, setQbMedium] = useState<'online' | 'inperson'>('online');
  const [qbDate, setQbDate] = useState('');
  const [qbTime, setQbTime] = useState('');
  const [qbSuccess, setQbSuccess] = useState(false);

  const results = people.filter(p =>
    (!query || [p.name, p.title, ...p.specialties, ...p.languages].join(' ').toLowerCase().includes(query.toLowerCase())) &&
    (filter === 'all' || (filter === 'available' && therapistAvailability(settings(p.id)).isOnline) || (filter === 'saved' && state.saved.includes(p.id)))
  );

  const person = people.find(p => p.id === profileId);
  const quickPerson = people.find(p => p.id === quickBookId);
  const quickDays = quickPerson ? upcomingBookingDays(quickPerson.id, settings(quickPerson.id), state.appointments) : [];
  const quickSlots = quickPerson ? availableBookingSlots(quickPerson.id, qbDate, settings(quickPerson.id), state.appointments) : [];

  // Prepare quick book dates & slots
  function openQuickBook(id: number) {
    const s = settings(id);
    const firstDay = upcomingBookingDays(id, s, state.appointments)[0] || '';
    const daySlots = availableBookingSlots(id, firstDay, s, state.appointments);

    setQbMedium('online');
    setQbDate(firstDay);
    setQbTime(daySlots[0] || '');
    setQbSuccess(false);
    setQuickBookId(id);
  }

  return (
    <Page wide>
      <DemoNote />

      {/* ── INTRO HEADER ── */}
      <section className="directory-intro">
        <div>
          <span className="eyebrow">{t('LICENSED PRACTITIONERS / ADDIS ABABA', 'የተፈቀደላቸው ባለሙያዎች / አዲስ አበባ')}</span>
          <h1>{t('Find someone who', 'እርስዎን በትክክል')}<br />{t('understands you.', 'የሚረዳዎት ባለሙያ።')}</h1>
          <p>{t('Explore their background, approach, and availability. Book an appointment or start with text & voice notes.', 'የሙያ ታሪካቸውን፣ ዘዴያቸውንና ሰዓታቸውን ይመልከቱ። ቀጠሮ ይያዙ ወይም በቻት ይጀምሩ።')}</p>

          {/* Mobile direct jump button */}
          <div style={{ marginTop: '16px' }} className="mobile-only-jump">
            <a href="#therapist-list" className="solid compact" style={{ display: 'inline-flex' }}>
              ↓ {t(`View All ${people.length} Therapists`, `ሁሉንም ${people.length} ባለሙያዎች ይመልከቱ`)}
            </a>
          </div>
        </div>
        <Flower />
      </section>

      {/* ── CHAT PROMO CALLOUT ── */}
      <section className="chat-promo">
        <div>
          <span className="eyebrow" style={{ color: 'var(--muted-text)' }}>{t('ASYNC CARE / TEXT & VOICE', 'ቀላል ቻት / ጽሑፍና ድምፅ')}</span>
          <h2>{t('Message on your own time.', 'በሚመችዎት ሰዓት ይወያዩ።')}</h2>
          <p>{t('Not ready for video or in-person? Purchase prepaid credits to send text and voice notes directly to any therapist.', 'ለቪዲዮ ወይም በአካል ዝግጁ አይደሉም? የቅድመ ክፍያ ጥቅል በመግዛት በጽሑፍና በድምፅ መልዕክት መገናኘት ይችላሉ።')}</p>
        </div>
        <Link className="inverse-cta" href="/chat">
          {t('OPEN CHAT ↗', 'ቻት ይክፈቱ ↗')}
          <small>{t('View credits & packages', 'ክሬዲቶችን ይመልከቱ')}</small>
        </Link>
      </section>

      {/* ── DESKTOP SEARCH & FILTER TOOLS ── */}
      <div className="directory-tools">
        <label className="search-label">
          {t('Search therapists', 'ባለሙያዎችን ፈልግ')}
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={t('Name, specialty (anxiety, couples, depression), or language', 'ስም፣ ልዩ ሙያ ወይም ቋንቋ')}
          />
        </label>
        <div className="segmented">
          {([['all', t('All Therapists', 'ሁሉም')], ['available', t('Available Now', 'አሁን ዝግጁ')], ['saved', t('Saved', 'የተቀመጡ')]] as [string, string][]).map(([id, label]) => (
            <button key={id} aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}</button>
          ))}
        </div>
      </div>

      <div id="therapist-list" className="result-count">
        <span><strong>{results.length}</strong> {t('therapists available in Addis Ababa', 'ባለሙያዎች ይገኛሉ')}</span>
        <span style={{ fontSize: '11px', color: 'var(--muted-text)' }}>{t('Both in-person and online sessions supported', 'የአካልና የቪዲዮ ቀጠሮዎች ይገኛሉ')}</span>
      </div>

      {/* ── THERAPISTS GRID ── */}
      <div className="people-grid">
        {results.map(p => {
          const s = settings(p.id);
          const onlinePrice = discountedPrice(s.online, s.discount);
          const inPersonPrice = discountedPrice(s.inperson, s.discount);

          return (
            <article className="person-card" key={p.id}>
              {/* Perfectly aligned header group: Photo, Name, and Status */}
              <div className="person-header-flex">
                <div className="person-avatar-col">
                  <Photo id={p.id} name={p.name} />
                </div>
                <div className="person-info-col">
                  <div className="person-status-row">
                    <Presence id={p.id} />
                    <button
                      className="person-save-btn"
                      aria-pressed={state.saved.includes(p.id)}
                      onClick={() => save(p.id)}
                      title={state.saved.includes(p.id) ? t('Remove from saved', 'አስወግድ') : t('Save therapist', 'አስቀምጥ')}
                    >
                      {state.saved.includes(p.id) ? '★' : '☆'}
                    </button>
                  </div>
                  <h3>{p.name}</h3>
                  <p className="person-title-text">{p.title}</p>
                </div>
              </div>

              <div className="tags">
                {p.specialties.map(tag => <span key={tag}>{tag}</span>)}
              </div>

              <p className="muted" style={{ fontSize: '12px', margin: '8px 0 14px' }}>
                {p.languages.join(' · ')}<br />
                {p.yearsExperience} {t('yrs experience', 'ዓ. ልምድ')} · ⭐ {p.rating} ({p.reviewCount} {t('reviews', 'ግምገማዎች')})
              </p>

              {/* Both In-Person & Online Pricing Cleanly Displayed */}
              <div className="person-pricing-strip">
                <div className="price-row">
                  <span>💻 {t('Online Video', 'ኦንላይን')}</span>
                  <strong>{money(onlinePrice)}</strong>
                </div>
                <div className="price-row">
                  <span>🏥 {t('In-Person Office', 'በአካል')}</span>
                  <strong>{money(inPersonPrice)}</strong>
                </div>
              </div>

              {/* Actions */}
              <div className="person-card-buttons">
                <button className="solid" onClick={() => openQuickBook(p.id)}>
                  ⚡ {t('Quick Book', 'ፈጣን ቀጠሮ')}
                </button>
                <Link className="solid secondary" href={`/chat?therapist=${p.id}`} style={{ background: 'var(--paper)', color: 'var(--ink)', border: '2px solid var(--ink)' }}>
                  💬 {t('Chat', 'ቻት')}
                </Link>
              </div>

              <button className="view-profile-btn" onClick={() => setProfileId(p.id)}>
                {t('View Full Profile & Credentials →', 'ሙሉ መገለጫ ይመልከቱ →')}
              </button>
            </article>
          );
        })}
      </div>

      {(!directoryReady || directoryError) && <div className="empty-state" role="status">
        <h2>{directoryError || t('Loading therapists…', 'ባለሙያዎችን በመጫን ላይ…')}</h2>
        {directoryError && <button onClick={() => void refreshDirectory()}>{t('Try again', 'እንደገና ይሞክሩ')}</button>}
      </div>}
      {directoryReady && !directoryError && !results.length && (
        <div className="empty-state" style={{ padding: '40px', border: '3px solid var(--ink)', margin: '32px 0', textAlign: 'center' }}>
          <h2>{filter === 'available' ? t('No therapists are online just now.', 'አሁን በመስመር ላይ ያሉ ባለሙያዎች የሉም።') : filter === 'saved' ? t('You haven’t saved a therapist yet.', 'እስካሁን ባለሙያ አላስቀመጡም።') : query ? t('No therapists match this search.', 'ለዚህ ፍለጋ ተዛማጅ ባለሙያ አልተገኘም።') : t('No therapists are listed yet.', 'እስካሁን የተመዘገቡ ባለሙያዎች የሉም።')}</h2>
          <button onClick={() => { setQuery(''); setFilter('all'); }}>{t('Clear search & filters', 'ማጣሪያውን አጥፋ')}</button>
        </div>
      )}

      {/* ── THERAPIST FULL PROFILE MODAL (with dual pricing & chat hours) ── */}
      {person && (
        <Modal title={person.name} close={() => setProfileId(null)}>
          <div className="profile-detail">
            <Photo id={person.id} name={person.name} large />
            <div>
              <Presence id={person.id} />
              <h3 style={{ fontSize: '24px', margin: '8px 0 4px' }}>{person.title}</h3>
              <p>{person.bio}</p>
              <p className="muted">
                {person.languages.join(' / ')} · ⭐ {person.rating} ({person.reviewCount} {t('client reviews', 'የደንበኛ ግምገማዎች')})
              </p>
            </div>
          </div>

          {/* Pricing Section: Online & In-person */}
          <h3>{t('Session Pricing & Formats', 'የቀጠሮ ዓይነቶችና ዋጋ')}</h3>
          <div className="profile-pricing-grid">
            <div className="profile-pricing-box">
              <small>💻 {t('Online / Video Session', 'ኦንላይን / ቪዲዮ')}</small>
              <strong>{money(discountedPrice(settings(person.id).online, settings(person.id).discount))}</strong>
              <p>{t('60-minute encrypted video call. Connect from anywhere.', '60 ደቂቃ ደህንነቱ የተጠበቀ የቪዲዮ ጥሪ።')}</p>
            </div>
            <div className="profile-pricing-box">
              <small>🏥 {t('In-Person / Addis Ababa', 'በአካል / አዲስ አበባ')}</small>
              <strong>{money(discountedPrice(settings(person.id).inperson, settings(person.id).discount))}</strong>
              <p>{t('Private clinic consultation in Addis Ababa office.', 'በአዲስ አበባ ቢሮ ውስጥ የሚሰጥ የግል ምክክር።')}</p>
            </div>
          </div>

          {/* Therapist Chat Availability */}
          <AvailabilityBlock id={person.id} />

          <h3>{t('Education & Credentials', 'የትምህርትና የሙያ ማስረጃዎች')}</h3>
          <ul>
            {person.education.map(e => <li key={e}>{e}</li>)}
          </ul>

          <h3>{t('Therapeutic Approach', 'የህክምና ዘዴዎች')}</h3>
          <p>{person.approaches.join(' · ')}</p>

          <div style={{ display: 'flex', gap: '12px', marginTop: '28px', flexWrap: 'wrap' }}>
            <button className="solid" onClick={() => { setProfileId(null); openQuickBook(person.id); }}>
              ⚡ {t('Quick Book Appointment', 'ፈጣን ቀጠሮ')}
            </button>
            <Link className="solid secondary" href={`/schedule/${person.id}`} style={{ background: 'var(--paper)', color: 'var(--ink)', border: '3px solid var(--ink)' }}>
              📅 {t('Full Calendar Schedule', 'የቀን መቁጠሪያ')}
            </Link>
            <Link className="solid secondary" href={`/packages?therapist=${person.id}`} style={{ background: 'var(--paper)', color: 'var(--ink)', border: '3px solid var(--ink)' }}>
              💬 {t('Buy Message Package', 'የቻት ጥቅል')}
            </Link>
          </div>
        </Modal>
      )}

      {/* Quick booking uses the same contact form and API as the full schedule. */}
      {quickPerson && (
        <Modal title={`⚡ ${t('Quick Book Appointment', 'ፈጣን ቀጠሮ')} · ${quickPerson.name}`} close={() => setQuickBookId(null)}>
          {!qbSuccess && (
            <div className="quick-book-modal-form">
              <p style={{ margin: 0, fontSize: '14px', color: 'var(--muted-text)' }}>
                {t('Book in seconds without navigating through multiple pages.', 'በርካታ ገጾችን ሳያልፉ በሰከንዶች ውስጥ ቀጠሮ ይያዙ።')}
              </p>

              {/* Step 1: Session Format */}
              <fieldset className="quick-book-fieldset">
                <legend>{t('Choose Format', 'የቀጠሮ ዓይነት')}</legend>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '6px' }}>
                  <button
                    type="button"
                    aria-pressed={qbMedium === 'online'}
                    onClick={() => setQbMedium('online')}
                    style={{ padding: '12px', fontSize: '12px', textAlign: 'center' }}
                  >
                    💻 {t('Online Video', 'ኦንላይን')} ({money(discountedPrice(settings(quickPerson.id).online, settings(quickPerson.id).discount))})
                  </button>
                  <button
                    type="button"
                    aria-pressed={qbMedium === 'inperson'}
                    onClick={() => setQbMedium('inperson')}
                    style={{ padding: '12px', fontSize: '12px', textAlign: 'center' }}
                  >
                    🏥 {t('In-Person Office', 'በአካል')} ({money(discountedPrice(settings(quickPerson.id).inperson, settings(quickPerson.id).discount))})
                  </button>
                </div>
              </fieldset>

              {/* Step 2: Date Selection */}
              <label>
                {t('Available Date', 'ቀን ይምረጡ')}
                <select value={qbDate} disabled={!quickDays.length} onChange={e => {
                  const day = e.target.value;
                  setQbDate(day);
                  setQbTime(availableBookingSlots(quickPerson.id, day, settings(quickPerson.id), state.appointments)[0] || '');
                }}>
                  {!quickDays.includes(qbDate) && <option value="">{t('Choose an available date', 'ቀን ይምረጡ')}</option>}
                  {quickDays.map(d => (
                      <option key={d} value={d}>
                        {new Date(`${d}T12:00`).toLocaleDateString('en-GB', { weekday: 'short', month: 'short', day: 'numeric' })}
                      </option>
                    ))}
                </select>
              </label>

              {/* Step 3: Earliest Slot Selection */}
              <fieldset className="quick-book-fieldset">
                <legend>{t('Select Time Slot · Addis Ababa (UTC+3)', 'ሰዓት ይምረጡ · አዲስ አበባ')}</legend>
                <div className="quick-slot-list">
                  {quickSlots.map(time => (
                      <button
                        type="button"
                        key={time}
                        className="quick-slot-btn"
                        aria-pressed={qbTime === time}
                        onClick={() => setQbTime(time)}
                      >
                        {time}
                      </button>
                    ))}
                </div>
                {!quickSlots.length && <p className="muted">{t('No available times for this date. Choose another date or view the full calendar.', 'ለዚህ ቀን ክፍት ሰዓት የለም። ሌላ ቀን ይምረጡ።')}</p>}
              </fieldset>

              <div style={{ display: 'flex', gap: '12px', marginTop: '16px', alignItems: 'center' }}>
                <Link href={`/schedule/${quickPerson.id}?date=${qbDate}&time=${qbTime}&medium=${qbMedium}`} style={{ fontSize: '12px' }}>
                  {t('Or view full calendar →', 'ወይም ሙሉ ሰሌዳ ይመልከቱ →')}
                </Link>
              </div>
            </div>
          )}
          <BookingDetails key={quickPerson.id} therapist={quickPerson.id} day={qbDate} time={qbTime} medium={qbMedium} available={quickSlots.includes(qbTime)} onBooked={() => setQbSuccess(true)} />
        </Modal>
      )}
    </Page>
  );
}
