'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Home, MessageCircle, CalendarDays, Package, Wallet } from 'lucide-react';
import { usePlatform } from './Platform';
import { getSupabase } from '@/lib/supabase';
export default function ClientNav() {
  const { userId, ownTherapistId, t, messages } = usePlatform();
  const path = usePathname();
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    if (!userId || ownTherapistId || path.startsWith('/admin') || path.startsWith('/portal')) return;
    let alive = true;
    let loading = false;
    const refresh = async () => {
      if (loading) return;
      loading = true;
      try { const result = await getSupabase()?.rpc('unread_message_count'); if (alive && result && !result.error) setUnread(Number(result.data) || 0); }
      finally { loading = false; }
    };
    void refresh();
    window.addEventListener('messages-read',refresh);
    const timer = setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 120000);
    return () => { alive = false; clearInterval(timer); window.removeEventListener('messages-read',refresh); };
  }, [userId, ownTherapistId, path, messages]);
  if (ownTherapistId || path.startsWith('/admin') || path.startsWith('/portal')) return null;
  const items = [
    { href: '/therapists', label: t('Home', 'ዋና'), icon: Home },
    { href: '/packages', label: t('Packages', 'ጥቅሎች'), icon: Package },
    { href: '/chat', label: t('Chat', 'ውይይት'), icon: MessageCircle },
    { href: '/wallet', label: t('Wallet', 'ቀሪ ሂሳብ'), icon: Wallet },
    { href: '/appointments', label: t('Bookings', 'ቀጠሮዎች'), icon: CalendarDays },
  ];
  return <nav className="client-dock" aria-label="Your care">{items.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={href === '/chat' ? 'dock-chat' : undefined} aria-current={path === href ? 'page' : undefined}>
    <span className="dock-icon"><Icon size={21} />{href === '/chat' && userId && unread > 0 && <span className="unread-badge" aria-label={`${unread} unread messages`}>{unread > 99 ? '99+' : unread}</span>}</span><span>{label}</span>
  </Link>)}</nav>;
}

