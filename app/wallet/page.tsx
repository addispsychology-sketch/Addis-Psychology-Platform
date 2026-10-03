'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, MessageCircle, Mic, Wallet, ReceiptText } from 'lucide-react';
import { Page } from '@/components/Shell';
import { usePlatform } from '@/components/Platform';
import { authenticatedFetch } from '@/lib/supabase';
import { moneyCents } from '@/lib/payment-policy';
export default function WalletPage() {
  const { userId, wallet, refreshWallet, balance } = usePlatform();
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [lot, setLot] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('telebirr');
  const [destination, setDestination] = useState('');
  const credits = balance(0);
  const legacyFunds = wallet?.wallets[0]?.available_cents || 0;
  const payments = [...(wallet?.payment_requests || [])].sort((a,b) => b.created_at.localeCompare(a.created_at));
  const pending = payments.filter(p => p.status === 'pending');
  return <Page><div className="care-page">
    <header className="care-page-heading"><span className="eyebrow">YOUR WALLET / CLEAR AT A GLANCE</span><h1>A little peace<br />of mind.</h1><p>Your conversation credits and every payment, together.</p></header>
    {!userId ? <section className="care-card wallet-empty"><Wallet size={36} /><h2>Your support stays with you.</h2><p>Sign in to see your credits, track payments, and view receipts.</p><Link className="solid" href="/account?next=/wallet">Open my wallet <ArrowRight size={16} /></Link></section> : <>
      <section className="wallet-balance-card"><span className="eyebrow">READY WHEN YOU ARE</span><div className="wallet-credits"><div><MessageCircle size={23} /><strong>{wallet ? credits.texts : '—'}</strong><span>text messages</span></div><div><Mic size={23} /><strong>{wallet ? (credits.voiceSeconds / 60).toFixed(1) : '—'}</strong><span>voice minutes</span></div></div><Link className="solid" href="/packages">Add a package <ArrowRight size={16} /></Link><Link className="wallet-chat-link" href="/chat">Use my credits →</Link></section>
      {!wallet && <p role="status">Loading your wallet… <button className="care-back" onClick={() => void refreshWallet()}>Retry</button></p>}
      {pending.length > 0 && <div className="care-strip"><div><span className="eyebrow">BEING REVIEWED</span><p>{pending.length} {pending.length === 1 ? 'transfer is' : 'transfers are'} awaiting verification. Credits appear after approval.</p></div></div>}
      {legacyFunds > 0 && <section className="care-card"><span className="eyebrow">EXISTING THERAPY FUNDS</span><h2>{moneyCents(legacyFunds)}</h2><p>You can request a return below. New appointment payments go directly to your therapist.</p></section>}
      <section className="wallet-activity"><div className="care-section-heading"><h2>Your activity.</h2><ReceiptText size={22} /></div>
        {wallet && !payments.length && !wallet.refund_requests.length && <div className="care-empty"><ReceiptText size={30} /><h3>A fresh start.</h3><p>Your package payments and returns will appear here.</p><Link href="/packages">Explore packages →</Link></div>}
        {payments.map(p => <article className="wallet-receipt" key={p.id}><span className="receipt-icon"><ReceiptText size={20} /></span><div><strong>{p.kind === 'wallet' ? 'Previous therapy funds' : p.kind === 'combined' ? 'Text + voice package' : `${p.kind === 'text' ? 'Text' : 'Voice'} package`}</strong><small>{new Date(p.created_at).toLocaleDateString('en-GB', { timeZone: 'Africa/Addis_Ababa', day: 'numeric', month: 'short' })} · {p.method.toUpperCase()}</small><details><summary>Receipt details</summary><p>Reference: {p.reference}<br />Service value: {moneyCents(p.principal_cents)}<br />Service fee: {moneyCents(p.fee_cents)}</p></details></div><div className="receipt-end"><strong>{moneyCents(p.principal_cents + p.fee_cents)}</strong><span className={`payment-status ${p.status}`}>{p.status === 'pending' ? 'In review' : p.status}</span></div></article>)}
        {wallet?.refund_requests.map(r => <article className="wallet-receipt" key={r.id}><ReceiptText size={20} /><div><strong>Return of funds</strong><small>{r.status === 'paid' ? 'Transfer: ' + r.transfer_reference : 'Target: ' + new Date(r.due_at).toLocaleString('en-GB', { timeZone: 'Africa/Addis_Ababa' }) + ' · Addis time'}</small></div><div className="receipt-end"><strong>{moneyCents(r.amount_cents)}</strong><span className="payment-status">{r.status}</span></div></article>)}
      </section>
      <details className="care-details"><summary>Need to return unused credit?</summary><p>Request a return of unused package value or existing therapy funds. The 5% service fee is retained. We aim to process eligible returns within 24 hours; bank processing can affect arrival.</p>
        <form onSubmit={async e => { e.preventDefault(); if (busy) return; setBusy(true); setNotice(''); try { await authenticatedFetch('/api/wallet', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'refund', lotId: lot || null, amount, method, destination }) }); setNotice('Return requested. Track its progress in your activity above.'); await refreshWallet(); } catch (error) { setNotice(error instanceof Error ? error.message : 'Please try again.'); } finally { setBusy(false); } }}>
          <label>Return from<select value={lot} onChange={e => setLot(e.target.value)}><option value="">Existing therapy funds · {moneyCents(legacyFunds)}</option>{wallet?.credit_lots.filter(x => x.texts || x.voice_seconds).map(x => <option key={x.id} value={x.id}>Package · {x.texts} texts / {(x.voice_seconds / 60).toFixed(1)} minutes</option>)}</select></label>
          {!lot && <label>Amount (ETB)<input inputMode="decimal" required value={amount} onChange={e => setAmount(e.target.value)} /></label>}
          <label>Return through<select value={method} onChange={e => setMethod(e.target.value)}><option value="telebirr">Telebirr</option><option value="cbe">CBE</option></select></label>
          <label>Your receiving phone / account number<input required minLength={7} maxLength={30} value={destination} onChange={e => setDestination(e.target.value)} /></label>
          <label className="terms-consent"><input type="checkbox" required /><span>I checked my receiving details. {lot ? 'All unused credits in this package will be removed for a proportional refund.' : 'This amount will be removed from my available funds.'} The 5% fee is retained.</span></label>
          <button className="outline" disabled={busy}>{busy ? 'Requesting…' : 'Request return of funds'} <ArrowRight size={16} /></button>
        </form>{notice && <p role="status" className="account-notice">{notice}</p>}
      </details>
    </>}
    <div className="care-footnote"><strong>Booked sessions are separate.</strong><p>Addis Psychology confirms your booking. You pay your therapist directly; messaging packages are paid to Dawit Aynalem via Telebirr or CBE.</p><Link href="/appointments">My bookings →</Link></div>
  </div></Page>;
}
