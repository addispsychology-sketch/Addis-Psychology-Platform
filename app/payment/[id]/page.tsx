'use client';

import { Suspense, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { usePlatform } from '@/components/Platform';
import { Page, DemoNote, Photo } from '@/components/Shell';
import { isFutureSlot, slots } from '@/lib/calendar';
import { discountedPrice } from '@/lib/commerce';

function Review() {
  const params = useParams();
  const q = useSearchParams();
  const { t, people, settings, book, date, money } = usePlatform();
  const id = Number(params.id);
  const p = people.find(p => p.id === id);
  const day = q.get('date') || '';
  const time = q.get('time') || '';
  const medium = q.get('type') === 'inperson' ? 'inperson' : 'online';
  const conf = settings(id);
  const [name, setName] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const price = discountedPrice(medium === 'online' ? conf.online : conf.inperson, conf.discount);

  const valid =
    p &&
    /^\d{4}-\d{2}-\d{2}$/.test(day) &&
    slots(conf.start, conf.end).includes(time) &&
    isFutureSlot(day, time) &&
    conf.days.includes(new Date(`${day}T12:00`).getDay());

  if (!valid) {
    return (
      <Page>
        <h1>{t('Choose an appointment first.', 'መጀመሪያ ቀጠሮ ይምረጡ።')}</h1>
        <p className="muted">
          {t(
            'No valid appointment slot was selected. Please choose an open day and time.',
            'ትክክለኛ የቀጠሮ ሰዓት አልተመረጠም። እባክዎ ክፍት ቀንና ሰዓት ይምረጡ።'
          )}
        </p>
        <Link className="solid" href={p ? `/schedule/${id}` : '/therapists'}>
          {t('Choose a time', 'ሰዓት ይምረጡ')}
        </Link>
      </Page>
    );
  }

  return (
    <Page>
      <DemoNote />
      <span className="eyebrow">{t('03 / REVIEW YOUR APPOINTMENT', '03 / ቀጠሮዎን ይገምግሙ')}</span>
      <h1>{done ? t('Request confirmed.', 'ጥያቄው ተረጋግጧል።') : t('Confirm your session.', 'ቀጠሮዎን ያረጋግጡ።')}</h1>

      {done ? (
        <div className="notice confirmed-booking-box">
          <span style={{ fontSize: '32px', display: 'block', marginBottom: '8px' }}>✓</span>
          <h3>{t('Demo booking saved successfully!', 'የማሳያ ቀጠሮዎ ተቀምጧል!')}</h3>
          <p>
            {t(
              'Your demo request is now saved in My bookings and the therapist portal. No real appointment has been arranged and no live payment was taken.',
              'የማሳያ ጥያቄዎ በቀጠሮዎቼና በባለሙያ ፖርታል ውስጥ ይታያል። እውነተኛ ቀጠሮ አልተያዘም፣ ክፍያም አልተወሰደም።'
            )}
          </p>
          <div style={{ marginTop: '20px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <Link className="solid" href="/appointments">
              {t('View my bookings', 'ቀጠሮዎቼን አሳይ')}
            </Link>
            <Link href={`/chat?therapist=${id}`}>
              {t('Message therapist now →', 'ለባለሙያው መልዕክት ላክ →')}
            </Link>
          </div>
        </div>
      ) : (
        <form
          className="review-appointment-form"
          onSubmit={e => {
            e.preventDefault();
            if (
              book({
                therapist: id,
                date: day,
                time,
                medium,
                price,
                client: name.trim() || 'demo-client',
              })
            ) {
              setDone(true);
            } else {
              setError(
                t(
                  'This time was just booked. Please choose another time.',
                  'ይህ ሰዓት አሁን ተይዟል። ሌላ ሰዓት ይምረጡ።'
                )
              );
            }
          }}
        >
          <div className="review-therapist-banner">
            <Photo id={id} name={p.name} />
            <div>
              <h3>{p.name}</h3>
              <p>{p.title}</p>
            </div>
          </div>

          <dl className="summary-list">
            <div>
              <dt>{t('Therapist', 'ባለሙያ')}</dt>
              <dd>{p.name}</dd>
            </div>
            <div>
              <dt>{t('Date & time', 'ቀንና ሰዓት')}</dt>
              <dd>
                {date(`${day}T12:00`)} · {time} (UTC+3)
              </dd>
            </div>
            <div>
              <dt>{t('Session format', 'የቀጠሮ አይነት')}</dt>
              <dd>
                {medium === 'online'
                  ? '💻 ' + t('Private Video Consultation (60 mins)', 'የቪዲዮ ውይይት (60 ደቂቃ)')
                  : '🏥 ' + t('In-person Office Visit (60 mins)', 'በአካል ቀጠሮ (60 ደቂቃ)')}
              </dd>
            </div>
            <div>
              <dt>{t('Total fee', 'ጠቅላላ ክፍያ')}</dt>
              <dd className="highlight-price">{money(price)}</dd>
            </div>
          </dl>

          <label className="demo-client-input-label">
            {t('Your Name (for demo booking)', 'የእርስዎ ስም (ለማሳያ ቀጠሮ)')}
            <input
              value={name}
              maxLength={60}
              onChange={e => setName(e.target.value)}
              placeholder={t('Your full name', 'ሙሉ ስምዎ')}
            />
          </label>

          <p className="notice demo-disclaimer">
            {t(
              'Session bookings and message packages are separate. This demo request will appear immediately in your bookings without real charge.',
              'የቀጠሮ ምዝገባና የመልዕክት ጥቅል የተለያዩ ናቸው። ይህ የማሳያ ጥያቄ ክፍያ አያስከፍልም።'
            )}
          </p>

          {error && <p role="alert" className="form-error-text">⚠ {error}</p>}

          <div className="form-actions review-actions">
            <Link href={`/schedule/${id}`}>
              ← {t('Change time', 'ሰዓት ቀይር')}
            </Link>
            <button className="solid" type="submit">
              {t('Confirm demo booking →', 'የማሳያ ቀጠሮውን አረጋግጥ →')}
            </button>
          </div>
        </form>
      )}
    </Page>
  );
}

export default function PaymentPage() {
  return (
    <Suspense>
      <Review />
    </Suspense>
  );
}
