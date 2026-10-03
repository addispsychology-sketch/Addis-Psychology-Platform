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
          const result = await telegramSignIn(false, false);
          if (result.needsAccount && alive) setNotice('Welcome to Addis. Open Account to join with Telegram or connect your existing account.');
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
  return <><Script src="https://telegram.org/js/telegram-web-app.js" strategy="afterInteractive" />
    {process.env.NEXT_PUBLIC_TELEGRAM_LOGIN_CLIENT_ID && <Script src="https://telegram.org/js/telegram-login.js" strategy="afterInteractive" />}
    {notice && <div className="system-note" role="status"><a href="/account">{notice}</a><button aria-label="Dismiss Telegram notice" onClick={() => setNotice('')}>×</button></div>}
  </>;
}
