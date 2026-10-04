'use client';
import { useEffect, useState, useRef } from 'react';
import { usePlatform } from './Platform';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';

export default function MessageToast() {
  const { messages, ownTherapistId, t } = usePlatform();
  const [toast, setToast] = useState<{ id: string; text: string; name: string; url: string } | null>(null);
  const prevMessagesCount = useRef(messages.length);

  useEffect(() => {
    if (messages.length > prevMessagesCount.current) {
      const newMsg = messages[messages.length - 1];
      if (newMsg && ((ownTherapistId && newMsg.from === 'client') || (!ownTherapistId && newMsg.from === 'therapist'))) {
        setToast({
          id: newMsg.id,
          text: newMsg.text || '🎙️ Voice note',
          name: newMsg.from === 'client' ? 'Client' : 'Therapist',
          url: ownTherapistId ? `/portal?tab=chat` : `/chat?therapist=${newMsg.therapist}`,
        });
        setTimeout(() => setToast(null), 5000);
      }
    }
    prevMessagesCount.current = messages.length;
  }, [messages, ownTherapistId]);

  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.9 }}
          style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999, background: 'var(--card)', padding: '16px', borderRadius: '12px', boxShadow: '0 8px 30px rgba(0,0,0,0.12)', border: '1px solid var(--border)', maxWidth: '300px', cursor: 'pointer' }}
          onClick={() => setToast(null)}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <span style={{ background: 'var(--brand)', color: 'white', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>💬</span>
            <strong>{t('New Message', 'አዲስ መልእክት')}</strong>
          </div>
          <p style={{ margin: 0, fontSize: '14px', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{toast.text}</p>
          <Link href={toast.url} className="solid compact" style={{ display: 'block', marginTop: '12px', textAlign: 'center', textDecoration: 'none' }}>
            {t('Open Chat', 'ውይይት ክፈት')}
          </Link>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
