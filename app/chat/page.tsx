'use client';
import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { usePlatform } from '@/components/Platform';
import { Header, Presence, Photo, Modal } from '@/components/Shell';
import { bundles, discountedPrice } from '@/lib/commerce';

const DAY_NAMES_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const AM_DAY_NAMES = ['እሑድ', 'ሰኞ', 'ማክሰኞ', 'ረቡዕ', 'ሐሙስ', 'ዓርብ', 'ቅዳሜ'];

function ChatMessenger() {
  const { t, people, balance, messages, send, lang, settings, money, buy } = usePlatform();
  const params = useSearchParams();
  const initialId = Number(params.get('therapist') || 1);
  const [selectedId, setSelectedId] = useState(people.some(p => p.id === initialId) ? initialId : 1);
  const [showMobileList, setShowMobileList] = useState(!params.get('therapist'));
  const [searchQuery, setSearchQuery] = useState('');
  const [inputText, setInputText] = useState('');
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [draftAudio, setDraftAudio] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [permissionPending, setPermissionPending] = useState(false);
  const [quickPackageModal, setQuickPackageModal] = useState(false);

  const sendingAudio = useRef(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const alive = useRef(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activePerson = people.find(p => p.id === selectedId) || people[0];
  const credits = balance(selectedId);
  const thread = messages.filter(m => m.therapist === selectedId);
  const hasCredits = credits.texts + credits.voices > 0;

  const s = settings(selectedId);
  const now = new Date();
  const currentHour = now.getHours();
  const currentDay = now.getDay();
  const chatStartH = Number(s.chatStart.split(':')[0]);
  const chatEndH = Number(s.chatEnd.split(':')[0]);
  const isAvailableNow = s.chatDays.includes(currentDay) && currentHour >= chatStartH && currentHour < chatEndH;

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (timer.current) clearInterval(timer.current);
      if (recorder.current && recorder.current.state === 'recording') {
        recorder.current.onstop = null;
        recorder.current.stop();
      }
      stream.current?.getTracks().forEach(track => track.stop());
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, selectedId]);

  useEffect(() => () => {
    if (draftAudio) URL.revokeObjectURL(draftAudio);
  }, [draftAudio]);

  async function startRecording() {
    setErrorMessage('');
    if (!credits.voices) return;
    setPermissionPending(true);
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') throw Error();
      const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!alive.current) { mediaStream.getTracks().forEach(t => t.stop()); return; }
      stream.current = mediaStream;
      const rec = new MediaRecorder(mediaStream);
      recorder.current = rec;
      const chunks: BlobPart[] = [];
      rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
      rec.onstop = () => {
        if (timer.current) clearInterval(timer.current);
        mediaStream.getTracks().forEach(t => t.stop());
        if (alive.current) {
          setRecording(false);
          if (chunks.length) setDraftAudio(URL.createObjectURL(new Blob(chunks, { type: rec.mimeType })));
        }
      };
      rec.start();
      setRecordSeconds(0);
      setRecording(true);
      let elapsed = 0;
      timer.current = setInterval(() => {
        elapsed++;
        setRecordSeconds(elapsed);
        if (elapsed >= 60 && rec.state === 'recording') rec.stop();
      }, 1000);
    } catch {
      stream.current?.getTracks().forEach(t => t.stop());
      setErrorMessage(t('Microphone access is unavailable. Please grant microphone permissions or send text.', 'ማይክሮፎን አልተገኘም።'));
    } finally {
      if (alive.current) setPermissionPending(false);
    }
  }

  function handleSelectPerson(newId: number) {
    if (recording || permissionPending) return;
    if (draftAudio) URL.revokeObjectURL(draftAudio);
    setDraftAudio('');
    setSelectedId(newId);
    setInputText('');
    setErrorMessage('');
    setShowMobileList(false);
  }

  async function handleSendAudio() {
    if (sendingAudio.current) return;
    sendingAudio.current = true;
    try {
      const blob = await fetch(draftAudio).then(r => r.blob());
      const permanentUrl = URL.createObjectURL(blob);
      if (send(selectedId, 'voice', permanentUrl)) {
        setDraftAudio('');
      } else {
        URL.revokeObjectURL(permanentUrl);
        setErrorMessage(t('No voice credits remaining. Add a package to continue.', 'የድምፅ ክሬዲት አልቋል።'));
      }
    } catch {
      setErrorMessage(t('Could not send recording. Please try again.', 'መላክ አልተቻለም።'));
    } finally {
      sendingAudio.current = false;
    }
  }

  function handleSendText() {
    if (send(selectedId, 'text', inputText.trim())) {
      setInputText('');
      setErrorMessage('');
    } else {
      setErrorMessage(t('A text credit is required. Messages must be 1–2,000 characters.', 'የጽሑፍ ክሬዲት ያስፈልጋል።'));
    }
  }

  function handleInstantBuy(bundleId: string) {
    if (buy(selectedId, bundleId)) {
      setQuickPackageModal(false);
      setErrorMessage('');
    }
  }

  return (
    <>
      <Header />
      <main className={`messenger ${showMobileList ? 'show-list' : ''}`}>

        {/* ── 1. CONVERSATIONS LIST SIDEBAR ── */}
        <aside className="conversation-list">
          <div className="conversation-title">
            <h2>{t('Conversations', 'ውይይቶች')}</h2>
            <small style={{ color: '#555' }}>{t('CONFIDENTIAL ASYNC CARE', 'ሚስጥራዊ ቻት')}</small>
          </div>

          <label className="sr-only" htmlFor="therapist-chat-search">{t('Search therapists', 'ባለሙያ ፈልግ')}</label>
          <input
            id="therapist-chat-search"
            type="search"
            placeholder={t('Search therapists…', 'ባለሙያዎችን ፈልግ…')}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {people
              .filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
              .map(p => {
                const ps = settings(p.id);
                const isSelected = p.id === selectedId;
                const pChatStart = Number(ps.chatStart.split(':')[0]);
                const pChatEnd = Number(ps.chatEnd.split(':')[0]);
                const pIsAvail = ps.chatDays.includes(currentDay) && currentHour >= pChatStart && currentHour < pChatEnd;
                const msgCount = messages.filter(m => m.therapist === p.id).length;

                return (
                  <button
                    className="conversation-item"
                    key={p.id}
                    aria-pressed={isSelected}
                    onClick={() => handleSelectPerson(p.id)}
                  >
                    <Photo id={p.id} name={p.name} />
                    <span style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: 1, minWidth: 0 }}>
                      <strong style={{ fontSize: '13px' }}>{p.name}</strong>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px' }}>
                        <span className={`chat-avail-dot ${pIsAvail ? 'live' : ''}`} />
                        <span style={{ opacity: 0.8 }}>
                          {pIsAvail ? t('Available now', 'አሁን ዝግጁ') : `${ps.chatStart}–${ps.chatEnd}`}
                        </span>
                      </div>
                      {msgCount > 0 && (
                        <small style={{ opacity: 0.7 }}>{msgCount} {t('messages', 'መልዕክቶች')}</small>
                      )}
                    </span>
                  </button>
                );
              })}
          </div>
        </aside>

        {/* ── 2. ACTIVE CHAT THREAD ── */}
        <section className="conversation-panel">
          <header className="conversation-header">
            <button className="mobile-back-btn" onClick={() => setShowMobileList(true)}>
              ← {t('All Chats', 'ሁሉም')}
            </button>
            <Photo id={selectedId} name={activePerson.name} />
            <div>
              <h2>{activePerson.name}</h2>
              <div className="chat-availability-pill">
                <span className={`chat-avail-dot ${isAvailableNow ? 'live' : ''}`} />
                {isAvailableNow ? (
                  <strong style={{ color: '#006500' }}>
                    {t('Available now for messages', 'አሁን ለመልዕክት ዝግጁ ናቸው')} · {t(`until ${s.chatEnd}`, `እስከ ${s.chatEnd}`)}
                  </strong>
                ) : (
                  <span>
                    {t(`Replies during chat hours (${s.chatStart}–${s.chatEnd})`, `በቻት ሰዓት (${s.chatStart}–${s.chatEnd}) ምላሽ ይሰጣል`)}
                  </span>
                )}
              </div>
            </div>

            <button
              onClick={() => setQuickPackageModal(true)}
              style={{ fontSize: '11px', padding: '7px 12px', flexShrink: 0 }}
            >
              + {t('Add Credits', 'ክሬዲት ጨምር')}
            </button>
          </header>

          {/* Balance & info bar */}
          <div className="balance-bar">
            <span>
              <strong>{credits.texts}</strong> {t('texts', 'ጽሑፍ')} &nbsp;·&nbsp;
              <strong>{credits.voices}</strong> {t('voice notes', 'ድምፅ')}
            </span>
            {!hasCredits ? (
              <button
                onClick={() => setQuickPackageModal(true)}
                style={{ background: 'none', border: 'none', padding: 0, textDecoration: 'underline', cursor: 'pointer', fontSize: '11px' }}
              >
                {t('Purchase credits to begin chatting →', 'ለመወያየት ጥቅል ይግዙ →')}
              </button>
            ) : (
              <span style={{ color: '#666' }}>{t('Async messaging · private on your device', 'ሚስጥራዊ ውይይት')}</span>
            )}
          </div>

          {/* Message Thread History */}
          <div className="message-history" aria-label={t('Chat message history', 'የመልዕክት ታሪክ')}>
            {!thread.length && (
              <div className="empty-chat-art-box">
                <div className="art-frame">
                  <Image src="/img-unseen.png" alt="" width={140} height={140} unoptimized />
                </div>
                <span className="eyebrow">{t('FIG. 04 / A SAFE SANCTUARY', 'ምስል 04 / አስተማማኝ መጠጊያ')}</span>
                <h3>{t('Your words are welcome here.', 'ሀሳብዎን በነጻነት ያካፍሉ።')}</h3>
                <p>
                  {isAvailableNow
                    ? t(`${activePerson.name} is currently available during chat hours.`, `${activePerson.name} አሁን በሥራ ሰዓት ላይ ይገኛሉ።`)
                    : t(`${activePerson.name} reviews messages daily between ${s.chatStart} and ${s.chatEnd} (UTC+3).`, `${activePerson.name} በየቀኑ ከ ${s.chatStart} እስከ ${s.chatEnd} መልዕክቶችን ያያሉ።`)}
                </p>
                {!hasCredits && (
                  <button className="solid" style={{ marginTop: '16px' }} onClick={() => setQuickPackageModal(true)}>
                    💬 {t('Buy a Voice & Text Package', 'የቻት ጥቅል ይግዙ')}
                  </button>
                )}
              </div>
            )}

            {thread.map(m => (
              <article key={m.id} className={`message ${m.from}`}>
                <small>{m.from === 'client' ? t('You', 'እርስዎ') : activePerson.name}</small>
                {m.text && <p>{m.text}</p>}
                {m.audio && <audio controls src={m.audio} aria-label={t('Voice recording', 'የድምፅ ቅጂ')} />}
                <time>
                  {new Date(m.at).toLocaleTimeString(lang === 'am' ? 'am-ET' : 'en-GB', { hour: '2-digit', minute: '2-digit' })}
                </time>
              </article>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Composer */}
          <div className="composer">
            {errorMessage && <p role="alert" style={{ color: '#c00', fontSize: '12px', margin: '0 0 8px' }}>{errorMessage}</p>}

            {!hasCredits ? (
              <div className="locked-composer">
                <p>{t('A voice or text credit package is required to send messages.', 'መልዕክት ለመላክ የቻት ጥቅል ያስፈልጋል።')}</p>
                <button className="solid" onClick={() => setQuickPackageModal(true)}>
                  {t('Get Credits', 'ጥቅል ግዛ')}
                </button>
              </div>
            ) : recording ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '8px 0' }}>
                <span style={{ width: '10px', height: '10px', background: '#c00', borderRadius: '50%', display: 'inline-block' }} />
                <strong>{t('Recording audio', 'በቅዳት ላይ')}: {recordSeconds}/60s</strong>
                <button onClick={() => recorder.current?.stop()}>{t('Stop & Preview', 'አቁምና አዳምጥ')}</button>
              </div>
            ) : draftAudio ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <audio controls src={draftAudio} style={{ flex: 1, minWidth: '220px' }} />
                <button onClick={() => setDraftAudio('')}>{t('Discard', 'ሰርዝ')}</button>
                <button className="solid" onClick={handleSendAudio}>{t('Send Voice Note', 'ድምፅ ላክ')}</button>
              </div>
            ) : (
              <>
                <div className="compose-row">
                  <textarea
                    aria-label={t('Message box', 'የመልዕክት መጻፊያ')}
                    placeholder={credits.texts > 0 ? t('Type your message here…', 'መልዕክትዎን እዚህ ይጻፉ…') : t('Add text credits to type', 'የጽሑፍ ክሬዲት ይጨምሩ')}
                    value={inputText}
                    maxLength={2000}
                    disabled={!credits.texts}
                    onChange={e => setInputText(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendText();
                      }
                    }}
                  />
                  <button
                    disabled={!credits.voices || permissionPending}
                    onClick={startRecording}
                    title={t('Record voice note (up to 60s)', 'የድምፅ መልዕክት ቅረፅ')}
                    style={{ fontSize: '16px', padding: '0 16px' }}
                  >
                    🎙️
                  </button>
                  <button
                    className="solid"
                    disabled={!inputText.trim() || !credits.texts}
                    onClick={handleSendText}
                  >
                    {t('Send', 'ላክ')}
                  </button>
                </div>
                <small style={{ color: '#666', marginTop: '6px', display: 'block' }}>
                  {inputText.length}/2,000 · {t('1 text credit per message · Shift+Enter for newline', '1 ክሬዲት በየመልዕክቱ')}
                </small>
              </>
            )}
          </div>
        </section>

        {/* ── 3. THERAPIST INFO & SCHEDULE (DESKTOP RIGHT SIDEBAR) ── */}
        <aside className="chat-info-panel">
          <div className="chat-info-panel-title">
            {t('Therapist Profile', 'የባለሙያ መረጃ')}
          </div>

          <div className="chat-info-section">
            <h4 style={{ color: '#000' }}>{activePerson.name}</h4>
            <p className="muted" style={{ fontSize: '11px' }}>{activePerson.title}</p>
            <div style={{ marginTop: '8px' }}>
              <Presence id={selectedId} />
            </div>
          </div>

          {/* Availability schedule */}
          <div className="chat-info-section">
            <h4>{t('Chat Availability Hours', 'የቻት የሥራ ሰዓቶች')}</h4>
            <div className="avail-schedule-grid">
              {s.chatDays.map(d => {
                const isToday = d === currentDay;
                return (
                  <div key={d} className={`avail-schedule-row ${isToday ? 'active-day' : ''}`}>
                    <span>{t(DAY_NAMES_SHORT[d], AM_DAY_NAMES[d])} {isToday ? `(${t('Today', 'ዛሬ')})` : ''}</span>
                    <span>{s.chatStart} – {s.chatEnd}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Session booking direct link */}
          <div className="chat-info-section">
            <h4>{t('Book a Live Session', 'የቀጥታ ቀጠሮ ያዙ')}</h4>
            <p>💻 {t('Online Video', 'ኦንላይን')}: <strong>{money(s.online)}</strong></p>
            <p>🏥 {t('In-Person Office', 'በአካል')}: <strong>{money(s.inperson)}</strong></p>
            <Link
              href={`/schedule/${selectedId}`}
              className="solid compact"
              style={{ marginTop: '12px', display: 'inline-flex' }}
            >
              📅 {t('Book Session', 'ቀጠሮ ያዙ')}
            </Link>
          </div>
        </aside>
      </main>

      {/* ── QUICK BUY PACKAGE MODAL ── */}
      {quickPackageModal && (
        <Modal title={t('Choose a Voice & Text Package', 'የቻት ጥቅል ይምረጡ')} close={() => setQuickPackageModal(false)}>
          <p style={{ margin: '0 0 16px', fontSize: '14px', color: '#444' }}>
            {t(`Add credits to message directly with ${activePerson.name}. Credits never expire in this demo.`, `ከ ${activePerson.name} ጋር ለመወያየት ክሬዲት ይጨምሩ።`)}
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', margin: '20px 0' }}>
            {bundles.map((b, i) => (
              <div
                key={b.id}
                style={{ border: '3px solid #000', padding: '16px', textAlign: 'center', background: '#fbfbfb', display: 'flex', flexDirection: 'column' }}
              >
                <span className="eyebrow">
                  {i === 0 ? t('STARTER', 'መጀመሪያ') : i === 1 ? t('REGULAR', 'መደበኛ') : t('EXTENDED', 'ሰፊ')}
                </span>
                <strong style={{ font: '26px Archivo Black,sans-serif', margin: '8px 0' }}>
                  {money(discountedPrice(b.price, s.discount))}
                </strong>
                <p style={{ fontSize: '13px', margin: '4px 0 16px' }}>
                  💬 {b.texts} {t('texts', 'ጽሑፍ')}<br />
                  🎙️ {b.voices} {t('voice notes', 'ድምፅ')}
                </p>
                <button
                  className="solid full"
                  style={{ marginTop: 'auto', fontSize: '11px', padding: '10px' }}
                  onClick={() => handleInstantBuy(b.id)}
                >
                  {t('Get Package', 'ግዛ')}
                </button>
              </div>
            ))}
          </div>

          <small style={{ color: '#666', display: 'block', textAlign: 'center' }}>
            {t('Simulated instant transaction. No credit card or live payment required.', 'የማሳያ ግዢ ነው። ምንም ክፍያ አይጠየቅም።')}
          </small>
        </Modal>
      )}
    </>
  );
}

export default function ChatPage() {
  return (
    <Suspense>
      <ChatMessenger />
    </Suspense>
  );
}
