'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { MessageCircle, CalendarDays, Package, Wallet } from 'lucide-react';
import { usePlatform } from './Platform';
import { authenticatedFetch } from '@/lib/supabase';

export default function ClientNav() {
  const { userId, ownTherapistId, t } = usePlatform();
  const path = usePathname();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    const refresh = () =>
      authenticatedFetch('/api/inbox')
        .then(r => {
          if (alive && typeof r.unread === 'number') {
            setUnread(r.unread);
          }
        })
        .catch(() => {});

    void refresh();
    const timer = setInterval(refresh, 15000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [userId, path]);

  // Only show for authenticated clients (not for therapist portal users or anonymous visitors)
  if (!userId || ownTherapistId) return null;

  // Don't render inside fullscreen chat on mobile if chat handles its own view
  const isChat = path === '/chat';
  const isBookings = path === '/appointments';
  const isPackages = path === '/packages';
  const isWallet = path === '/wallet';

  return (
    <nav className="client-dock" aria-label={t('Client Navigation', 'የደንበኛ ማውጫ')}>
      <Link href="/chat" aria-current={isChat ? 'page' : undefined}>
        <span className="dock-icon">
          <MessageCircle size={22} />
          {unread > 0 && (
            <span className="unread-badge" aria-label={`${unread} ${t('unread messages', 'ያልተነበቡ መልዕክቶች')}`}>
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </span>
        <span>{t('Chats', 'ውይይቶች')}</span>
      </Link>

      <Link href="/appointments" aria-current={isBookings ? 'page' : undefined}>
        <span className="dock-icon">
          <CalendarDays size={22} />
        </span>
        <span>{t('Bookings', 'ቀጠሮዎች')}</span>
      </Link>

      <Link href="/packages" aria-current={isPackages ? 'page' : undefined}>
        <span className="dock-icon">
          <Package size={22} />
        </span>
        <span>{t('Packages', 'ጥቅሎች')}</span>
      </Link>

      <Link href="/wallet" aria-current={isWallet ? 'page' : undefined}>
        <span className="dock-icon">
          <Wallet size={22} />
        </span>
        <span>{t('My Balance', 'ቀሪ ሂሳብ')}</span>
      </Link>
    </nav>
  );
}
