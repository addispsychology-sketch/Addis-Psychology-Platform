'use client';

import { therapistAvailability } from '@/lib/presence';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { usePlatform } from './Platform';
import { Photo } from './Shell';
import { motion, AnimatePresence } from 'framer-motion';

export default function OnlineTherapistPopup() {
  const pathname = usePathname();
  const { t, people, settings, ownTherapistId } = usePlatform();

  const [visible, setVisible] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => { const timer = setInterval(() => setClock(Date.now()), 15000); return () => clearInterval(timer); }, []);

  // Find an available therapist
  const availableTherapist = people.find(p => {
    const s = settings(p.id);
    return therapistAvailability(s, clock).isOnline;
  });

  useEffect(() => {
    if (pathname === '/chat' || pathname === '/portal' || pathname.startsWith('/admin')) {
      return;
    }

    const timer = setTimeout(() => {
      setVisible(true);
    }, 1500);

    return () => clearTimeout(timer);
  }, [pathname]);

  if (ownTherapistId || ['/chat','/portal','/admin','/register'].includes(pathname) || !availableTherapist) {
    return null;
  }

  return (
    <aside aria-label={t('Online therapist notification', 'የመስመር ላይ ባለሙያ ማሳወቂያ')}>
      <AnimatePresence>
        {visible && !minimized && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="online-therapist-popup"
          >
            {/* Header banner */}
            <div className="popup-header-strip">
              <div className="popup-live-indicator">
                <span className="pulsing-live-dot" />
                <strong>{t('ONLINE & READY TO TALK', 'አሁን በመስመር ላይ ዝግጁ')}</strong>
              </div>
              <button
                type="button"
                className="popup-close-btn"
                onClick={() => setMinimized(true)}
                title={t('Minimize notification', 'አሳንስ')}
                aria-label={t('Close popup', 'ዝጋ')}
              >
                ✕
              </button>
            </div>

            {/* Content card */}
            <div className="popup-body">
              <div className="popup-therapist-row">
                <Photo id={availableTherapist.id} name={availableTherapist.name} src={settings(availableTherapist.id).photo} />
                <div className="popup-therapist-details">
                  <strong className="popup-therapist-name">{availableTherapist.name}</strong>
                  <span className="popup-therapist-title">{availableTherapist.title}</span>
                  <small className="popup-therapist-lang">
                    🗣️ {availableTherapist.languages.slice(0, 2).join(', ')}
                  </small>
                </div>
              </div>

              <div className="popup-speech-bubble">
                <p>
                  {t(
                    '“Hello. I am available right now for confidential messaging or session questions. How are you feeling today?”',
                    '“ሰላም። አሁን ለሚስጥራዊ ውይይት ወይም ለቀጠሮ ጥያቄዎች ዝግጁ ነኝ። ዛሬ ምን እየተሰማዎት ነው?”'
                  )}
                </p>
              </div>

              <div className="popup-actions">
                <Link
                  href={`/chat?therapist=${availableTherapist.id}`}
                  className="solid full compact"
                  onClick={() => setMinimized(true)}
                  style={{ textDecoration: 'none' }}
                >
                  💬 {t('Start Chatting Now', 'አሁን ተወያዩ')} →
                </Link>
              </div>
            </div>
          </motion.div>
        )}

        {/* Minimized Floating Pill */}
        {visible && minimized && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="online-therapist-minimized-pill"
            onClick={() => setMinimized(false)}
            aria-label={t('Open therapist chat popup', 'የባለሙያ ማሳወቂያ ክፈት')}
          >
            <span className="pulsing-live-dot" />
            <Photo id={availableTherapist.id} name={availableTherapist.name} src={settings(availableTherapist.id).photo} />
            <div className="minimized-pill-text">
              <strong>{availableTherapist.name.split(',')[0]}</strong>
              <small>{t('Online · Chat now', 'በመስመር ላይ · ይወያዩ')}</small>
            </div>
          </motion.button>
        )}
      </AnimatePresence>
    </aside>
  );
}
