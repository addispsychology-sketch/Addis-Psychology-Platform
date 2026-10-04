'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';
import { telegramInitData, telegramSignIn } from '@/lib/telegram-client';
import { miniAppPath } from '@/lib/telegram-links';

export default function TelegramBridge() {
  const router = useRouter();
  const [notice, setNotice] = useState('');
  useEffect(() => {
    let initialized = false;
    let alive = true;
    let linkedUser = '';
    const auth = getSupabase()?.auth.onAuthStateChange((event, session) => {
      if (event !== 'SIGNED_IN' || !initialized || !session || linkedUser === session.user.id) return;
      linkedUser = session.user.id;
      // Supabase callbacks hold the auth lock; perform linking in a later task.
      setTimeout(() => {
        if (alive) void telegramSignIn(true).catch(error => { if (alive) setNotice(error instanceof Error ? error.message : 'Open Account to connect Telegram.'); });
      }, 0);
    });
    const back = () => router.back();
    const timer = setInterval(async () => {
      const app = window.Telegram?.WebApp;
      const initData = telegramInitData();
      if (!initData || initialized) return;
      initialized = true;
      clearInterval(timer);
      app?.ready(); app?.expand(); app?.BackButton.show(); app?.BackButton.onClick(back);
      try {
        const session = (await getSupabase()?.auth.getSession())?.data.session;
        linkedUser = session?.user.id || '';
        // Connect existing email/phone sessions too. Conflicting mappings are
        // rejected on the server, preserving the original accounts and records.
        const result = await telegramSignIn(!!session, true);
        if (result.needsAccount && alive) setNotice('needs-account');
        if (new URLSearchParams(window.location.search).has('telegramLogin') && alive) {
          setNotice('Website sign-in approved. Return to your browser to continue.');
          const url = new URL(window.location.href); url.searchParams.delete('telegramLogin');
          window.history.replaceState(null, '', url);
        }
        // start_param is navigation only. Authentication always uses server-verified initData.
        const start = new URLSearchParams(initData).get('start_param') || new URLSearchParams(window.location.search).get('tgWebAppStartParam');
        if (start) {
          const path = miniAppPath(start);
          if (path) router.replace(path);
        }
      } catch (error) { if (alive) setNotice(error instanceof Error ? error.message : 'Open Account to sign in.'); }
    }, 200);
    const stop = setTimeout(() => clearInterval(timer), 10000);
    return () => { alive = false; clearInterval(timer); clearTimeout(stop); auth?.data.subscription.unsubscribe(); window.Telegram?.WebApp?.BackButton.offClick(back); };
  }, [router]);

  return <>
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
