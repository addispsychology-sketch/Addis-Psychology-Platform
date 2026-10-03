import Link from 'next/link';
import { ShieldCheck, CreditCard, CalendarDays } from 'lucide-react';
import { Page } from './Shell';
import { clientTerms, therapistTerms } from '@/lib/terms';
export default function TermsDocument({ therapist = false }: { therapist?: boolean }) {
  const sections = therapist ? therapistTerms : clientTerms;
  return <Page><div className="terms-document"><header className="care-page-heading"><span className="eyebrow">CLARITY IS PART OF CARE / 03 OCTOBER 2026</span><h1>{therapist ? 'Professional care.\nShared responsibilities.' : 'Your care.\nClear terms.'}</h1><p>{therapist ? 'Therapist' : 'Client'} Terms & Conditions. Take your time. Here’s how we look after your experience.</p></header>
    <div className="terms-highlights"><article><ShieldCheck size={23} /><strong>Your privacy matters.</strong><p>Private conversations stay in your account. Email alerts never include your chat messages.</p></article><article><CreditCard size={23} /><strong>Know where you pay.</strong><p>Packages: Dawit Aynalem via Telebirr or CBE, with a 5% fee. Appointments: pay your therapist directly.</p></article><article><CalendarDays size={23} /><strong>Plans can change.</strong><p>Give at least 24 hours’ notice. Contact us for help with a cancellation, emergency, or unused credit.</p></article></div>
    <div className="care-strip"><p>The highlights are a guide. Please read the full terms below.</p><Link href={therapist ? '/terms' : '/terms/therapists'}>{therapist ? 'Client terms' : 'Therapist terms'} →</Link></div>
    <div className="terms-reading"><nav className="terms-index" aria-label="Terms contents">{sections.map(s => <a key={s.id} href={'#' + s.id}>{s.title}</a>)}</nav><div className="terms-copy">{sections.map(s => <section id={s.id} key={s.id}><h2>{s.title}</h2>{s.paragraphs.map((p,i) => <p key={i}>{p}</p>)}</section>)}</div></div>
    <section className="care-card"><h2>Questions before you agree?</h2><p>Write to <a href="mailto:addispsychology@gmail.com">addispsychology@gmail.com</a>. We’re here to help you understand your options.</p><Link className="outline" href="/account">Back to my account →</Link></section>
  </div></Page>;
}
