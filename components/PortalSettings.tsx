'use client';
import { useState } from 'react';
import { usePlatform } from './Platform';
import { Photo } from './Shell';
import PhotoUpload from './PhotoUpload';

const WEEK_DAYS = [
  { index: 1, en: 'Monday', short: 'Mon', am: 'ሰኞ' },
  { index: 2, en: 'Tuesday', short: 'Tue', am: 'ማክሰኞ' },
  { index: 3, en: 'Wednesday', short: 'Wed', am: 'ረቡዕ' },
  { index: 4, en: 'Thursday', short: 'Thu', am: 'ሐሙስ' },
  { index: 5, en: 'Friday', short: 'Fri', am: 'ዓርብ' },
  { index: 6, en: 'Saturday', short: 'Sat', am: 'ቅዳሜ' },
  { index: 0, en: 'Sunday', short: 'Sun', am: 'እሑድ' },
];

function WeekScheduleGrid({
  title,
  subtitle,
  activeDays,
  startTime,
  endTime,
  onChangeDays,
  onChangeStartTime,
  onChangeEndTime,
  t,
}: {
  title: string;
  subtitle?: string;
  activeDays: number[];
  startTime: string;
  endTime: string;
  onChangeDays: (days: number[]) => void;
  onChangeStartTime: (s: string) => void;
  onChangeEndTime: (e: string) => void;
  t: (en: string, am: string) => string;
}) {
  const startH = parseInt(startTime.split(':')[0], 10) || 9;
  const endH = parseInt(endTime.split(':')[0], 10) || 17;
  const hoursPerDay = Math.max(0, endH - startH);
  const totalWeeklyHours = hoursPerDay * activeDays.length;

  const toggleDay = (dayIndex: number) => {
    if (activeDays.includes(dayIndex)) {
      onChangeDays(activeDays.filter(d => d !== dayIndex));
    } else {
      onChangeDays([...activeDays, dayIndex]);
    }
  };

  return (
    <div className="week-schedule-container" style={{ margin: '20px 0 32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '18px', letterSpacing: '-0.3px' }}>{title}</h3>
          {subtitle && <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--muted-text)' }}>{subtitle}</p>}
        </div>
        <div style={{ fontSize: '12px', background: 'var(--surface-soft, rgba(0,0,0,0.04))', border: '1px solid var(--rule-soft, #e0e0e0)', padding: '4px 10px', borderRadius: '4px' }}>
          <strong>{hoursPerDay} {t('hrs / active day', 'ሰዓት / ቀን')}</strong> · {totalWeeklyHours} {t('hrs / week', 'ሰዓት በሳምንት')} ({activeDays.length} {t('days active', 'ቀናት')})
        </div>
      </div>

      {/* Quick presets toolbar */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', margin: '10px 0 14px' }}>
        <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted-text)', alignSelf: 'center', marginRight: '4px' }}>
          {t('Presets:', 'አቋራጮች:')}
        </span>
        <button
          type="button"
          onClick={() => onChangeDays([1, 2, 3, 4, 5])}
          style={{ fontSize: '11px', padding: '4px 10px', background: 'transparent', border: '1px solid var(--rule-soft, #ccc)' }}
        >
          {t('Weekdays (Mon–Fri)', 'የሥራ ቀናት (ሰኞ–ዓርብ)')}
        </button>
        <button
          type="button"
          onClick={() => onChangeDays([0, 1, 2, 3, 4, 5, 6])}
          style={{ fontSize: '11px', padding: '4px 10px', background: 'transparent', border: '1px solid var(--rule-soft, #ccc)' }}
        >
          {t('All 7 Days', 'ሙሉ ሳምንት (7 ቀናት)')}
        </button>
        <button
          type="button"
          onClick={() => onChangeDays([0, 6])}
          style={{ fontSize: '11px', padding: '4px 10px', background: 'transparent', border: '1px solid var(--rule-soft, #ccc)' }}
        >
          {t('Weekends (Sat–Sun)', 'ቅዳሜና እሑድ')}
        </button>
        <button
          type="button"
          onClick={() => { onChangeStartTime('09:00'); onChangeEndTime('17:00'); }}
          style={{ fontSize: '11px', padding: '4px 10px', background: 'transparent', border: '1px solid var(--rule-soft, #ccc)' }}
        >
          {t('09:00–17:00 (Standard)', '09:00–17:00 (መደበኛ)')}
        </button>
        <button
          type="button"
          onClick={() => { onChangeStartTime('08:00'); onChangeEndTime('13:00'); }}
          style={{ fontSize: '11px', padding: '4px 10px', background: 'transparent', border: '1px solid var(--rule-soft, #ccc)' }}
        >
          {t('08:00–13:00 (Morning)', '08:00–13:00 (ጧት)')}
        </button>
        <button
          type="button"
          onClick={() => { onChangeStartTime('14:00'); onChangeEndTime('20:00'); }}
          style={{ fontSize: '11px', padding: '4px 10px', background: 'transparent', border: '1px solid var(--rule-soft, #ccc)' }}
        >
          {t('14:00–20:00 (Evening)', '14:00–20:00 (ከሰዓት)')}
        </button>
      </div>

      {/* 7-Day Week Cards Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(105px, 1fr))',
          gap: '8px',
          marginBottom: '16px',
        }}
      >
        {WEEK_DAYS.map(day => {
          const isActive = activeDays.includes(day.index);
          return (
            <div
              key={day.index}
              onClick={() => toggleDay(day.index)}
              role="button"
              tabIndex={0}
              onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggleDay(day.index); } }}
              aria-pressed={isActive}
              style={{
                cursor: 'pointer',
                padding: '12px 10px',
                border: isActive ? '2px solid var(--ink)' : '1px solid var(--rule-soft, #e0e0e0)',
                background: isActive ? 'var(--accent-soft, #fffdf2)' : 'var(--surface, #ffffff)',
                boxShadow: isActive ? '2px 2px 0 var(--ink)' : 'none',
                transition: 'all 0.15s ease',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                minHeight: '105px',
                userSelect: 'none',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}>
                  {t(day.short, day.am)}
                </span>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    padding: '1px 5px',
                    borderRadius: '2px',
                    background: isActive ? 'var(--ink)' : '#e0e0e0',
                    color: isActive ? 'var(--paper)' : '#666',
                  }}
                >
                  {isActive ? t('ON', 'ክፍት') : t('OFF', 'ዝግ')}
                </span>
              </div>

              <div style={{ margin: '8px 0 4px' }}>
                <span style={{ fontSize: '13px', fontWeight: isActive ? 700 : 500, color: isActive ? 'var(--text)' : 'var(--muted-text)' }}>
                  {t(day.en, day.am)}
                </span>
              </div>

              <div style={{ fontSize: '10px', fontFamily: 'Space Mono, monospace', color: isActive ? 'var(--ink)' : 'var(--muted-text)' }}>
                {isActive ? `${startTime}–${endTime}` : t('Unavailable', 'አይገኝም')}
              </div>

              {/* Mini visual active timeline bar */}
              <div
                style={{
                  height: '4px',
                  width: '100%',
                  background: isActive ? 'var(--ink)' : '#ececec',
                  marginTop: '6px',
                  borderRadius: '1px',
                }}
              />
            </div>
          );
        })}
      </div>

      {/* Time Range Slot Controls */}
      <div className="field-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <label>
          {t('Start Time slot (UTC+3 / EAT)', 'መጀመሪያ ሰዓት (UTC+3)')}
          <select value={startTime} onChange={e => onChangeStartTime(e.target.value)}>
            {Array.from({ length: 17 }, (_, i) => `${String(i + 5).padStart(2, '0')}:00`).map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
        <label>
          {t('End Time slot (UTC+3 / EAT)', 'ማብቂያ ሰዓት (UTC+3)')}
          <select value={endTime} onChange={e => onChangeEndTime(e.target.value)}>
            {Array.from({ length: 17 }, (_, i) => `${String(i + 6).padStart(2, '0')}:00`).map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}

export default function PortalSettings({ id, profile = false }: { id: number; profile?: boolean }) {
  const { t, settings, updateSettings, people } = usePlatform();
  const [form, setForm] = useState(settings(id));
  const [notice, setNotice] = useState('');
  const person = people.find(p => p.id === id)!;

  async function submit() {
    const chatStartH = Number(form.chatStart.split(':')[0]);
    const chatEndH = Number(form.chatEnd.split(':')[0]);
    if (
      !Number.isFinite(form.online) || !Number.isFinite(form.inperson) ||
      form.online < 100 || form.inperson < 100 || form.online > 100000 || form.inperson > 100000 ||
      form.discount < 0 || form.discount > 50 || !Number.isInteger(form.discount) ||
      !form.days.length || form.start >= form.end ||
      !form.chatDays.length || chatStartH >= chatEndH
    ) {
      setNotice(t(
        'Use prices 100–100,000 ETB, discount 0–50%, at least one working day and chat day, and end times after start.',
        'ከ100–100,000 ብር ዋጋ፣ ከ0–50% ቅናሽ፣ ቢያንስ አንድ ቀን ያስፈልጋል።'
      ));
      return;
    }
    if (!await updateSettings(id, form)) { setNotice('Could not save. Please try again.'); return; }
    setNotice(t(
      'Saved. Directory, booking calendar, chat hours, and checkouts now use these settings.',
      'ተቀምጧል። ዝርዝሩ፣ ሰሌዳው፣ የቻት ሰዓቶቹና ግዢዎቹ ተዘምነዋል።'
    ));
  }

  return (
    <form className="portal-form" noValidate onSubmit={e => { e.preventDefault(); submit(); }}>
      {profile ? (
        <>
          <h2>{t('Your profile photo.','የመገለጫ ፎቶዎ።')}</h2>
          <div className="profile-detail">
            <Photo id={id} src={form.photo} name={person.name} large />
            <div>
              <h3>{person.name}</h3>
              <p>{person.title}</p>
              <PhotoUpload value={form.photo || ''} onChange={photo => setForm(f => ({ ...f, photo }))} />
              <p>{t('Uploaded photos appear in the directory and profile after saving. Contact the project owner to update reviewed credentials.','ፎቶዎቹ ከተቀመጡ በኋላ ይታያሉ።')}</p>
            </div>
          </div>
        </>
      ) : (
        <>
          <h2>{t('Set your rhythm.','የሥራ ሁኔታዎን ያስተካክሉ።')}</h2>

          {/* ── Session pricing ── */}
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '18px', margin: '0 0 6px' }}>{t('Session pricing','የቀጠሮ ዋጋ')}</h3>
            <p style={{ margin: '0 0 14px', fontSize: '13px', color: 'var(--muted-text)' }}>
              {t('Set your standard rates for individual therapy consultations.', 'ለመደበኛ የቀጠሮ ምክክር ክፍያዎችዎን ይወስኑ።')}
            </p>
            <div className="field-grid">
              <label>
                {t('Video session · ETB','የቪዲዮ ቀጠሮ · ብር')}
                <input type="number" min={100} max={100000} value={form.online} onChange={e => setForm(f => ({ ...f, online: Number(e.target.value) }))} />
              </label>
              <label>
                {t('In-person session · ETB','የአካል ቀጠሮ · ብር')}
                <input type="number" min={100} max={100000} value={form.inperson} onChange={e => setForm(f => ({ ...f, inperson: Number(e.target.value) }))} />
              </label>
              <label>
                {t('Discount · %','ቅናሽ · %')}
                <input type="number" min={0} max={50} value={form.discount} onChange={e => setForm(f => ({ ...f, discount: Number(e.target.value) }))} />
              </label>
            </div>
            <p className="notice" style={{ marginTop: '8px' }}>
              {t('Discounts apply to new sessions and message packages. Existing bookings stay unchanged.','ቅናሾች ለአዲስ ቀጠሮዎችና ጥቅሎች ይሠራሉ።')}
            </p>
          </div>

          {/* ── Presence status ── */}
          <div style={{ marginBottom: '24px', padding: '16px', border: '1px solid var(--rule-soft, #e0e0e0)', background: 'var(--surface-soft, rgba(0,0,0,0.02))' }}>
            <label style={{ display: 'block', fontWeight: 700, fontSize: '13px', marginBottom: '6px' }}>
              {t('Live Presence Status on Public Directory', 'በመረጃ ቋት ላይ የሚታይ የመገኘት ሁኔታ')}
            </label>
            <select
              value={form.presence}
              onChange={e => setForm(f => ({ ...f, presence: e.target.value as typeof form.presence }))}
              style={{ maxWidth: '340px' }}
            >
              <option value="available">🟢 {t('Online · available for sessions & messages', 'በመስመር ላይ · ዝግጁ')}</option>
              <option value="busy">🟡 {t('Online · currently in session', 'በቀጠሮ ላይ')}</option>
              <option value="offline">⚪ {t('Offline · away until scheduled hours', 'ከመስመር ውጭ')}</option>
            </select>
          </div>

          {/* ── Week View Schedule: Live Sessions ── */}
          <WeekScheduleGrid
            title={t('Live 1-on-1 Session Availability', 'የቀጥታ ቀጠሮ ሳምንታዊ ሰሌዳ')}
            subtitle={t(
              'Select which days of the week and hours you accept booking appointments for video and in-person sessions.',
              'ለቪዲዮ እና ለአካል ቀጠሮዎች በየትኞቹ የሳምንቱ ቀናትና ሰዓታት ክፍት እንደሆኑ ይምረጡ።'
            )}
            activeDays={form.days}
            startTime={form.start}
            endTime={form.end}
            onChangeDays={days => setForm(f => ({ ...f, days }))}
            onChangeStartTime={start => setForm(f => ({ ...f, start }))}
            onChangeEndTime={end => setForm(f => ({ ...f, end }))}
            t={t}
          />

          {/* ── Week View Schedule: Chat & Messaging Response Hours ── */}
          <WeekScheduleGrid
            title={t('Chat & Messaging Response Hours', 'የቻትና የመልዕክት ምላሽ ሰዓቶች')}
            subtitle={t(
              'Specify when clients can expect you to read and reply to text messages and voice notes. Displayed on your chat sanctuary.',
              'ደንበኞች የላኩትን መልዕክት አንብበው ምላሽ የሚሰጡባቸውን ቀናትና ሰዓቶች ያስቀምጡ። በቻት ገጽዎ ላይ ይታያል።'
            )}
            activeDays={form.chatDays}
            startTime={form.chatStart}
            endTime={form.chatEnd}
            onChangeDays={chatDays => setForm(f => ({ ...f, chatDays }))}
            onChangeStartTime={chatStart => setForm(f => ({ ...f, chatStart }))}
            onChangeEndTime={chatEnd => setForm(f => ({ ...f, chatEnd }))}
            t={t}
          />
        </>
      )}

      {notice && <p role="status" className="notice" style={{ margin: '16px 0' }}>{notice}</p>}
      <button className="solid" type="submit" style={{ padding: '12px 28px', fontSize: '15px' }}>
        {t('Save changes','ለውጦችን አስቀምጥ')}
      </button>
    </form>
  );
}
