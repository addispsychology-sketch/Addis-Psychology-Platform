'use client';
import { useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import { usePlatform } from './Platform';
export default function AccountPanel() {
  const { userId } = usePlatform();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(signup: boolean) {
    const db = getSupabase();
    if (!db) return setNotice('Complete the Supabase setup in SETUP.md first.');
    setBusy(true);
    try {
      const { error } = signup ? await db.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin + '/account' } }) : await db.auth.signInWithPassword({ email, password });
      setNotice(error ? error.message : signup ? 'Check your email to confirm your account, then sign in.' : 'Signed in. You can now open chat.');
    } finally { setBusy(false); }
  }
  return <section className="platform-main">
    <h1>Your account</h1>
    {userId ? <button className="solid" onClick={() => void getSupabase()?.auth.signOut()}>Sign out</button> : <form onSubmit={e => { e.preventDefault(); void submit(false); }}>
      <label>Email<input type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} /></label>
      <label>Password<input type="password" minLength={12} required autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} /></label>
      <button className="solid" disabled={busy}>Sign in</button>{' '}
      <button type="button" disabled={busy || !email || password.length < 12} onClick={() => void submit(true)}>Create account</button>
    </form>}
    {notice && <p role="status">{notice}</p>}
  </section>;
}
