'use client';
import { Suspense, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { usePlatform } from '@/components/Platform';
import { Page, DemoNote, Presence, Modal } from '@/components/Shell';
import { bundles, discountedPrice } from '@/lib/commerce';

function Packages() {
  const { t, people, money, settings, balance, buy, ready } = usePlatform();
  const params = useSearchParams();
  const id = Number(params.get('therapist') || 1);
  const person = people.find(p => p.id === id);
  const [selected, setSelected] = useState('starter');
  const [review, setReview] = useState(false);
  const [complete, setComplete] = useState(false);
  const busy = useRef(false);
  const b = bundles.find(p => p.id === selected)!;

  if (!person) return <Page><h1>{t('Therapist not found','ባለሙያው አልተገኘም')}</h1><Link href="/therapists">{t('Back to directory','ወደ ዝርዝር ተመለስ')}</Link></Page>;

  const price = discountedPrice(b.price, settings(id).discount);

  return (
    <Page>
      <DemoNote />
      <div style={{display:'flex',alignItems:'center',gap:'24px',marginBottom:'8px',flexWrap:'wrap'}}>
        <span className="eyebrow">{t('01 SELECT / 02 CHECKOUT / 03 CHAT','01 ይምረጡ / 02 ይክፈሉ / 03 ይወያዩ')}</span>
        <Link href={`/schedule/${id}`} style={{fontSize:'12px',marginLeft:'auto'}}>{t('Book a session instead →','ቀጠሮ ለመያዝ →')}</Link>
      </div>
      <h1>{t('A little more connected.','በቅርበት ይገናኙ።')}</h1>
      <p className="lede">
        {t('Prepaid texts and voice notes with','ቅድመ ክፍያ ያላቸው ጽሑፍና ድምፅ ከ')}{' '}
        <strong>{person.name}</strong>.
      </p>
      <Presence id={id} />

      {/* How it works */}
      <div className="explanation-grid">
        <div>
          <b>01</b>
          <h3>{t('Choose a package','ጥቅል ይምረጡ')}</h3>
          <p>{t('One credit per sent text (up to 2,000 chars). One voice credit per recording (up to 60 secs).','1 ክሬዲት ለጽሑፍ · 1 ለድምፅ')}</p>
        </div>
        <div>
          <b>02</b>
          <h3>{t('Know what you get','የሚያገኙትን ይወቁ')}</h3>
          <p>{t('Credits belong to this therapist only. No subscription. Unused demo credits do not expire.','ክሬዲቶቹ ለዚህ ባለሙያ ብቻ ናቸው። ምዝገባ የለም።')}</p>
        </div>
        <div>
          <b>03</b>
          <h3>{t('Send at your pace','በሚምቸዎት ጊዜ ይላኩ')}</h3>
          <p>{t('Messaging is async. Online status does not guarantee an immediate reply. Not an emergency service.','መልስ ወዲያውኑ ላይደርስ ይችላል። የአደጋ ጊዜ አገልግሎት አይደለም።')}</p>
        </div>
      </div>

      {/* Bundle grid */}
      <div className="bundle-grid">
        {bundles.map((p, i) => (
          <button className="bundle-card" aria-pressed={selected === p.id} key={p.id} onClick={() => setSelected(p.id)}>
            <span className="eyebrow">0{i+1} / {i===0?t('STARTER','መጀመሪያ'):i===1?t('REGULAR','መደበኛ'):t('EXTENDED','ሰፊ')}</span>
            <strong>{money(discountedPrice(p.price, settings(id).discount))}</strong>
            {settings(id).discount > 0 && <del style={{fontSize:'14px',color:'#888'}}>{money(p.price)}</del>}
            <span>{p.texts} {t('text messages','የጽሑፍ መልዕክቶች')}</span>
            <span>{p.voices} {t('voice messages','የድምፅ መልዕክቶች')}</span>
            <small>{selected === p.id ? t('✓ SELECTED','✓ ተመርጧል') : t('SELECT','ምረጥ')}</small>
          </button>
        ))}
      </div>

      {/* Checkout summary */}
      <div className="checkout-summary">
        <div>
          <h3>{t('Your current balance','አሁን ያለዎት ቀሪ')}</h3>
          <p>{balance(id).texts} {t('texts','ጽሑፍ')} / {balance(id).voices} {t('voice notes','ድምፅ')}</p>
          <Link href={`/chat?therapist=${id}`}>{t('Open conversation','ውይይት ክፈት')}</Link>
        </div>
        <button className="solid" disabled={!ready} onClick={() => { busy.current = false; setComplete(false); setReview(true); }}>
          {t('Review demo purchase','ግዢውን ይገምግሙ')} · {money(price)}
        </button>
      </div>

      {review && (
        <Modal title={complete ? t('Your package is ready','ጥቅልዎ ዝግጁ ነው') : t('Review your package','ጥቅልዎን ይገምግሙ')} close={() => setReview(false)}>
          {complete ? (
            <>
              <p style={{fontSize:'18px',fontWeight:600}}>✓ {t('Demo credits added. No money was charged.','የማሳያ ክሬዲቶች ተጨምረዋል። ገንዘብ አልተከፈለም።')}</p>
              <div style={{display:'flex',gap:'12px',marginTop:'24px',flexWrap:'wrap'}}>
                <Link className="solid" href={`/chat?therapist=${id}`}>{t('Start chatting','ቻት ጀምር')}</Link>
                <Link href={`/schedule/${id}`}>{t('Book a session','ቀጠሮ ያዙ')}</Link>
              </div>
            </>
          ) : (
            <>
              <p style={{fontWeight:600}}>{person.name}</p>
              <dl className="summary-list">
                <div><dt>{t('Text messages','ጽሑፍ')}</dt><dd>{b.texts}</dd></div>
                <div><dt>{t('Voice messages','ድምፅ')}</dt><dd>{b.voices}</dd></div>
                <div><dt>{t('Discount','ቅናሽ')}</dt><dd>{settings(id).discount}%</dd></div>
                <div><dt>{t('Demo total','ጠቅላላ')}</dt><dd>{money(price)}</dd></div>
              </dl>
              <div className="notice">{t('This simulates a purchase. No payment details collected and no money charged.','ይህ የግዢ ማሳያ ነው። የክፍያ መረጃ አይሰበሰብም፣ ገንዘብም አይከፈልም።')}</div>
              <button className="solid full" onClick={() => { if (busy.current) return; busy.current = true; if (buy(id, selected)) setComplete(true); else busy.current = false; }}>
                {t('Simulate purchase — no charge','ግዢውን ፈጸም — ያለ ክፍያ')}
              </button>
            </>
          )}
        </Modal>
      )}
    </Page>
  );
}

export default function PackagesPage() { return <Suspense><Packages /></Suspense>; }
