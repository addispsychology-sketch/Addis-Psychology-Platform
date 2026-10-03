'use client';
import { useState } from 'react';
import Link from 'next/link';
import { MessageCircle, Mic, AudioLines, ArrowRight, Check, Sparkles } from 'lucide-react';
import { Page } from '@/components/Shell';
import { usePlatform } from '@/components/Platform';
import PaymentCheckout from '@/components/PaymentCheckout';
import { PACKAGE_PRINCIPAL, moneyCents, serviceFee } from '@/lib/payment-policy';
const packages = [
  { kind: 'text', title: 'Write it out.', detail: '100 text messages', note: 'Space to put your thoughts into words.', icon: MessageCircle, recommended: false },
  { kind: 'voice', title: 'Say it your way.', detail: '60 voice minutes', note: 'Send a voice note, at your own pace.', icon: Mic, recommended: false },
  { kind: 'comprehensive', title: 'Comprehensive Care.', detail: '250 texts + 15 voice minutes', note: 'Deep reflective texting with voice notes when speaking feels right.', icon: Sparkles, recommended: true },
  { kind: 'combined', title: 'A little of both.', detail: '100 texts + 60 voice minutes', note: 'Choose how you feel like connecting.', icon: AudioLines, recommended: false },
] as const;
export default function Packages() {
  const [selected, setSelected] = useState<'text' | 'voice' | 'comprehensive' | 'combined'>('comprehensive');
  const [checkout, setCheckout] = useState(false);
  const { balance } = usePlatform();
  const credits = balance(0);
  return <Page><div className="care-page">
    <header className="care-page-heading"><span className="eyebrow">A LITTLE SUPPORT / AT YOUR PACE</span><h1>More room<br />to talk.</h1><p>Choose your way to connect. One purchase, no subscription.</p></header>
    {checkout ? <><button className="care-back" onClick={() => setCheckout(false)}>← Change package</button><PaymentCheckout key={selected} kind={selected} /></> : <>
      <div className="package-options" aria-label="Choose a messaging package">{packages.map(({ kind, title, detail, note, icon: Icon, recommended }) => {
        const total = PACKAGE_PRINCIPAL[kind] + serviceFee(PACKAGE_PRINCIPAL[kind]);
        return <button key={kind} className="package-option" aria-pressed={selected === kind} onClick={() => setSelected(kind)} style={recommended ? { position: 'relative', borderColor: selected === kind ? 'var(--ink)' : 'var(--accent)', borderWidth: '2px' } : {}}>
          {recommended && (
            <span style={{
              position: 'absolute',
              top: '-11px',
              right: '16px',
              background: 'var(--ink)',
              color: 'var(--paper)',
              fontSize: '10px',
              fontWeight: 800,
              padding: '2px 8px',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              borderRadius: '2px'
            }}>
              ★ Recommended
            </span>
          )}
          <span className="package-symbol"><Icon size={24} /></span><span className="package-copy"><strong>{title}</strong><span>{detail}</span><small>{note}</small></span>
          <span className="package-selection" aria-hidden="true">{selected === kind && <Check size={16} />}</span>
          <span className="package-price"><b>{moneyCents(total)}</b><small>5% fee included</small></span>
        </button>;
      })}</div>
      <button className="solid package-continue" onClick={() => { setCheckout(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
        Continue with {selected === 'comprehensive' ? 'Comprehensive Care' : selected === 'combined' ? 'text + voice' : selected} <ArrowRight size={18} />
      </button>
      <p className="care-caption">Pay with Telebirr or CBE. Credits arrive after Addis Psychology verifies your transfer.</p>
    </>}
    <div className="care-strip"><div><span className="eyebrow">ALREADY YOURS</span><p><strong>{credits.texts}</strong> texts · <strong>{(credits.voiceSeconds / 60).toFixed(1)}</strong> voice minutes</p></div><Link href="/wallet">View wallet <ArrowRight size={16} /></Link></div>
    <details className="care-details"><summary>Good to know before you buy</summary><p>Credits work with any approved therapist. Each text allows up to 2,000 characters; voice notes use recorded seconds. Replies do not use your credits.</p><p>Messages are asynchronous. A package does not guarantee an immediate reply. <Link href="/therapists">Find your therapist first</Link> if you prefer.</p><p>Unused package value is refundable; the 5% fee is retained. <Link href="/terms#refunds">Read the refund policy</Link>.</p></details>
    <p className="care-caption">Booking a live session? Pay your therapist directly after Addis Psychology confirms your request. Messaging packages are separate.</p>
  </div></Page>;
}
