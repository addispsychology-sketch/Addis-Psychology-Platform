'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Home, MessageCircle, CalendarDays, Package, Wallet } from 'lucide-react';
import { usePlatform } from './Platform';
import { authenticatedFetch } from '@/lib/supabase';
export default function ClientNav() {
  const { userId, ownTherapistId, t } = usePlatform();
  const path = usePathname();
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    const refresh = () => authenticatedFetch('/api/inbox').then(r => { if (alive && typeof r.unread === 'number') setUnread(r.unread); }).catch(() => {});
    void refresh();
    const timer = setInterval(refresh, 15000);
    return () => { alive = false; clearInterval(timer); };
  }, [userId, path]);
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
