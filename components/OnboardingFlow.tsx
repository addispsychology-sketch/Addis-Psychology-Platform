'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { usePlatform } from '@/components/Platform';
import { Header, Footer, Flower } from '@/components/Shell';

export default function OnboardingFlow() {
  const { t } = usePlatform();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [concerns, setConcerns] = useState<string[]>([]);
  const [medium, setMedium] = useState('online');

  const labels = [t('Welcome', 'እንኳን ደህና መጡ'), t('Your needs', 'ፍላጎትዎ'), t('Preferences', 'ምርጫዎች')];
  const options: [string, string][] = [
    [t('Anxiety & stress', 'ጭንቀትና ውጥረት'), 'anxiety'],
    [t('Low mood & depression', 'ድብርትና ድካም'), 'depression'],
    [t('Relationships & couples', 'ግንኙነትና ጋብቻ'), 'relationships'],
    [t('Grief & heavy loss', 'ሐዘንና ማጣት'), 'grief'],
    [t('Self-confidence', 'በራስ መተማመን'), 'confidence'],
    [t('Something else', 'ሌላ ጉዳይ'), 'other'],
  ];

  return (
    <>
      <Header />

      {/* ── HERO & ONBOARDING ── */}
      <main className="home-layout">
        {/* Left: RawBlock Manifesto */}
        <section className="home-manifesto">
          <span className="eyebrow">{t('01 / YOUR SPACE TO BEGIN', '01 / መጀመሪያዎ')}</span>
          <h1>
            {t('You don’t have to', 'ሁሉንም ነገር')}<br />
            {t('figure it out', 'መፍታት')}<br />
            <span>{t('alone.', 'ብቻዎን አይጠበቅብዎትም።')}</span>
          </h1>
          <p>
            {t(
              'Support should feel human, confidential, and unhurried. Find a licensed therapist who understands you — on your schedule, in your language.',
              'ድጋፍ ሰብዓዊ፣ ሚስጥራዊና ያልተጣደፈ መሆን አለበት። በሚመችዎት ጊዜና በቋንቋዎ የሚረዳዎትን ፈቃድ ያለው ባለሙያ ያግኙ።'
            )}
          </p>

          <div className="home-hero-actions">
            <Link href="/therapists" className="solid">
              {t('Explore Therapists →', 'ባለሙያዎችን ይመልከቱ →')}
            </Link>
            <Link href="/packages" style={{ fontSize: '13px', fontWeight: 600 }}>
              {t('Browse Chat Packages', 'የቻት ጥቅሎችን ይመልከቱ')}
            </Link>
          </div>
        </section>

        {/* Right: Focused Onboarding Card */}
        <section className="onboarding-box">
          <div className="section-line">
            <span>{t("LET'S START SMALL", 'በቀላሉ እንጀምር')}</span>
            <span>0{step + 1} / 03</span>
          </div>

          <ol className="onboarding-progress">
            {labels.map((l, i) => (
              <li key={l} aria-current={step === i ? 'step' : undefined} className={i <= step ? 'active' : ''}>{l}</li>
            ))}
          </ol>

          <form onSubmit={e => { e.preventDefault(); if (step < 2) setStep(step + 1); else window.location.href = '/therapists'; }}>
            {step === 0 ? (
              <>
                <h2>{t('Good to have you here.', 'እዚህ በመምጣትዎ ደስ ብሎናል።')}</h2>
                <p>{t('A few simple questions to understand how best to support you. You can browse completely anonymously.', 'ለመጀመር የሚያግዙ ጥቂት ጥያቄዎች። ማንነትዎን ሳይገልጹ መመልከት ይችላሉ።')}</p>
                <label>
                  {t('What should we call you? (optional)', 'በምን ስም እንጥራዎት? (አማራጭ)')}
                  <input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder={t('Your first name or preferred alias', 'የመጀመሪያ ስምዎ')}
                    autoComplete="given-name"
                    maxLength={60}
                  />
                </label>
              </>
            ) : step === 1 ? (
              <>
                <h2>{t('What brings you here?', 'ምን አመጣዎት?')}</h2>
                <p>{t('Select whatever applies right now. There are no right or wrong answers.', 'የሚመለከትዎትን ይምረጡ። ትክክል ወይም ስህተት የሆነ መልስ የለም።')}</p>
                <div className="choice-grid">
                  {options.map(([label, id]) => (
                    <button
                      type="button"
                      aria-pressed={concerns.includes(id)}
                      key={id}
                      onClick={() => setConcerns(c => c.includes(id) ? c.filter(n => n !== id) : [...c, id])}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <h2>{t('Choose how you connect.', 'እንዴት መገናኘት እንደሚፈልጉ ይምረጡ።')}</h2>
                <p>{t('Select your preferred medium. You can adjust this whenever booking.', 'የሚመርጡትን መንገድ ይምረጡ። ቀጠሮ ሲይዙ መቀየር ይችላሉ።')}</p>
                <div className="choice-grid">
                  {([
                    ['online', t('💻 Video session', '💻 የቪዲዮ ቀጠሮ')],
                    ['inperson', t('🏥 In-person session', '🏥 በአካል ቀጠሮ')],
                    ['chat', t('💬 Text & voice chat', '💬 የጽሑፍና የድምፅ ቻት')],
                  ] as [string, string][]).map(([id, label]) => (
                    <button key={id} type="button" aria-pressed={medium === id} onClick={() => setMedium(id)}>
                      {label}
                    </button>
                  ))}
                </div>
                <p className="muted" style={{ fontSize: '13px' }}>
                  {t(
                    'Prepaid text & voice packages let you message at your own pace without scheduled video calls.',
                    'የቅድመ ክፍያ ቻት ጥቅሎች ቀጠሮ ሳያስፈልግ በራስዎ ፍጥነት መልዕክት ለመላክ ያስችሉዎታል።'
                  )}
                </p>
              </>
            )}

            <div className="form-actions">
              <button type="button" disabled={step === 0} onClick={() => setStep(step - 1)}>
                {t('Back', 'ተመለስ')}
              </button>
              <button className="solid" type="submit">
                {step === 2 ? t('Find my therapist →', 'ባለሙያ ፈልግ →') : t('Continue', 'ቀጥል')}
              </button>
            </div>
          </form>
          <small>{t('Your selections stay private on your device.', 'ምርጫዎችዎ በግል ይቀመጣሉ፤ አይላኩም።')}</small>
        </section>
      </main>

      {/* ── THE 4 ARTWORKS: AN EDITORIAL GALLERY ON MENTAL HEALTH REALITIES ── */}
      <section className="editorial-gallery-section">
        <div className="editorial-gallery-header">
          <div>
            <span className="eyebrow">{t('02 / ART & REFLECTION', '02 / እውነታዎቻችን')}</span>
            <h2>{t('The realities we carry.', 'የምንሸከማቸው ስሜቶች።')}</h2>
          </div>
          <p>
            {t(
              'Therapy is not just for crises — it is a sanctuary for solitude, relationships, unspoken tension, and untangling heavy thoughts.',
              'ሳይኮሎጂ ለአስቸኳይ ችግር ብቻ አይደለም፤ ለብቸኝነት፣ ለግንኙነቶችና ውስብስብ ስሜቶችን ለመፍታት የታመነ መጠጊያ ነው።'
            )}
          </p>
        </div>

        <div className="editorial-grid">
          {/* Card 1: Solitude */}
          <article className="editorial-card">
            <div className="editorial-card-tag">{t('FIG. 01 / STILLNESS', 'ምስል 01 / ፀጥታ')}</div>
            <div className="editorial-card-media">
              <Image src="/img-seated.png" alt="Person sitting alone in reflection" width={320} height={280} unoptimized />
            </div>
            <div className="editorial-caption">
              <div>
                <strong>{t('Solitude & Weariness', 'ብቸኝነትና ድካም')}</strong>
                <p>{t('When even getting through ordinary tasks feels heavy, taking a pause is an act of courage.', 'ቀላል የሚባሉ ነገሮች እንኳን ሲከብዱ፣ እረፍት መውሰድ የጥንካሬ ምልክት ነው።')}</p>
              </div>
              <Link href="/therapists">{t('Explore support →', 'ድጋፍ ፈልግ →')}</Link>
            </div>
          </article>

          {/* Card 2: Tangled Overwhelm */}
          <article className="editorial-card">
            <div className="editorial-card-tag">{t('FIG. 02 / OVERWHELM', 'ምስል 02 / ውጥረት')}</div>
            <div className="editorial-card-media">
              <Image src="/img-overwhelmed.png" alt="Person holding head amid mental overwhelm" width={320} height={280} unoptimized />
            </div>
            <div className="editorial-caption">
              <div>
                <strong>{t('Anxiety & Mental Noise', 'ጭንቀትና የውስጥ ድምፅ')}</strong>
                <p>{t('When worry spirals and thoughts tangle faster than you can sort them, our clinicians help you breathe.', 'ጭንቀት ሲበረታታና ሃሳቦች ሲዘበራረቁ፣ ባለሙያዎቻችን መረጋጋትን እንዲያገኙ ይረዱዎታል።')}</p>
              </div>
              <Link href="/therapists">{t('Find anxiety care →', 'የጭንቀት ድጋፍ →')}</Link>
            </div>
          </article>

          {/* Card 3: Couples Distance */}
          <article className="editorial-card dark-theme">
            <div className="editorial-card-tag">{t('FIG. 03 / SILENCE', 'ምስል 03 / ዝምታ')}</div>
            <div className="editorial-card-media">
              <Image src="/img-couple.png" alt="Two people sitting apart in quiet darkness" width={320} height={280} unoptimized />
            </div>
            <div className="editorial-caption">
              <div>
                <strong>{t('Relationships & Distance', 'ግንኙነትና ርቀት')}</strong>
                <p>{t('When silence grows between two people on the same sofa, guided conversation builds the bridge back.', 'በአንድ ሶፋ ላይ በዝምታ መራራቅ ሲፈጠር፣ የታገዘ ውይይት ድልድይ ይገነባል።')}</p>
              </div>
              <Link href="/therapists">{t('Couples counseling →', 'የጋብቻ ምክር →')}</Link>
            </div>
          </article>

          {/* Card 4: The Unspoken */}
          <article className="editorial-card">
            <div className="editorial-card-tag">{t('FIG. 04 / SAFE HAVEN', 'ምስል 04 / መጠጊያ')}</div>
            <div className="editorial-card-media">
              <Image src="/img-unseen.png" alt="Person with brushstroke over eyes representing privacy and unspoken truth" width={320} height={280} unoptimized />
            </div>
            <div className="editorial-caption">
              <div>
                <strong>{t('The Unspoken Truths', 'ያልተነገሩ እውነታዎች')}</strong>
                <p>{t('A confidential, judgment-free space to speak the truths you hold behind closed doors.', 'ከፍርድ ነጻ በሆነ ቦታ፣ በውስጥዎ የያዙትን ሚስጥር በነጻነት የሚናገሩበት አስተማማኝ ቦታ።')}</p>
              </div>
              <Link href="/chat">{t('Start with text chat →', 'በቻት ጀምር →')}</Link>
            </div>
          </article>
        </div>
      </section>

      {/* ── FAST BOOKING & PACKAGES ACTION STRIP ── */}
      <section className="quick-action-strip">
        <div>
          <span className="eyebrow" style={{ color: '#aaa' }}>{t('ACCESSIBLE CARE / Addis Ababa', 'ቀጥታ እንክብካቤ / አዲስ አበባ')}</span>
          <h3>{t('Ready to begin? Choose your rhythm.', 'ለመጀመር ዝግጁ ነዎት? የሚመችዎትን ይምረጡ።')}</h3>
          <p>{t('Book an online video session, meet in person at an Addis clinic, or exchange confidential text & voice notes.', 'የቪዲዮ ቀጠሮ ይያዙ፣ በአካል በአዲስ አበባ ክሊኒክ ይገናኙ፣ ወይም በድምፅና በጽሑፍ መልዕክት ይወያዩ።')}</p>
        </div>
        <div className="quick-action-buttons">
          <Link href="/therapists" className="solid">
            ⚡ {t('View All Therapists', 'ባለሙያዎችን ይመልከቱ')}
          </Link>
          <Link href="/packages" className="outline">
            💬 {t('Voice & Text Packages', 'የቻት ጥቅሎች')}
          </Link>
        </div>
      </section>

      <Footer />
    </>
  );
}
