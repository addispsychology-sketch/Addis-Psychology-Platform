'use client';
import Link from 'next/link';
import Image from 'next/image';
import { therapistAvailability } from '@/lib/presence';
import { usePathname } from 'next/navigation';
import { usePlatform } from './Platform';
import { ReactNode, useEffect, useRef, useState } from 'react';

export function Header() {
  const { t, lang, setLang, theme, setTheme, userId } = usePlatform();
  const path = usePathname();
  const [menuPath, setMenuPath] = useState<string | null>(null);
  const mobileMenuOpen = menuPath === path;

  const cycleTheme = () => {
    if (theme === 'white') setTheme('dark');
    else if (theme === 'dark') setTheme('colorful');
    else setTheme('white');
  };

  const themeLabel =
    theme === 'white'
      ? t('☀ Light', '☀ ብርሃን')
      : theme === 'dark'
      ? t('🌙 Dark', '🌙 ጨለማ')
      : t('🎨 Color', '🎨 ቀለም');

  const themeIcon = theme === 'white' ? '☀' : theme === 'dark' ? '🌙' : '🎨';

  return (
    <header className="platform-header">
      <div className="platform-header-bar">
        <Link className="platform-brand" href="/">
          <b>AP</b>
          <span>
            {t('ADDIS PSYCHOLOGY', 'አዲስ ሳይኮሎጂ')}
            <small className="brand-subtext">{t('SUPPORT. ON YOUR TERMS.', 'ድጋፍ። በእርስዎ ምርጫ።')}</small>
          </span>
        </Link>

        {/* Mobile quick controls on right */}
        <div className="mobile-header-actions">
          <Link className="account-nav-link" href="/account">{userId ? t('Account', 'መለያ') : t('Sign in', 'ግባ')}</Link>
          <button
            type="button"
            className="theme-toggle-btn mobile-theme-btn"
            onClick={cycleTheme}
            aria-label={t(`Theme: ${theme}`, `ገጽታ: ${theme}`)}
            title={t(`Theme: ${theme}`, `ገጽታ: ${theme}`)}
          >
            {themeIcon}
          </button>
          <button
            className="language-toggle mobile-lang-toggle"
            onClick={() => setLang(lang === 'en' ? 'am' : 'en')}
            aria-label={t('Switch language', 'ቋንቋ ቀይር')}
          >
            {lang === 'en' ? 'አማ' : 'EN'}
          </button>
          <Link className="mobile-chat-pill" href="/chat">
            💬 {t('Chat', 'ቻት')}
          </Link>
          <button
            className="mobile-hamburger-btn"
            onClick={() => setMenuPath(mobileMenuOpen ? null : path)}
            aria-expanded={mobileMenuOpen}
            aria-label={t('Toggle navigation', 'ማውጫ ክፈት')}
          >
            {mobileMenuOpen ? '✕' : '☰'}
          </button>
        </div>
      </div>

      {/* Navigation Links (Desktop bar + Mobile collapsible dropdown) */}
      <nav
        className={`platform-nav ${mobileMenuOpen ? 'open' : ''}`}
        aria-label={t('Main navigation', 'ዋና ማውጫ')}
      >
        <Link aria-current={path === '/therapists' ? 'page' : undefined} href="/therapists">
          {t('Therapists', 'ባለሙያዎች')}
        </Link>
        <Link className="account-nav-link" aria-current={path === '/account' ? 'page' : undefined} href="/account">{userId ? t('My account', 'መለያዬ') : t('Sign in / Join', 'ግባ / ተመዝገብ')}</Link>
        <Link aria-current={path === '/appointments' ? 'page' : undefined} href="/appointments">
          {t('My bookings', 'ቀጠሮዎቼ')}
        </Link>
        <Link aria-current={path === '/portal' ? 'page' : undefined} href="/portal">
          {t('Therapist portal', 'ለባለሙያዎች')}
        </Link>
        <Link aria-current={path === '/register' ? 'page' : undefined} href="/register">
          {t('Join practice', 'ባለሙያ ምዝገባ')}
        </Link>
        <Link aria-current={path === '/admin' ? 'page' : undefined} href="/admin">
          {t('Admin', 'አስተዳዳሪ')}
        </Link>
        <button
          type="button"
          className="theme-toggle-btn desktop-theme-btn"
          onClick={cycleTheme}
          aria-label={t(`Switch theme: currently ${theme}`, `ገጽታ ቀይር`)}
          title={t(`Current theme: ${theme}`, `አሁን ያለው ገጽታ: ${theme}`)}
        >
          {themeLabel}
        </button>
        <button
          className="language-toggle desktop-lang-toggle"
          onClick={() => setLang(lang === 'en' ? 'am' : 'en')}
          aria-label={t('Switch to Amharic', 'ወደ እንግሊዝኛ ቀይር')}
        >
          {lang === 'en' ? 'አማርኛ' : 'English'}
        </button>
        <Link className="chat-cta desktop-chat-cta" href="/chat">
          {t('CHAT NOW', 'አሁን ይወያዩ')} <span aria-hidden="true">↗</span>
        </Link>
      </nav>
    </header>
  );
}

export function DemoNote() {
  const { t } = usePlatform();
  return (
    <div className="demo-note">
      {t('SERVICE INFORMATION', 'የአገልግሎት መረጃ')}
      <span>
        {t(
          'Appointment requests need therapist confirmation. Online payment is not collected here.',
          'የቀጠሮ ጥያቄዎች የባለሙያውን ማረጋገጫ ይጠብቃሉ። እዚህ ክፍያ አይሰበሰብም።'
        )}
      </span>
    </div>
  );
}

export function Page({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <>
      <Header />
      <main className={wide ? 'platform-main wide' : 'platform-main'}>{children}</main>
      <Footer />
    </>
  );
}

export function Footer() {
  const { t } = usePlatform();
  return (
    <footer className="platform-footer">
      <span>{t('ADDIS ABABA / ROOM TO GROW', 'አዲስ አበባ / የማደግ እድል')}</span>
      <Link href="/register">{t('Join as a therapist', 'እንደ ባለሙያ ይመዝገቡ')}</Link>
      <Link href="/admin" style={{ color: 'var(--ink)', fontSize: '11px' }}>
        {t('Admin portal', 'አስተዳዳሪ')}
      </Link>
      <span>{t('English / አማርኛ', 'አማርኛ / English')}</span>
    </footer>
  );
}

export function Photo({
  id,
  name,
  large = false,
  src,
}: {
  id: number;
  name: string;
  large?: boolean;
  src?: string;
}) {
  const { settings, t } = usePlatform();
  const photo = src !== undefined ? src : settings(id).photo;
  const w = large ? 210 : 88;
  const h = large ? 252 : 106;
  return (
    <div className={`profile-photo ${large ? 'large' : ''}`}>
      {photo ? (
        // blob: URLs are local previews during upload — use a plain <img> since next/image
        // doesn't support them. CDN URLs use next/image for proper cache and optimization.
        photo.startsWith('blob:') ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt={name} width={w} height={h} style={{ objectFit: 'cover', width: '100%', height: '100%' }} />
        ) : (
          <Image src={photo} alt={name} width={w} height={h} unoptimized />
        )
      ) : (
        <>
          <strong>
            {name
              .replace(/^Dr\.\s*/, '')
              .split(' ')
              .slice(0, 2)
              .map(n => n[0])
              .join('')}
          </strong>
          <small>{t('PHOTO SPACE', 'የፎቶ ቦታ')}</small>
        </>
      )}
    </div>
  );
}


export function Presence({ id }: { id: number }) {
  const { settings, t } = usePlatform();
  const current = settings(id);
  const s = therapistAvailability(current).isOnline ? 'available' : current.presence === 'busy' ? 'busy' : 'offline';
  return (
    <span className={`presence ${s}`}>
      {s === 'available'
        ? t('Online · available', 'በመስመር ላይ · ዝግጁ')
        : s === 'busy'
        ? t('Online · in session', 'በመስመር ላይ · በቀጠሮ ላይ')
        : t('Offline · leave a message', 'ከመስመር ውጭ · መልዕክት ይተዉ')}
    </span>
  );
}

export function Flower() {
  const { t } = usePlatform();
  return (
    <figure className="growing-flower">
      <svg className="flower-svg" viewBox="0 0 160 220" aria-hidden="true">
        <path className="flower-stem" d="M80 205V78" fill="none" stroke="var(--ink)" strokeWidth="5" />
        <path className="flower-leaf leaf-left" d="M80 161C28 163 24 123 24 123S74 119 80 161Z" />
        <path className="flower-leaf leaf-right" d="M80 137C134 139 139 99 139 99S87 96 80 137Z" />
        <g className="flower-head">
          {[0, 60, 120, 180, 240, 300].map(angle => (
            <ellipse key={angle} cx="80" cy="39" rx="15" ry="27" transform={`rotate(${angle} 80 64)`} />
          ))}
          <circle cx="80" cy="64" r="17" fill="var(--paper)" stroke="var(--ink)" strokeWidth="4" />
        </g>
        <path d="M34 207h92" stroke="var(--ink)" strokeWidth="5" />
      </svg>
      <figcaption>{t('GROW AT YOUR OWN PACE.', 'በራስዎ ፍጥነት ያድጉ።')}</figcaption>
    </figure>
  );
}

export function Modal({
  title,
  children,
  close,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const { t } = usePlatform();
  useEffect(() => {
    const el = ref.current;
    el?.showModal();
    return () => {
      el?.close();
    };
  }, []);
  return (
    <dialog className="platform-modal" ref={ref} onCancel={close} aria-label={title}>
      <div className="modal-heading">
        <h2>{title}</h2>
        <button onClick={close}>{t('Close', 'ዝጋ')}</button>
      </div>
      <div className="modal-body">{children}</div>
    </dialog>
  );
}
