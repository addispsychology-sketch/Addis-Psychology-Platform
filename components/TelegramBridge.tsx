'use client';
import { useEffect, useState } from 'react';
import Script from 'next/script';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';
import { telegramSignIn } from '@/lib/telegram-client';

export default function TelegramBridge() {
  const router = useRouter();
  const [notice, setNotice] = useState('');
  useEffect(() => {
    let initialized = false;
    let alive = true;
    const back = () => router.back();
    const timer = setInterval(async () => {
      const app = window.Telegram?.WebApp;
      if (!app?.initData || initialized) return;
      initialized = true;
      clearInterval(timer);
      app.ready(); app.expand(); app.BackButton.show(); app.BackButton.onClick(back);
      try {
        const session = (await getSupabase()?.auth.getSession())?.data.session;
        if (!session) {
          const result = await telegramSignIn(false, true);
          if (result.needsAccount && alive) setNotice('needs-account');
        }
        // start_param is navigation only. Authentication always uses server-verified initData.
        const start = new URLSearchParams(app.initData).get('start_param');
        if (start) {
          const path = atob(start.replace(/-/g, '+').replace(/_/g, '/'));
          if (/^\/(?:account|appointments|therapists|register|portal|chat|packages|schedule)(?:[/?]|$)/.test(path) && !path.includes('\\')) router.replace(path);
        }
      } catch (error) { if (alive) setNotice(error instanceof Error ? error.message : 'Open Account to sign in.'); }
    }, 200);
    const stop = setTimeout(() => clearInterval(timer), 10000);
    return () => { alive = false; clearInterval(timer); clearTimeout(stop); window.Telegram?.WebApp?.BackButton.offClick(back); };
  }, [router]);

  return <>
    <Script src="https://telegram.org/js/telegram-web-app.js" strategy="afterInteractive" />
    {process.env.NEXT_PUBLIC_TELEGRAM_LOGIN_CLIENT_ID && <Script src="https://telegram.org/js/telegram-login.js" strategy="afterInteractive" />}
    {notice === 'needs-account' && (
      <div className="tg-welcome-banner" role="status">
        <div className="tg-welcome-inner">
          <div className="tg-welcome-left">
            <div className="tg-welcome-mark">AP</div>
            <div className="tg-welcome-text">
              <strong>Welcome to Addis Psychology</strong>
              <p>Connect your account to access private therapy sessions, appointments, and confidential messaging.</p>
            </div>
          </div>
          <div className="tg-welcome-actions">
            <a href="/account" className="tg-welcome-cta">
              Open Account →
            </a>
            <button
              aria-label="Dismiss welcome notice"
              className="tg-welcome-dismiss"
              onClick={() => setNotice('')}
            >
              ✕
            </button>
          </div>
        </div>
      </div>
    )}
    {notice && notice !== 'needs-account' && (
      <div className="system-note" role="status">
        <a href="/account">{notice}</a>
        <button aria-label="Dismiss Telegram notice" onClick={() => setNotice('')}>×</button>
      </div>
    )}
  </>;
}
