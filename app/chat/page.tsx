'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { usePlatform } from '@/components/Platform';
import PrivateAudio from '@/components/PrivateAudio';
import { createVoiceRecorder } from '@/lib/voice';
import { requestCall } from '@/components/AudioCalls';
import { therapistAvailability } from '@/lib/presence';
import { Mic, Send, MessageSquare, Shield, Calendar, CreditCard } from 'lucide-react';
import { Photo, Modal, Page } from '@/components/Shell';
import { bundles, discountedPrice, formatVoiceTime } from '@/lib/commerce';
import { motion, AnimatePresence } from 'framer-motion';
import { getSupabase } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

function TrueFullscreenChat() {
  const { t, people, balance, messages, send, loadMoreMessages, markAsRead, userId, ownTherapistId, conversations, ensureConversation, lang, settings, money, buy, theme, setTheme } = usePlatform();

  const params = useSearchParams();
  const initialId = Number(params.get('therapist') || (people[0] ? people[0].id : 1));

  const [chosenId, setSelectedId] = useState<number | null>(null);
  const selectedId = chosenId ?? (people.some(p => p.id === initialId) ? initialId : people[0]?.id ?? initialId);
  const selectedConversationId = conversations.find(c => c.therapist_id === selectedId && c.client_id === userId)?.id;
  const [remoteTyping, setRemoteTyping] = useState(false);
  const typingChannel = useRef<RealtimeChannel | null>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { if (selectedId && messages.length) void markAsRead(selectedId); }, [selectedId, messages, markAsRead]);
  useEffect(() => {
    setRemoteTyping(false);
    if (!selectedConversationId || !userId) return;
    const db = getSupabase();
    if (!db) return;
    const channel = db.channel(`typing:${selectedConversationId}`);
    typingChannel.current = channel;
    channel.on('broadcast', { event: 'typing' }, (payload: { payload: { u?: string } }) => {
      if (payload.payload.u === userId) return;
      setRemoteTyping(true);
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
      typingTimeout.current = setTimeout(() => setRemoteTyping(false), 3000);
    }).subscribe();
    return () => {
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
      typingChannel.current = null;
      void db.removeChannel(channel);
    };
  }, [selectedConversationId, userId]);
  const notifyTyping = () => {
    if (userId) void typingChannel.current?.send({ type: 'broadcast', event: 'typing', payload: { u: userId } });
  };
  const [showMobileList, setShowMobileList] = useState(!params.get('therapist'));
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [inputText, setInputText] = useState('');
  const [isHoldingVoice, setIsHoldingVoice] = useState(false);
  const [isSlidToCancel, setIsSlidToCancel] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [purchaseNotice, setPurchaseNotice] = useState('');
  const [quickPackageModal, setQuickPackageModal] = useState(false);
  const isTherapistTyping = remoteTyping;
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const holdStartTime = useRef<number>(0);
  const stoppedDuration = useRef(0);
  const touchStartPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isCanceledRef = useRef(false);
  const pointerHeld = useRef(false);
  const alive = useRef(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recordedChunks = useRef<BlobPart[]>([]);

  const activePerson = people.find(p => p.id === selectedId);
  const credits = balance(selectedId);
  const thread = messages.filter(m => m.therapist === selectedId);
  const hasCredits = credits.texts + credits.voiceSeconds > 0;
  const isLowCredits = (credits.texts > 0 && credits.texts <= 5) || (credits.voiceSeconds > 0 && credits.voiceSeconds <= 60);

  const s = settings(selectedId);
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);

  function getTherapistAvailability(therapistId: number) {
    return therapistAvailability(settings(therapistId), clock);
  }
  const { isOnline: isAvailableNow, minsLeft: minutesUntilOffline } = getTherapistAvailability(selectedId);

  const cycleTheme = () => {
    if (theme === 'white') setTheme('dark');
    else if (theme === 'dark') setTheme('colorful');
    else setTheme('white');
  };

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      pointerHeld.current = false;
      isCanceledRef.current = true;
      if (timerRef.current) clearInterval(timerRef.current);
      if (recorderRef.current && recorderRef.current.state === 'recording') {
        recorderRef.current.stop();
      }
      streamRef.current?.getTracks().forEach(track => track.stop());
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, selectedId, isTherapistTyping]);

  // ── HOLD-TO-RECORD VOICE NOTE (PUSH-TO-TALK WITH SLIDE-TO-CANCEL) ──
  async function handleVoicePointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    e.preventDefault();
    if (pointerHeld.current || recorderRef.current || sendingRef.current) return;
    pointerHeld.current = true;
    setErrorMessage('');
    isCanceledRef.current = false;
    setIsSlidToCancel(false);

    if (!credits.voiceSeconds) {
      pointerHeld.current = false;
      setErrorMessage(t('No voice credits remaining. Add a package to send audio.', 'የድምፅ ክሬዲት አልቋል። ጥቅል ይግዙ።'));
      setQuickPackageModal(true);
      return;
    }

    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
        pointerHeld.current = false;
        setErrorMessage(t('Microphone is not supported in this browser.', 'ማይክሮፎን አይደገፍም።'));
        return;
      }

      // Capture pointer so releasing anywhere triggers PointerUp
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {}

      touchStartPos.current = { x: e.clientX, y: e.clientY };

      const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!alive.current || !pointerHeld.current) {
        mediaStream.getTracks().forEach(t => t.stop());
        return;
      }
      streamRef.current = mediaStream;

      const rec = createVoiceRecorder(mediaStream);
      recorderRef.current = rec;
      recordedChunks.current = [];

      rec.ondataavailable = ev => {
        if (ev.data.size) recordedChunks.current.push(ev.data);
      };

      rec.onstop = async () => {
        recorderRef.current = null;
        pointerHeld.current = false;
        if (alive.current) setIsHoldingVoice(false);
        if (timerRef.current) clearInterval(timerRef.current);
        mediaStream.getTracks().forEach(t => t.stop());

        const elapsed = stoppedDuration.current || performance.now() - holdStartTime.current;
        if (alive.current && !isCanceledRef.current && elapsed >= 350 && recordedChunks.current.length > 0) {
          const blob = new Blob(recordedChunks.current, { type: rec.mimeType || 'audio/webm' });
          const audioUrl = URL.createObjectURL(blob);
          sendingRef.current = true; setSending(true);
          const ok = await send(selectedId, 'voice', audioUrl, elapsed / 1000);
          URL.revokeObjectURL(audioUrl);
          sendingRef.current = false;
          if (alive.current) { setSending(false); if (!ok) setErrorMessage('Voice note could not be sent. Please retry.'); } else {
            URL.revokeObjectURL(audioUrl);
            setErrorMessage(t('Not enough voice time. Please top up.', 'በቂ የድምፅ ጊዜ የለም። ጥቅል ይግዙ።'));
          }
        }
      };

      rec.start();
      // This timestamp is captured in the pointer event after microphone permission.
      // eslint-disable-next-line react-hooks/purity
      holdStartTime.current = performance.now();
      stoppedDuration.current = 0;
      setIsHoldingVoice(true);
      setRecordSeconds(0);
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate?.(40);
      }

      timerRef.current = setInterval(() => {
        const sec = (performance.now() - holdStartTime.current) / 1000;
        setRecordSeconds(Math.floor(sec));
        if (sec >= credits.voiceSeconds && rec.state === 'recording') {
          handleVoicePointerUp(e);
        }
      }, 100);
    } catch {
      pointerHeld.current = false;
      streamRef.current?.getTracks().forEach(track => track.stop());
      recorderRef.current = null;
      setErrorMessage(t('Microphone permission denied.', 'ማይክሮፎን አልተፈቀደም።'));
    }
  }

  function handleVoicePointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    if (!isHoldingVoice) return;
    const deltaX = touchStartPos.current.x - e.clientX;
    // If dragged more than 60px to the left, mark as canceled
    if (deltaX > 60) {
      if (!isCanceledRef.current) {
        isCanceledRef.current = true;
        setIsSlidToCancel(true);
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          navigator.vibrate?.(25);
        }
      }
    } else {
      if (isCanceledRef.current) {
        isCanceledRef.current = false;
        setIsSlidToCancel(false);
      }
    }
  }

  function handleVoicePointerUp(e: React.PointerEvent<HTMLButtonElement>) {
    pointerHeld.current = false;
    if (!recorderRef.current || recorderRef.current.state !== 'recording') return;
    stoppedDuration.current = performance.now() - holdStartTime.current;
    setIsHoldingVoice(false);
    if (timerRef.current) clearInterval(timerRef.current);

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}

    const elapsed = performance.now() - holdStartTime.current;
    if (isCanceledRef.current) {
      setErrorMessage(t('Voice recording canceled.', 'የድምፅ ቅጂው ተሰርዟል።'));
      setTimeout(() => setErrorMessage(''), 2500);
    } else if (elapsed < 350) {
      setErrorMessage(t('Hold button down to record, release to send.', 'ለመቅዳት ተጭነው ይያዙ፣ ለመላክ ይልቀቁ።'));
      setTimeout(() => setErrorMessage(''), 3000);
    }

    if (recorderRef.current && recorderRef.current.state === 'recording') {
      recorderRef.current.stop();
    }
    setIsSlidToCancel(false);
  }

  function handleVoicePointerCancel(e: React.PointerEvent<HTMLButtonElement>) {
    isCanceledRef.current = true;
    handleVoicePointerUp(e);
  }

  async function handleSendText(customText?: string) {
    const text = (customText ?? inputText).trim();
    if (!text || sendingRef.current) return;
    sendingRef.current = true; setSending(true);
    const ok = await send(selectedId, 'text', text);
    sendingRef.current = false; setSending(false);
    if (ok) { setInputText(''); setErrorMessage(''); } else setErrorMessage('Message failed. Please retry.');
  }

  function handleInstantBuy(bundleId: string) {
    if (buy(selectedId, bundleId)) {
      setQuickPackageModal(false);
      setErrorMessage('');
      setPurchaseNotice(t('Credits added. You’re ready to continue.', 'ክሬዲት ተጨምሯል። መቀጠል ይችላሉ።'));
    }
  }

  if (!userId) return <Page><section className="chat-signin-card"><span className="account-eyebrow">A PRIVATE SPACE TO TALK</span><h1>Start with a hello.</h1><p>Sign in or create a free account to message a therapist. Your conversations stay connected to you, on the website and in Telegram.</p><Link className="solid" href={`/account?next=${encodeURIComponent(params.get('therapist') ? `/chat?therapist=${initialId}` : '/chat')}`}>Sign in / Create account →</Link><p><Link href="/therapists">Explore therapists first</Link></p></section></Page>;
  if (ownTherapistId) return <main className="platform-main"><Link className="solid" href="/portal">Open your client conversations</Link></main>;
  if (!activePerson) {
    const userCredits = balance(0);
    return (
      <main className="platform-main">
        <div className="chat-no-therapist-container">
          <div className="chat-no-therapist-card">
            {/* Header: compact icon badge + title area */}
            <div className="chat-no-therapist-header">
              <div className="chat-no-therapist-badge-icon">
                <MessageSquare size={20} />
              </div>
              <div className="chat-no-therapist-title-area">
                <span className="chat-no-therapist-eyebrow">
                  {t('CONFIDENTIAL SANCTUARY · ADDIS PSYCHOLOGY', 'ሚስጥራዊ መጠጊያ · አዲስ ሳይኮሎጂ')}
                </span>
                <h1>{t('Find your therapist.', 'ባለሙያዎን ይምረጡ።')}</h1>
                <p className="chat-desc">
                  {t(
                    'Choose an approved practitioner from the directory to start private messaging, or purchase your package in advance.',
                    'የግል ውይይት ለመጀመር ከተፈቀደላቸው ባለሙያዎች ዝርዝር ይምረጡ ወይም አስቀድመው ጥቅል ይግዙ።'
                  )}
                </p>
              </div>
            </div>

            {/* Compact Balance strip */}
            <div className="chat-balance-card">
              <div className="chat-balance-metrics">
                <div className="chat-balance-item">
                  <span>💬</span>
                  <span><strong>{userCredits.texts}</strong> {t('texts', 'ጽሑፎች')}</span>
                </div>
                <span style={{ opacity: 0.4 }}>·</span>
                <div className="chat-balance-item">
                  <span>🎙️</span>
                  <span><strong>{(userCredits.voiceSeconds / 60).toFixed(1)}</strong> {t('voice min', 'የድምፅ ደቂቃ')}</span>
                </div>
              </div>
              <Link href="/wallet" className="chat-balance-link">
                {t('My balance →', 'ቀሪ ሂሳብ →')}
              </Link>
            </div>

            {/* Action buttons */}
            <div className="chat-actions-group">
              <Link href="/therapists" className="btn-browse">
                {t('Browse Directory →', 'ባለሙያዎችን ይመልከቱ →')}
              </Link>
              <Link href="/packages" className="btn-package">
                + {t('Buy Package', 'ጥቅል ይግዙ')}
              </Link>
            </div>

            {/* 2x2 Clean Features Grid */}
            <div className="chat-features-grid">
              <div className="chat-feature-chip">
                <Shield size={14} className="chip-icon" />
                <span>{t('Strict confidentiality', 'ሙሉ ሚስጥራዊነት')}</span>
              </div>
              <div className="chat-feature-chip">
                <Mic size={14} className="chip-icon" />
                <span>{t('Text & voice notes', 'ጽሑፍና ድምፅ')}</span>
              </div>
              <div className="chat-feature-chip">
                <Calendar size={14} className="chip-icon" />
                <span>{t('Book live sessions', 'የቀጠሮ ሰሌዳ')}</span>
              </div>
              <div className="chat-feature-chip">
                <CreditCard size={14} className="chip-icon" />
                <span>{t('Telebirr & CBE verified', 'ቴሌብርና ንግድ ባንክ')}</span>
              </div>
            </div>

            {/* Subtle footnote */}
            <p className="chat-footer-note">
              {t(
                'Packages stay with your account wallet and can be purchased before choosing a practitioner. Newly registered practices appear as soon as credentials are reviewed by administrators.',
                'የገዟቸው ጥቅሎች በመለያዎ ውስጥ ይቀመጣሉ። አዳዲስ ባለሙያዎች ፈቃዳቸው ሲረጋገጥ ወዲያውኑ በዝርዝሩ ውስጥ ይታያሉ።'
              )}
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <div className="pure-fullscreen-chat">
      {/* ── MESSENGER CANVAS (NO BIG TOP BAR AT ALL) ── */}
      <div className={`chat-workspace-grid ${showMobileList ? 'mobile-show-sidebar' : ''}`}>

        {/* ── LEFT: CONVERSATION LIST (SIDEBAR) ── */}
        <aside className="chat-native-sidebar"><div className="chat-list-intro"><span className="eyebrow">YOUR SPACE TO CONNECT</span><h1>Let’s talk.</h1><p>{people.filter(p => getTherapistAvailability(p.id).isOnline).length} therapists available now. Choose someone to start a conversation.</p></div><div className="chat-list-filters"><button aria-pressed={!onlineOnly} onClick={() => setOnlineOnly(false)}>All therapists</button><button aria-pressed={onlineOnly} onClick={() => setOnlineOnly(true)}>Online now</button></div>
          {/* Sidebar Top: Search & discreet exit link */}
          <div className="native-sidebar-header">
            <input
              type="search"
              placeholder={t('Search therapists…', 'ባለሙያ ፈልግ…')}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {/* Small discreet exit button */}
            <Link
              href="/therapists"
              className="discreet-exit-btn"
              title={t('Exit to main platform', 'ወደ ዋናው ገጽ ተመለስ')}
            >
              ⌂
            </Link>
          </div>

          <div className="native-contacts-scroll">{!people.some(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()) && (!onlineOnly || getTherapistAvailability(p.id).isOnline)) && <div className="care-empty"><h3>{onlineOnly ? "No one is online just now." : "No matching therapists."}</h3><p>You can leave a message for a later reply.</p><button className="care-back" onClick={() => { setOnlineOnly(false); setSearchQuery(''); }}>See all therapists</button></div>}
            {people
              .filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()) && (!onlineOnly || getTherapistAvailability(p.id).isOnline))
              .sort((a,b) => Number(getTherapistAvailability(b.id).isOnline) - Number(getTherapistAvailability(a.id).isOnline))
              .map(p => {
                const isSelected = p.id === selectedId;
                const avail = getTherapistAvailability(p.id);
                const msgCount = messages.filter(m => m.therapist === p.id).length;

                return (
                  <button
                    key={p.id}
                    className={`native-contact-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => {
                      setPurchaseNotice('');
                      setErrorMessage('');
                      setSelectedId(p.id);
                      setShowMobileList(false);
                    }}
                  >
                    <div className="native-avatar-wrap">
                      <Photo id={p.id} name={p.name} src={settings(p.id).photo} />
                      <span className={`native-dot ${avail.isOnline ? 'online' : ''}`} />
                    </div>
                    <div className="native-contact-details">
                      <div className="native-name-row">
                        <strong>{p.name}</strong>
                        {msgCount > 0 && <span className="native-count-badge">{msgCount}</span>}
                      </div>
                      <small className="native-title-line">{p.title}</small>
                      <span className="native-avail-line">
                        {avail.isOnline
                          ? avail.minsLeft <= 60
                            ? `🟢 ${t(`Online · may leave in ~${avail.minsLeft}m`, `ዝግጁ (በ ~${avail.minsLeft}ደ ያበቃል)`)}`
                            : `🟢 ${t(`Online until ${avail.end}`, `እስከ ${avail.end} ዝግጁ`)}`
                          : `⚪ ${t(`Offline · Hours ${avail.start}–${avail.end}`, `የሥራ ሰዓት: ${avail.start}–${avail.end}`)}`}
                      </span>
                    </div>
                  </button>
                );
              })}
          </div>
        </aside>

        {/* ── RIGHT / CENTER: ACTIVE CHAT THREAD ── */}
        <section className="chat-native-main">
          {/* Authentic Native Chat Header */}
          <header className="native-chat-header">
            {/* Mobile back to contacts button */}
            <button
              type="button"
              className="native-mobile-back"
              onClick={() => setShowMobileList(true)}
              aria-label={t('Back to chats', 'ወደ ውይይቶች')}
            >
              ←
            </button>

            {/* Well-Aligned Profile Photo + Name + Online Status */}
            <div className="native-profile-group">
              <div className="native-avatar-wrap">
                <Photo id={selectedId} name={activePerson.name} src={s.photo} />
                <span className={`native-dot ${isAvailableNow ? 'online' : ''}`} />
              </div>
              <div className="native-profile-text">
                <div className="native-name-inline">
                  <h2>{activePerson.name}</h2>
                  {activePerson.badge && (
                    <span className="admin-badge green mini-badge">{activePerson.badge}</span>
                  )}
                </div>
                <div className="native-status-inline">
                  <span className={`native-dot-mini ${isAvailableNow ? 'online' : ''}`} />
                  <span className="status-countdown-label">
                    {isAvailableNow
                      ? minutesUntilOffline <= 60
                        ? t(`Online · may leave in ~${minutesUntilOffline} min`, `በመስመር ላይ · በ ~${minutesUntilOffline} ደቂቃ ውስጥ ያበቃል`)
                        : t(`Online until ${s.chatEnd} (~${Math.floor(minutesUntilOffline / 60)}h ${minutesUntilOffline % 60}m left)`, `በመስመር ላይ እስከ ${s.chatEnd}`)
                      : t(`Offline · Active ${s.chatStart}–${s.chatEnd}`, `ከመስመር ውጭ · የሥራ ሰዓት: ${s.chatStart}–${s.chatEnd}`)}
                  </span>
                </div>
              </div>
            </div>

            {/* Right Header Actions: Theme toggle, Consultation link & Discreet exit */}
            <div className="native-header-actions">
              <button type="button" className="native-book-icon-btn" aria-label="Start audio call" onClick={() => { void ensureConversation(selectedId).then(requestCall).catch(error => setErrorMessage(error.message)); }}>📞</button>
              <button
                type="button"
                className="native-theme-chip"
                onClick={cycleTheme}
                title={t(`Theme: ${theme}. Click to switch.`, `ገጽታ: ${theme}`)}
                aria-label={t(`Current theme: ${theme}`, `አሁን ያለው ገጽታ: ${theme}`)}
              >
                {theme === 'white' ? '☀' : theme === 'dark' ? '🌙' : '🎨'}
              </button>

              <Link
                href={`/schedule/${selectedId}`}
                className="native-book-icon-btn"
                title={t('Book Live Consultation', 'ቀጠሮ ያዙ')}
              >
                📅
              </Link>

              {/* Small discreet exit button to access main site */}
              <Link
                href="/therapists"
                className="discreet-exit-btn"
                title={t('Exit chat to main platform', 'ወደ ዋናው ገጽ ተመለስ')}
                aria-label={t('Exit chat to main platform', 'ወደ ዋናው ገጽ ተመለስ')}
              >
                ⌂
              </Link>
            </div>
          </header>

          {/* Chat Stream with Authentic WhatsApp/Telegram Doodle Wallpaper */}
          <div className="native-wallpaper-canvas" aria-label={t('Chat message history', 'የመልዕክት ታሪክ')}>
            {/* Shift hours & Clinical discretion notice */}
            <div className="therapist-discretion-note">
              <span>
                ℹ️ {t(`Chat hours: ${s.chatStart}–${s.chatEnd} (Addis Ababa). These are practice hours; replies depend on your practitioner.`, `የሥራ ሰዓት: ${s.chatStart}–${s.chatEnd}። ባለሙያው እንደ አስፈላጊነቱ ከተጠቀሰው ሰዓት በላይ ሊቆዩ ይችላሉ።`)}
              </span>
            </div>

            {/* Credit Depleted Alert: Tells clients they cannot communicate until top up */}
            {!hasCredits && (
              <div className="credit-depleted-alert-card">
                <div className="alert-content-left">
                  <strong>⚠ {t('Message Credits Depleted', 'የመልዕክት ክሬዲት አልቋል')}</strong>
                  <p>
                    {t(
                      `You have no text credits or voice minutes remaining. Top up your package to continue private messaging with ${activePerson.name}.`,
                      `ከ ${activePerson.name} ጋር ለመወያየት ክሬዲት አልቋል። መልዕክት ለመላክ እባክዎ ጥቅል ይግዙ።`
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  className="solid compact alert-action-btn"
                  onClick={() => setQuickPackageModal(true)}
                >
                  + {t('Top Up Credits', 'ክሬዲት ጨምር')}
                </button>
              </div>
            )}

            <div className="native-date-bubble">
              <span>{t('TODAY · CONFIDENTIAL COUNSELING', 'ዛሬ · ሚስጥራዊ የሕክምና ውይይት')}</span>
            </div>

            {!thread.length && (
              <div className="native-empty-box">
                <span style={{ fontSize: '28px' }}>💬</span>
                <h3>{t('Safe & Private Sanctuary', 'አስተማማኝ መጠጊያ')}</h3>
                <p>
                  {isAvailableNow
                    ? t(
                        `${activePerson.name} is online. Type a message or hold the mic button to record a voice note.`,
                        `${activePerson.name} አሁን በመስመር ላይ ናቸው። ጽሑፍ ይጻፉ ወይም ማይክሮፎኑን ተጭነው ይያዙ።`
                      )
                    : t(
                        `${activePerson.name} reviews messages daily between ${s.chatStart} and ${s.chatEnd}.`,
                        `${activePerson.name} በየቀኑ ከ ${s.chatStart} እስከ ${s.chatEnd} መልዕክቶችን ያያሉ።`
                      )}
                </p>
                {!hasCredits && (
                  <button
                    className="solid compact"
                    style={{ marginTop: '10px' }}
                    onClick={() => setQuickPackageModal(true)}
                  >
                    + {t('Add Voice & Text Package', 'የቻት ጥቅል ይግዙ')}
                  </button>
                )}
              </div>
            )}

            {/* Render Messages */}
            <AnimatePresence initial={false}>
              {thread.map(m => {
                const isMe = m.from === 'client';
                return (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, y: 8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className={`native-msg-row ${isMe ? 'out' : 'in'}`}
                  >
                    <div className="native-bubble">
                      <small className="native-bubble-author">
                        {isMe ? t('You', 'እርስዎ') : activePerson.name}
                      </small>
                      {m.text && <p className="native-bubble-body">{m.text}</p>}
                      {m.audio && (
                        <div className="native-bubble-audio">
                          <PrivateAudio src={m.audio} />
                          {m.durationSeconds && <small>{formatVoiceTime(m.durationSeconds)} {t('voice min used', 'የድምፅ ደቂቃ ተጠቅመዋል')}</small>}
                        </div>
                      )}
                      <div className="native-bubble-meta">
                        <time>
                          {new Date(m.at).toLocaleTimeString(lang === 'am' ? 'am-ET' : 'en-GB', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </time>
                        {isMe && <span className="native-ticks">✓✓</span>}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {/* Live Typing Indicator */}
            {isTherapistTyping && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="native-msg-row in"
              >
                <div className="native-bubble native-typing-bubble">
                  <div className="typing-dots-anim">
                    <span />
                    <span />
                    <span />
                  </div>
                  <small>{activePerson.name} {t('is typing…', 'በመጻፍ ላይ ናቸው…')}</small>
                </div>
              </motion.div>
            )}

            <button type="button" onClick={loadMoreMessages}>Load earlier messages</button>
            <div ref={messagesEndRef} />
          </div>

          {/* Composer with Push-To-Talk Hold & Release */}
          <footer className="native-composer-dock">
            {/* Quick Balance & Package Link in Composer */}
            <div className="native-composer-balance-bar" aria-live="polite">
              <span className="balance-tokens">
                💬 <strong>{credits.texts}</strong> {t('texts', 'ጽሑፎች')} · 🎙️ <strong>{(credits.voiceSeconds / 60).toFixed(1)}</strong> {t('voice min', 'የድምፅ ደቂቃ')}
              </span>
              <button
                type="button"
                className="balance-topup-btn"
                onClick={() => setQuickPackageModal(true)}
              >
                {t('Messaging information', 'የውይይት መረጃ')}
              </button>
            </div>

            {/* Low Credit Warning Pill */}
            {isLowCredits && (
              <div className="credit-low-alert-pill" role="status">
                <span>
                  ⚠ {t(`Balance: ${credits.texts} texts · ${formatVoiceTime(credits.voiceSeconds)} voice minutes. Top up to keep sending.`, `የቀረው: ${credits.texts} ጽሑፎች · ${formatVoiceTime(credits.voiceSeconds)} የድምፅ ደቂቃ። ለመቀጠል ጥቅል ይግዙ።`)}
                </span>
                <button type="button" onClick={() => setQuickPackageModal(true)}>
                  {t('Top up →', 'ጥቅል ግዛ →')}
                </button>
              </div>
            )}

            {purchaseNotice && <div role="status" className="native-error-bar">✓ {purchaseNotice}</div>}
            {errorMessage && (
              <div role="alert" className="native-error-bar">
                ⚠ {errorMessage}
              </div>
            )}

            {isHoldingVoice && (
              /* HOLDING VOICE ACTIVE STRIP (TELEGRAM / WHATSAPP PUSH-TO-TALK) */
              <div className={`native-voice-recording-strip ${isSlidToCancel ? 'canceling' : ''}`}>
                <div className="recording-wave-indicator">
                  <span className="native-recording-pulsar" />
                  <span className="wave-bar b1" />
                  <span className="wave-bar b2" />
                  <span className="wave-bar b3" />
                  <span className="wave-bar b4" />
                </div>
                <div className="recording-hold-text">
                  <strong>
                    {isSlidToCancel
                      ? t('Release to cancel recording ✕', 'ለመሰረዝ ይልቀቁ ✕')
                      : `${t('Recording voice note…', 'ድምፅ በመቅዳት ላይ…')} (${formatVoiceTime(recordSeconds)})`}
                  </strong>
                  <small>
                    {isSlidToCancel
                      ? t('Audio will not be sent', 'ድምፁ አይላክም')
                      : t('Release finger to send · ◀ Slide left to cancel', 'ለመላክ ጣትዎን ያንሱ · ◀ ለመሰረዝ ወደ ግራ ይጎትቱ')}
                  </small>
                </div>
              </div>
            )}
              <div className="native-input-bar">
                <textarea
                  rows={1}
                  aria-label={t('Message box', 'የመልዕክት መጻፊያ')}
                  placeholder={t('Type message… (Enter to send)', 'መልዕክት ይጻፉ…')}
                  value={inputText}
                  maxLength={2000}
                  disabled={isHoldingVoice}
                  onChange={e => { setInputText(e.target.value); notifyTyping(); }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendText();
                    }
                  }}
                />

                {/* PUSH-TO-TALK HOLD & RELEASE BUTTON */}
                <button
                  type="button"
                  className={`native-mic-hold-btn ${isHoldingVoice ? 'recording' : ''}`}
                  onPointerDown={handleVoicePointerDown}
                  onPointerMove={handleVoicePointerMove}
                  onPointerUp={handleVoicePointerUp}
                  onPointerCancel={handleVoicePointerCancel}
                  onContextMenu={e => e.preventDefault()}
                  title={t('Hold finger down to record audio, release to send', 'ተጭነው በመያዝ ድምፅ ይቅረጹ')}
                  aria-label={t('Hold to record voice message', 'ተጭነው በመያዝ ድምፅ ይቅረጹ')}
                >
                  <Mic size={20} aria-hidden="true" />
                </button>

                <button
                  type="button"
                  className="solid native-send-btn"
                  disabled={sending || !inputText.trim()}
                  onClick={() => handleSendText()}
                  aria-label={t('Send message', 'መልዕክት ላክ')}
                >
                  <Send size={18} aria-hidden="true" />
                </button>
              </div>
              <small className="voice-composer-hint">{t('Hold to record · Release to send · Slide left to cancel', 'ለመቅዳት ማይክሮፎኑን ይያዙ · ለመላክ ይልቀቁ · ለመሰረዝ ወደ ግራ ይጎትቱ')}</small>
          </footer>
        </section>
      </div>

      {/* ── QUICK BUY PACKAGE MODAL ── */}
      {quickPackageModal && (
        <Modal title={t('Choose a Voice & Text Package', 'የቻት ጥቅል ይምረጡ')} close={() => setQuickPackageModal(false)}>
          <div className="package-modal-header-intro">
            <p>
              {t(
                `Credits are for ${activePerson.name}. Voice time is charged by recorded seconds, rounded up to the next second. Record for as long as your balance allows.`,
                `ጥቅሉ ለ ${activePerson.name} ብቻ ነው። የድምፅ ጊዜ በተቀዳው ሰከንድ ይቀነሳል፤ ክፍልፋይ ወደ ቀጣዩ ሙሉ ሰከንድ ይጠጋጋል። ቀሪ ጊዜዎ እስከሚፈቅድ መቅዳት ይችላሉ።`
              )}
            </p>
          </div>

          <div className="package-selection-grid">
            {bundles.map((b, i) => {
              const isPopular = i === 1;
              const discounted = discountedPrice(b.price, s.discount);
              const tierName =
                i === 0 ? t('TEXT', 'ጽሑፍ') : i === 1 ? t('VOICE', 'ድምፅ') : t('TEXT + VOICE', 'ጽሑፍ + ድምፅ');

              return (
                <div key={b.id} className={`package-card ${isPopular ? 'popular' : ''}`}>
                  {isPopular && (
                    <span className="package-badge popular-tag">{t('RECOMMENDED', 'ተመራጭ')}</span>
                  )}
                  <span className="package-tier-name">{tierName}</span>
                  <div className="package-price-wrap">
                    <strong className="package-amount">{money(discounted)}</strong>
                    {s.discount > 0 && <small className="package-discount-tag">-{s.discount}%</small>}
                  </div>
                  <ul className="package-features-list">
                    <li>
                      💬 <strong>{b.texts}</strong> {t('Text messages', 'የጽሑፍ መልዕክቶች')}
                    </li>
                    <li>
                      🎙️ <strong>{b.voiceSeconds / 60}</strong> {t('Voice minutes', 'የድምፅ ደቂቃዎች')}
                    </li>
                    <li>{t('1.50 ETB/text · 7 ETB/voice min', '1.50 ብር/ጽሑፍ · 7 ብር/ድምፅ ደቂቃ')}</li>
                    <li>🔒 {t('Unused credits never expire', 'ክሬዲት አያልፍበትም')}</li>
                  </ul>
                  <button
                    className={`solid full ${isPopular ? 'primary-pack-btn' : ''}`}
                    onClick={() => handleInstantBuy(b.id)}
                  >
                    ✓ {t('Add Package Now', 'አሁን ይግዙ')}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="package-modal-footnote">
            <small>
              ℹ️ {t('Paid packages are not enabled. Messaging is currently available without credits.', 'ተግባራዊ ማሳያ: ወዲያውኑ ይሰራል፣ እውነተኛ ክፍያ አያስፈልግም።')}
            </small>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense>
      <TrueFullscreenChat />
    </Suspense>
  );
}



