'use client';

import Link from 'next/link';
import { useState } from 'react';
import { usePlatform, statusLabel } from '@/components/Platform';
import { Page, DemoNote, Modal, Photo } from '@/components/Shell';

export default function Appointments() {
  const { t, state, people, date, money, updateAppointment } = usePlatform();
  const [cancel, setCancel] = useState<string | null>(null);

  const sortedAppointments = state.appointments
    .slice()
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

  return (
    <Page>
      <DemoNote />
      <span className="eyebrow">{t('YOUR CARE, IN ONE PLACE', 'እንክብካቤዎ በአንድ ቦታ')}</span>
      <h1>{t('My bookings.', 'ቀጠሮዎቼ።')}</h1>

      {!sortedAppointments.length ? (
        <div className="empty-state">
          <p>
            {t(
              'No appointments yet. Find a therapist and choose a time that works for you.',
              'እስካሁን ቀጠሮ የለም። ባለሙያ ፈልገው የሚመችዎትን ሰዓት ይምረጡ።'
            )}
          </p>
          <Link className="solid" href="/therapists">
            {t('Find a therapist', 'ባለሙያ ፈልግ')}
          </Link>
        </div>
      ) : (
        <div className="appointments-list-container">
          {sortedAppointments.map(a => {
            const therapist = people.find(p => p.id === a.therapist);

            return (
              <article className="booking-row" key={a.id}>
                <div className="booking-card-main">
                  {therapist && (
                    <div className="booking-avatar-col">
                      <Photo id={therapist.id} name={therapist.name} />
                    </div>
                  )}
                  <div className="booking-info-col">
                    <div className="booking-status-badge-wrap">
                      <span className={`status ${a.status}`}>{statusLabel(a.status, t)}</span>
                      <span className="booking-medium-badge">
                        {a.medium === 'online' ? '💻 ' + t('Video Consultation', 'ቪዲዮ ውይይት') : '🏥 ' + t('In-person Office', 'በአካል ቀጠሮ')}
                      </span>
                    </div>

                    <h3>{therapist?.name || t('Professional', 'ባለሙያ')}</h3>
                    <p className="booking-schedule-time">
                      📅 <strong>{date(`${a.date}T12:00`)}</strong> · ⏰ <strong>{a.time}</strong> (UTC+3)
                    </p>
                    <p className="booking-client-name">
                      👤 {t('Client', 'ደንበኛ')}: <span>{a.client}</span>
                    </p>
                    <div className="booking-price-tag">
                      <strong>{money(a.price)}</strong>
                    </div>
                  </div>
                </div>

                <div className="stack-actions">
                  <Link className="booking-msg-btn" href={`/chat?therapist=${a.therapist}`}>
                    💬 {t('Message therapist', 'ለባለሙያው መልዕክት ላክ')}
                  </Link>
                  {(a.status === 'pending' || a.status === 'confirmed') && (
                    <button
                      type="button"
                      className="booking-cancel-btn"
                      onClick={() => setCancel(a.id)}
                    >
                      ✕ {t('Cancel booking', 'ቀጠሮ ሰርዝ')}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <div className="receipts-section">
        <h2>{t('Package receipts', 'የጥቅል ደረሰኞች')}</h2>
        {!state.receipts.length ? (
          <p className="muted">{t('Your payment receipts will appear here once online payments are available.', 'የማሳያ ግዢዎችዎ እዚህ ይታያሉ።')}</p>
        ) : (
          <div className="receipts-list">
            {state.receipts.map(r => {
              const th = people.find(p => p.id === r.therapist);
              return (
                <div className="receipt-row" key={r.id}>
                  <div className="receipt-details">
                    <strong>{th?.name || t('Therapist Package', 'የባለሙያ ጥቅል')}</strong>
                    <small>
                      {date(r.at)} · {t('Receipt', 'የማሳያ ደረሰኝ')} #{r.id.slice(0, 8)}
                    </small>
                  </div>
                  <strong className="receipt-amount">{money(r.amount)}</strong>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {cancel && (
        <Modal title={t('Cancel this appointment?', 'ይህን የማሳያ ቀጠሮ ይሰርዙ?')} close={() => setCancel(null)}>
          <p>
            {t(
              'The time slot will become available again. Your therapist will see the cancellation.',
              'ይህ ሰዓት እንደገና ሊያዝ ይችላል። በዚህ ማሳያ የስረዛ ክፍያ የለም።'
            )}
          </p>
          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            <button
              className="solid"
              onClick={() => {
                updateAppointment(cancel, { status: 'cancelled' });
                setCancel(null);
              }}
            >
              {t('Confirm cancellation', 'ስረዛውን አረጋግጥ')}
            </button>
            <button type="button" onClick={() => setCancel(null)}>
              {t('Keep appointment', 'ቀጠሮው ይቆይ')}
            </button>
          </div>
        </Modal>
      )}
    </Page>
  );
}
