'use client';
import { useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Copy, ArrowRight } from 'lucide-react';
import { authenticatedFetch } from '@/lib/supabase';
import { usePlatform } from './Platform';
import { PACKAGE_PRINCIPAL, PAYEE, PAYMENT_DESTINATIONS, moneyCents, serviceFee } from '@/lib/payment-policy';
export default function PaymentCheckout({ kind = 'text' }: { kind?: 'text' | 'voice' | 'comprehensive' | 'combined' }) {
  const { userId, refreshWallet } = usePlatform();
  const [method, setMethod] = useState<'telebirr' | 'cbe'>('telebirr');
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [copied, setCopied] = useState(false);
  const principal = PACKAGE_PRINCIPAL[kind];
  const packageLabel = kind === 'comprehensive' ? '250 texts + 15 min voice' : kind === 'combined' ? 'text + voice' : kind;
  if (submitted) return <section className="care-card payment-success" role="status"><CheckCircle2 size={38} /><span className="eyebrow">TRANSFER SUBMITTED</span><h2>We’ll take it from here.</h2><p>Addis Psychology will verify your transfer. Your {packageLabel} credits will appear in your wallet once approved.</p><Link className="solid" href="/wallet">Track my payment <ArrowRight size={16} /></Link><Link href="/therapists">Explore therapists while you wait →</Link></section>;
  return <section className="care-card payment-checkout"><span className="eyebrow">YOUR {packageLabel.toUpperCase()} PACKAGE</span><h2>One simple transfer.</h2><p>Pay the total below, then share the reference from your receipt.</p>
    <dl className="payment-breakdown"><div><dt>Package</dt><dd>{moneyCents(principal)}</dd></div><div><dt>Service fee · 5%</dt><dd>{moneyCents(serviceFee(principal))}</dd></div><div className="payment-total"><dt>Total to pay</dt><dd>{moneyCents(principal + serviceFee(principal))}</dd></div></dl>
    {!userId ? <Link className="solid" href="/account?next=/packages">Sign in to continue <ArrowRight size={16} /></Link> : <form onSubmit={async e => {
      e.preventDefault(); if (busy) return; setBusy(true); setNotice('');
      try {
        await authenticatedFetch('/api/wallet', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'payment', kind, method, reference }) });
        setSubmitted(true); await refreshWallet();
      } catch (error) { setNotice(error instanceof Error ? error.message : 'Please try again.'); }
      finally { setBusy(false); }
    }}>
      <span className="checkout-step">01 / CHOOSE HOW TO PAY</span><div className="account-tabs"><button type="button" aria-pressed={method === 'telebirr'} onClick={() => { setMethod('telebirr'); setCopied(false); }}>Telebirr</button><button type="button" aria-pressed={method === 'cbe'} onClick={() => { setMethod('cbe'); setCopied(false); }}>CBE</button></div>
      <div className="bank-detail"><span>PACKAGE PAYMENT RECIPIENT</span><strong>{PAYEE}</strong><div className="bank-copy"><code>{PAYMENT_DESTINATIONS[method]}</code><button type="button" aria-label="Copy payment account number" onClick={async () => { try { await navigator.clipboard.writeText(PAYMENT_DESTINATIONS[method]); setCopied(true); } catch { setNotice('Please copy the account number shown above.'); } }}><Copy size={17} /> {copied ? 'Copied' : 'Copy'}</button></div><small>Check the recipient name in your banking app.</small></div>
      <label><span className="checkout-step">02 / ADD YOUR TRANSFER REFERENCE</span><input required minLength={5} maxLength={100} pattern="[A-Za-z0-9-]+" autoComplete="off" value={reference} onChange={e => setReference(e.target.value)} placeholder="Reference on your receipt" /></label>
      <label className="terms-consent"><input type="checkbox" required /><span>I sent the total to {PAYEE}. Credits are added after verification; the 5% service fee is non-refundable.</span></label>
      <button className="solid" disabled={busy}>{busy ? 'Submitting…' : 'I’ve paid · submit reference'} <ArrowRight size={16} /></button><p className="care-caption">No money is withdrawn here. Never share your PIN or banking code. <Link href="/terms#payments">Payment terms</Link></p>
    </form>}{notice && <p className="account-notice" role="status">{notice}</p>}
  </section>;
}
