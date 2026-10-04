'use client';
import { useState, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { usePlatform } from '@/components/Platform';
import { Page, DemoNote, Photo } from '@/components/Shell';
import { dateKey, shiftDate, slots } from '@/lib/calendar';
import { availableBookingSlots, upcomingBookingDays } from '@/lib/booking-slots';
import { discountedPrice } from '@/lib/commerce';
import BookingDetails from '@/components/BookingDetails';

function ScheduleInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const isQuick = searchParams.get('quick') === '1';
  const id = Number(params.id);
  const { t, people, settings, state, date, money } = usePlatform();
  const p = people.find(p => p.id === id);
  const [offset, setOffset] = useState(0);
  const [chosenDay, setDay] = useState(searchParams.get('date') || '');
  const [chosenTime, setTime] = useState(searchParams.get('time') || '');
  const [medium, setMedium] = useState<'online' | 'inperson'>(searchParams.get('medium') === 'inperson' ? 'inperson' : 'online');
  const conf = settings(id);
  const today = dateKey();
  const days = Array.from({ length: 7 }, (_, i) => shiftDate(today, offset * 7 + i));

  const available = (d: string, s: string) => availableBookingSlots(id, d, conf, state.appointments).includes(s);

  const quickDay = isQuick && !chosenDay ? upcomingBookingDays(id, conf, state.appointments)[0] : undefined;
  const quickSlot = quickDay ? {day: quickDay, time: availableBookingSlots(id, quickDay, conf, state.appointments)[0]} : undefined;
  const day = chosenDay || quickSlot?.day || '';
  const time = chosenTime || quickSlot?.time || '';

  if (!p) return (
    <Page>
      <h1>{t('Therapist not found', 'ባለሙያው አልተገኘም')}</h1>
      <Link href="/therapists">{t('Back to directory', 'ወደ ዝርዝር')}</Link>
    </Page>
  );

  return (
    <Page>
      <DemoNote />
      <div className="booking-trail">
        <Link href="/therapists">{t('01 Therapist', '01 ባለሙያ')}</Link>
        <strong>{t('02 Appointment', '02 ቀጠሮ')}</strong>
        <span>{t('03 Review', '03 ግምገማ')}</span>
      </div>

      {isQuick && day && time && (
        <div style={{ background: 'var(--ink)', color: 'var(--paper)', padding: '14px 20px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '14px' }}>
            ⚡ {t('Quick book: first available slot pre-selected below. Confirm when ready.', 'ፈጣን ቀጠሮ: የመጀመሪያው ሰዓት ተመርጧል። ዝግጁ ሲሆኑ ያረጋግጡ።')}
          </span>
        </div>
      )}

      <h1>{t('Make time for yourself.', 'ለራስዎ ጊዜ ይስጡ።')}</h1>

      <div className="booking-person">
        <Photo id={id} name={p.name} />
        <div>
          <h3>{p.name}</h3>
          <p>{p.title}</p>
        </div>
        <div className="segmented">
          {(['online', 'inperson'] as const).map(s => (
            <button key={s} aria-pressed={medium === s} onClick={() => setMedium(s)}>
              {s === 'online' ? '💻 ' + t('Video', 'ቪዲዮ') : '🏥 ' + t('In person', 'በአካል')}
            </button>
          ))}
        </div>
      </div>

      {/* Pricing summary both modes */}
      <div style={{ display: 'flex', gap: '12px', margin: '16px 0', flexWrap: 'wrap' }}>
        <div style={{ border: `3px solid ${medium === 'online' ? 'var(--ink)' : 'var(--rule-soft)'}`, padding: '12px 18px', minWidth: '160px' }}>
          <small style={{ display: 'block', fontFamily: 'Space Mono,monospace', fontSize: '10px', textTransform: 'uppercase', marginBottom: '4px' }}>💻 {t('Online', 'ኦንላይን')}</small>
          <strong style={{ fontSize: '22px' }}>{money(discountedPrice(conf.online, conf.discount))}</strong>
        </div>
        <div style={{ border: `3px solid ${medium === 'inperson' ? 'var(--ink)' : 'var(--rule-soft)'}`, padding: '12px 18px', minWidth: '160px' }}>
          <small style={{ display: 'block', fontFamily: 'Space Mono,monospace', fontSize: '10px', textTransform: 'uppercase', marginBottom: '4px' }}>🏥 {t('In-person', 'በአካል')}</small>
          <strong style={{ fontSize: '22px' }}>{money(discountedPrice(conf.inperson, conf.discount))}</strong>
        </div>
      </div>

      <p className="muted">{t('60-minute sessions · Addis Ababa time (UTC+3)', '60 ደቂቃ ቀጠሮዎች · አዲስ አበባ ሰዓት (UTC+3)')}</p>

      <section className="booking-calendar">
        <div className="calendar-controls">
          <button disabled={!offset} onClick={() => setOffset(n => n - 1)}>{t('← Previous', '← ቀዳሚ')}</button>
          <strong>{date(days[0])} — {date(days[6])}</strong>
          <button disabled={offset >= 8} onClick={() => setOffset(n => n + 1)}>{t('Next →', 'ቀጣይ →')}</button>
        </div>
        <div className="booking-days">
          {days.map(d => (
            <button key={d}
              disabled={!conf.days.includes(new Date(`${d}T12:00`).getDay())}
              aria-pressed={day === d}
              onClick={() => { setDay(d); setTime(''); }}>
              <small>{date(`${d}T12:00`, { weekday: 'short' })}</small>
              <strong>{date(`${d}T12:00`, { day: 'numeric' })}</strong>
            </button>
          ))}
        </div>
        <div className="time-options">
          {day ? (
            <>
              <h3>{date(`${day}T12:00`, { weekday: 'long', month: 'long', day: 'numeric' })}</h3>
              <div className="slot-grid">
                {slots(conf.start, conf.end).map(s => (
                  <button key={s} disabled={!available(day, s)} aria-pressed={time === s} onClick={() => setTime(s)}>{s}</button>
                ))}
              </div>
            </>
          ) : (
            <p>{t('Select a day to see available times.', 'ያሉትን ሰዓቶች ለማየት ቀን ይምረጡ።')}</p>
          )}
        </div>
      </section>

      <div className="checkout-summary">
        <div>
          <h3>{money(discountedPrice(medium === 'online' ? conf.online : conf.inperson, conf.discount))}</h3>
          <p>{t('Per 60-minute session', 'በ60 ደቂቃ ቀጠሮ')}{conf.discount > 0 && ` · ${conf.discount}% ${t('discount', 'ቅናሽ')}`}</p>
          {day && time && <p style={{ margin: '4px 0', fontSize: '13px', fontWeight: 600 }}>📅 {date(`${day}T12:00`)} · {time}</p>}
        </div>
        <p>{t('Complete your details below to request this session. Payment is not collected here.', 'ቀጠሮ ለመጠየቅ ከታች ዝርዝሮችዎን ይሙሉ።')}</p>
      </div>
      <BookingDetails therapist={id} day={day} time={time} medium={medium} available={!!day && !!time && available(day, time)} />
    </Page>
  );
}

export default function Schedule() {
  return <Suspense><ScheduleInner /></Suspense>;
}
