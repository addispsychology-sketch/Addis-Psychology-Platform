'use client';
import { useState } from 'react';
import { usePlatform } from './Platform';
import { Photo } from './Shell';
import PhotoUpload from './PhotoUpload';

const DAY_LABELS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const AM_DAY_LABELS = ['እሑድ','ሰኞ','ማክሰኞ','ረቡዕ','ሐሙስ','ዓርብ','ቅዳሜ'];

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
          <h3>{t('Session pricing','የቀጠሮ ዋጋ')}</h3>
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
          <p className="notice">{t('Discounts apply to new sessions and message packages. Existing bookings stay unchanged.','ቅናሾች ለአዲስ ቀጠሮዎችና ጥቅሎች ይሠራሉ።')}</p>

          {/* ── Session working days & hours ── */}
          <h3>{t('Session availability','የቀጠሮ ቀናት')}</h3>
          <div className="day-toggles">
            {DAY_LABELS.map((d, i) => (
              <button type="button" key={d} aria-pressed={form.days.includes(i)}
                onClick={() => setForm(f => ({ ...f, days: f.days.includes(i) ? f.days.filter(n => n !== i) : [...f.days, i] }))}>
                {t(d, AM_DAY_LABELS[i])}
              </button>
            ))}
          </div>
          <div className="field-grid">
            <label>
              {t('Session start (UTC+3)','ቀጠሮ መጀመሪያ (UTC+3)')}
              <select value={form.start} onChange={e => setForm(f => ({ ...f, start: e.target.value }))}>
                {Array.from({ length: 16 }, (_, i) => `${String(i + 6).padStart(2, '0')}:00`).map(s => <option key={s}>{s}</option>)}
              </select>
            </label>
            <label>
              {t('Session end (UTC+3)','ቀጠሮ ማብቂያ (UTC+3)')}
              <select value={form.end} onChange={e => setForm(f => ({ ...f, end: e.target.value }))}>
                {Array.from({ length: 16 }, (_, i) => `${String(i + 7).padStart(2, '0')}:00`).map(s => <option key={s}>{s}</option>)}
              </select>
            </label>
            <label>
              {t('Availability status','የመገኘት ሁኔታ')}
              <select value={form.presence} onChange={e => setForm(f => ({ ...f, presence: e.target.value as typeof form.presence }))}>
                <option value="available">{t('Online · available','በመስመር ላይ · ዝግጁ')}</option>
                <option value="busy">{t('Online · in session','በቀጠሮ ላይ')}</option>
                <option value="offline">{t('Offline','ከመስመር ውጭ')}</option>
              </select>
            </label>
          </div>

          {/* ── Chat/messaging hours ── */}
          <h3>{t('Chat & messaging hours','የቻት ሰዓቶች')}</h3>
          <div className="chat-hours-info">
            {t('Set the days and hours when clients can expect you to read and reply to messages. This is shown to clients before they start chatting.','ደንበኞች መልዕክቶቻቸው የሚነበቡበትንና ምላሽ የሚሰጥባቸውን ቀናትና ሰዓቶች ያስቀምጡ። ይህ ቻት ከመጀመሩ በፊት ለደንበኞቹ ይታያል።')}
          </div>
          <p style={{fontSize:'13px',margin:'0 0 12px',color:'var(--muted-text)'}}>{t('Chat days (when you check & reply to messages)','የቻት ቀናት')}</p>
          <div className="day-toggles">
            {DAY_LABELS.map((d, i) => (
              <button type="button" key={`chat-${d}`} aria-pressed={form.chatDays.includes(i)}
                onClick={() => setForm(f => ({ ...f, chatDays: f.chatDays.includes(i) ? f.chatDays.filter(n => n !== i) : [...f.chatDays, i] }))}>
                {t(d, AM_DAY_LABELS[i])}
              </button>
            ))}
          </div>
          <div className="field-grid">
            <label>
              {t('Chat start (UTC+3)','ቻት መጀመሪያ (UTC+3)')}
              <select value={form.chatStart} onChange={e => setForm(f => ({ ...f, chatStart: e.target.value }))}>
                {Array.from({ length: 20 }, (_, i) => `${String(i + 5).padStart(2, '0')}:00`).map(s => <option key={s}>{s}</option>)}
              </select>
            </label>
            <label>
              {t('Chat end (UTC+3)','ቻት ማብቂያ (UTC+3)')}
              <select value={form.chatEnd} onChange={e => setForm(f => ({ ...f, chatEnd: e.target.value }))}>
                {Array.from({ length: 20 }, (_, i) => `${String(i + 6).padStart(2, '0')}:00`).map(s => <option key={s}>{s}</option>)}
              </select>
            </label>
          </div>
          <p className="muted" style={{fontSize:'13px'}}>{t('Example: Mon–Fri 08:00–21:00 means clients will see "replies expected during those hours".','ምሳሌ: ሰኞ–ዓርብ 08:00–21:00 ማለት ደንበኞቹ "ምላሽ በዚያ ሰዓት ይጠበቃል" ሲሉ ያያሉ።')}</p>
        </>
      )}

      {notice && <p role="status" className="notice">{notice}</p>}
      <button className="solid" type="submit">{t('Save changes','ለውጦችን አስቀምጥ')}</button>
    </form>
  );
}
