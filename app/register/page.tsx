'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { usePlatform, Registration } from '@/components/Platform';
import { Page, DemoNote, Photo } from '@/components/Shell';
import PhotoUpload from '@/components/PhotoUpload';
import { motion, AnimatePresence } from 'framer-motion';

const SPECIALTY_OPTIONS = [
  'Anxiety & Stress',
  'Depression & Mood',
  'Trauma & PTSD',
  'Relationship & Couples',
  'Family Dynamics',
  'Child & Adolescent',
  'Grief & Loss',
  'Self-Esteem & Identity',
  'Career & Burnout',
  'Mindfulness & Somatics',
];

const LANGUAGE_OPTIONS: [string, string][] = [
  ['Amharic', 'አማርኛ'],
  ['English', 'እንግሊዝኛ'],
  ['Oromiffa', 'አፋን ኦሮሞ'],
  ['Tigrinya', 'ትግርኛ'],
  ['Somali', 'ሶማሊኛ'],
];

export default function RegisterPage() {
  const { t, register, state } = usePlatform();
  const router = useRouter();

  const [step, setStep] = useState(0);
  const [createdId, setCreatedId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [agree, setAgree] = useState(false);

  const [form, setForm] = useState<Registration>(
    state.registration || {
      name: '',
      email: '',
      phone: '',
      title: 'Clinical Psychologist',
      license: '',
      bio: '',
      languages: ['Amharic', 'English'],
      photo: '',
      specialties: ['Anxiety & Stress', 'Depression & Mood'],
      onlinePrice: 1100,
      inpersonPrice: 1500,
    }
  );

  function update<K extends keyof Registration>(key: K, value: Registration[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  function toggleSpecialty(s: string) {
    const current = form.specialties || [];
    if (current.includes(s)) {
      update('specialties', current.filter(x => x !== s));
    } else {
      update('specialties', [...current, s]);
    }
  }

  function toggleLanguage(langName: string) {
    const current = form.languages || [];
    if (current.includes(langName)) {
      if (current.length > 1) {
        update('languages', current.filter(x => x !== langName));
      }
    } else {
      update('languages', [...current, langName]);
    }
  }

  function validateStep(s: number): boolean {
    setError('');
    if (s === 0) {
      if (!form.name.trim()) {
        setError(t('Please enter your full professional name.', 'እባክዎ ሙሉ የሙያ ስምዎን ያስገቡ።'));
        return false;
      }
      if (!form.email.trim() || !/^\S+@\S+\.\S+$/.test(form.email)) {
        setError(t('Please provide a valid email address.', 'ትክክለኛ ኢሜይል አድራሻ ያስገቡ።'));
        return false;
      }
      if (!form.phone.trim()) {
        setError(t('Please provide a contact phone number.', 'የመገኛ ስልክ ቁጥር ያስገቡ።'));
        return false;
      }
      return true;
    }

    if (s === 1) {
      if (!form.title.trim()) {
        setError(t('Please specify your professional clinical title.', 'የሙያ ማዕረግዎን ይግለጹ።'));
        return false;
      }
      if (!form.license.trim()) {
        setError(t('Please input your license or accreditation number.', 'የሙያ ፈቃድ ወይም የምዝገባ ቁጥር ያስገቡ።'));
        return false;
      }
      if (!form.languages.length) {
        setError(t('Select at least one language for sessions.', 'ቢያንስ አንድ የሥራ ቋንቋ ይምረጡ።'));
        return false;
      }
      return true;
    }

    if (s === 2) {
      if (!form.specialties?.length) {
        setError(t('Select at least one clinical focus area.', 'ቢያንስ አንድ የሙያ ትኩረት ይምረጡ።'));
        return false;
      }
      if (!form.bio.trim() || form.bio.length < 30) {
        setError(
          t(
            'Please write a brief clinical bio of at least 30 characters.',
            'እባክዎ ቢያንስ 30 ፊደላት ያለው አጭር የሙያ መግለጫ ያስገቡ።'
          )
        );
        return false;
      }
      return true;
    }

    return true;
  }

  function handleNext() {
    if (validateStep(step)) {
      if (step < 3) {
        setStep(step + 1);
      } else {
        handleSubmit();
      }
    }
  }

  async function handleSubmit() {
    if (!agree) {
      setError(t('Please acknowledge the terms to proceed.', 'እባክዎ ውሉን ያረጋግጡ።'));
      return;
    }
    try { const newId = await register(form); setCreatedId(newId); } catch (error) { setError(error instanceof Error ? error.message : 'Registration failed.'); }
  }

  const stepsList = [
    t('1. Identity & Photo', '1. መለያና ፎቶ'),
    t('2. Credentials', '2. ማስረጃና ፈቃድ'),
    t('3. Practice & Bio', '3. ሙያና ዋጋ'),
    t('4. Review & Launch', '4. ማረጋገጫ'),
  ];

  return (
    <Page wide>
      <DemoNote />

      <div style={{ maxWidth: '980px', margin: '0 auto 60px' }}>
        <span className="eyebrow">{t('JOIN THE CLINICAL NETWORK / ADDIS PSYCHOLOGY', 'ለባለሙያዎች / መድረኩን ይቀላቀሉ')}</span>
        <h1 style={{ margin: '8px 0 16px' }}>
          {createdId ? t('Welcome to the Practice.', 'እንኳን ወደ መድረኩ በደህና መጡ።') : t('Establish Your Practice.', 'የሙያ መድረክዎን ይጀምሩ።')}
        </h1>
        <p className="lede">
          {createdId
            ? t(
                'Your application is saved. The project owner must approve your credentials before clients can find your practice or start a conversation.',
                'የሙያ መገለጫዎ በተሳካ ሁኔታ ተመዝግቧል። አሁን የቀጠሮ ሰሌዳዎንና የደንበኛ ውይይቶችን ማስተዳደር ይችላሉ።'
              )
            : t(
                'Addis Psychology provides licensed mental health practitioners with an editorial digital sanctuary. Manage calendar slots, pricing, voice/text consultations, and secure client relationships in one place.',
                'የቀጠሮ ሰሌዳዎን፣ የሥራ ሰዓትዎን፣ ዋጋዎችንና ሚስጥራዊ የደንበኛ ውይይቶችን በአንድ የተሟላ ቦታ ያስተዳድሩ።'
              )}
        </p>

        {/* ── SUCCESS STATE SCREEN ── */}
        {createdId ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="registration-success-card"
          >
            <div className="registration-success-badge">
              <span>✓ {t('APPLICATION SUBMITTED', 'ማመልከቻው ተልኳል')}</span>
            </div>

            <div className="registration-success-body">
              <div className="profile-detail" style={{ margin: 0 }}>
                <Photo id={createdId} name={form.name} src={form.photo} large />
                <div>
                  <span className="eyebrow">{form.title}</span>
                  <h2 style={{ margin: '4px 0 10px' }}>{form.name}</h2>
                  <p className="muted" style={{ margin: '0 0 14px' }}>{form.bio}</p>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
                    {form.specialties?.map(sp => (
                      <span key={sp} className="admin-badge grey">{sp}</span>
                    ))}
                  </div>
                  <div style={{ font: '13px/1.6 Space Mono, monospace', color: 'var(--text)' }}>
                    <strong>License:</strong> {form.license} &nbsp;|&nbsp;{' '}
                    <strong>Languages:</strong> {form.languages.join(', ')}<br />
                    <strong>Session Rates:</strong> Online: {form.onlinePrice} ETB · In-Person: {form.inpersonPrice} ETB
                  </div>
                </div>
              </div>
            </div>

            <div className="registration-success-actions">
              <Link href={`/portal?therapist=${createdId}`} className="solid">
                🚀 {t('Launch My Therapist Portal', 'የባለሙያ ፖርታሌን ክፈት')} →
              </Link>
              <Link href="/therapists" style={{ padding: '12px 20px', border: '2px solid var(--ink)', fontWeight: 700, textDecoration: 'none' }}>
                👥 {t('View in Public Directory', 'በዝርዝሩ ውስጥ ይመልከቱ')}
              </Link>
              <Link href={`/chat?therapist=${createdId}`} style={{ padding: '12px 20px', border: '2px solid var(--ink)', fontWeight: 700, textDecoration: 'none' }}>
                💬 {t('Test Client Chat Flow', 'የደንበኛ ቻት ሞክር')}
              </Link>
            </div>
          </motion.div>
        ) : (
          /* ── MULTI-STEP REGISTRATION FORM ── */
          <div className="registration-layout-upgraded">
            {/* Left sidebar: Live practitioner preview card */}
            <aside className="registration-preview-aside">
              <div className="registration-preview-box">
                <span className="eyebrow">{t('LIVE DIRECTORY CARD PREVIEW', 'የመገለጫ ቅድመ-እይታ')}</span>
                <div style={{ marginTop: '16px' }}>
                  <Photo id={0} name={form.name || t('Your Name', 'የእርስዎ ስም')} large src={form.photo} />
                </div>
                <h3 style={{ margin: '14px 0 4px', fontSize: '18px' }}>
                  {form.name || t('Dr. Jane Doe', 'ዶ/ር ስም')}
                </h3>
                <p className="muted" style={{ fontSize: '12px', margin: '0 0 10px' }}>
                  {form.title}
                </p>
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '12px' }}>
                  {(form.specialties || []).slice(0, 3).map(s => (
                    <span key={s} style={{ fontSize: '9px', padding: '2px 6px', border: '1px solid var(--ink)' }}>
                      {s}
                    </span>
                  ))}
                </div>
                <div style={{ borderTop: '2px solid var(--ink)', paddingTop: '10px', fontSize: '11px', fontFamily: 'Space Mono, monospace' }}>
                  💻 Online: <strong>{form.onlinePrice} ETB</strong><br />
                  🏥 In-Person: <strong>{form.inpersonPrice} ETB</strong>
                </div>
              </div>

              <div className="registration-tips-box">
                <h4>{t('Clinical Standards', 'የሙያ መመሪያ')}</h4>
                <p>
                  {t(
                    'All practitioners on Addis Psychology adhere to APA & Ethiopian Psychology Association ethics codes.',
                    'ሁሉም ባለሙያዎች የኢትዮጵያ ሳይኮሎጂ ማህበርን የሥነ-ምግባር ደንቦች ያከብራሉ።'
                  )}
                </p>
              </div>
            </aside>

            {/* Right main form container */}
            <div className="registration-main-card">
              {/* Stepper bar */}
              <div className="registration-stepper">
                {stepsList.map((label, idx) => (
                  <button
                    key={label}
                    type="button"
                    className={`registration-step-btn ${step === idx ? 'active' : step > idx ? 'completed' : ''}`}
                    onClick={() => {
                      if (idx < step || validateStep(step)) setStep(idx);
                    }}
                  >
                    <span>{idx + 1}</span>
                    <small>{label}</small>
                  </button>
                ))}
              </div>

              {/* Form Content */}
              <form
                noValidate
                onSubmit={e => {
                  e.preventDefault();
                  handleNext();
                }}
                style={{ marginTop: '24px' }}
              >
                <AnimatePresence mode="wait">
                  {/* ── STEP 1: IDENTITY & CONTACT ── */}
                  {step === 0 && (
                    <motion.div
                      key="step0"
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      transition={{ duration: 0.2 }}
                    >
                      <h2 style={{ fontSize: '24px', marginBottom: '6px' }}>
                        {t('1. Personal Identity & Photo', '1. የግል መለያና ፎቶ')}
                      </h2>
                      <p className="muted" style={{ margin: '0 0 20px', fontSize: '13px' }}>
                        {t('Enter your legal practice details as they should appear to clients.', 'ለደንበኞች የሚታየውን የሙያ መረጃዎን ያስገቡ።')}
                      </p>

                      <label>
                        {t('Full Professional Name (with title)', 'ሙሉ የሙያ ስም')}
                        <input
                          type="text"
                          placeholder="e.g. Dr. Rahel Solomon, PhD or Tigist Hailu, MA"
                          value={form.name}
                          onChange={e => update('name', e.target.value)}
                          maxLength={100}
                        />
                      </label>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <label>
                          {t('Professional Email', 'የሥራ ኢሜይል')}
                          <input
                            type="email"
                            placeholder="practitioner@clinic.et"
                            value={form.email}
                            onChange={e => update('email', e.target.value)}
                          />
                        </label>
                        <label>
                          {t('Direct Phone / Telegram', 'ስልክ ቁጥር')}
                          <input
                            type="tel"
                            placeholder="+251 91 123 4567"
                            value={form.phone}
                            onChange={e => update('phone', e.target.value)}
                          />
                        </label>
                      </div>

                      <div style={{ marginTop: '16px' }}>
                        <PhotoUpload
                          value={form.photo}
                          onChange={v => update('photo', v)}
                        />
                      </div>
                    </motion.div>
                  )}

                  {/* ── STEP 2: CREDENTIALS & LICENSES ── */}
                  {step === 1 && (
                    <motion.div
                      key="step1"
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      transition={{ duration: 0.2 }}
                    >
                      <h2 style={{ fontSize: '24px', marginBottom: '6px' }}>
                        {t('2. Clinical Credentials & Title', '2. የሙያ ፈቃድና ማዕረግ')}
                      </h2>
                      <p className="muted" style={{ margin: '0 0 20px', fontSize: '13px' }}>
                        {t('Demonstrate your clinical qualifications and language capabilities.', 'የሙያ ብቃትዎንና ቋንቋዎችን ያረጋግጡ።')}
                      </p>

                      <label>
                        {t('Primary Clinical Title', 'የሙያ ማዕረግ')}
                        <input
                          type="text"
                          placeholder="e.g. Clinical Psychologist, Family Therapist, Counselor"
                          value={form.title}
                          onChange={e => update('title', e.target.value)}
                          maxLength={100}
                        />
                      </label>

                      <label>
                        {t('License / Accreditation Reference Number', 'የሙያ ፈቃድ ቁጥር')}
                        <input
                          type="text"
                          placeholder="e.g. ET-MOH-PSY-2024-8841"
                          value={form.license}
                          onChange={e => update('license', e.target.value)}
                          maxLength={60}
                        />
                      </label>

                      <div style={{ marginTop: '18px' }}>
                        <label style={{ marginBottom: '8px' }}>
                          {t('Session Languages (Select all that apply)', 'የውይይት ቋንቋዎች')}
                        </label>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          {LANGUAGE_OPTIONS.map(([en, am]) => {
                            const isSelected = form.languages.includes(en);
                            return (
                              <button
                                key={en}
                                type="button"
                                aria-pressed={isSelected}
                                onClick={() => toggleLanguage(en)}
                                style={{ padding: '8px 14px', fontSize: '12px' }}
                              >
                                {isSelected ? '✓ ' : '+ '}
                                {t(en, am)}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* ── STEP 3: PRACTICE FOCUS, RATES & BIO ── */}
                  {step === 2 && (
                    <motion.div
                      key="step2"
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      transition={{ duration: 0.2 }}
                    >
                      <h2 style={{ fontSize: '24px', marginBottom: '6px' }}>
                        {t('3. Practice Focus, Rates & Bio', '3. የሙያ ትኩረት፣ ዋጋና መግለጫ')}
                      </h2>
                      <p className="muted" style={{ margin: '0 0 20px', fontSize: '13px' }}>
                        {t('Help matching clients find your specific clinical focus areas.', 'ደንበኞች የእርስዎን የሙያ ዘርፍ እንዲለዩ ይርዷቸው።')}
                      </p>

                      <label style={{ marginBottom: '8px' }}>
                        {t('Clinical Specialties (Select focus areas)', 'የሕክምና ልዩ ሙያዎች')}
                      </label>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
                        {SPECIALTY_OPTIONS.map(s => {
                          const isSelected = form.specialties?.includes(s);
                          return (
                            <button
                              key={s}
                              type="button"
                              aria-pressed={isSelected}
                              onClick={() => toggleSpecialty(s)}
                              style={{ padding: '7px 12px', fontSize: '11px' }}
                            >
                              {isSelected ? '✓ ' : '+ '}
                              {s}
                            </button>
                          );
                        })}
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                        <label>
                          {t('Online Session Rate (ETB / 50m)', 'የኦንላይን ቀጠሮ ዋጋ (ብር)')}
                          <input
                            type="number"
                            min={200}
                            max={20000}
                            value={form.onlinePrice || 1100}
                            onChange={e => update('onlinePrice', Number(e.target.value))}
                          />
                        </label>
                        <label>
                          {t('In-Person Session Rate (ETB / 50m)', 'የአካል ቀጠሮ ዋጋ (ብር)')}
                          <input
                            type="number"
                            min={200}
                            max={20000}
                            value={form.inpersonPrice || 1500}
                            onChange={e => update('inpersonPrice', Number(e.target.value))}
                          />
                        </label>
                      </div>

                      <label>
                        {t('Practitioner Bio & Therapeutic Philosophy', 'የሙያ ፍልስፍናና አጭር መግለጫ')}
                        <textarea
                          rows={4}
                          maxLength={1000}
                          placeholder={t(
                            'Describe your therapeutic approach, values, and how you support clients in feeling safe and empowered...',
                            'የሕክምና አቀራረብዎንና ለደንበኞች የሚሰጡትን ድጋፍ ይግለጹ...'
                          )}
                          value={form.bio}
                          onChange={e => update('bio', e.target.value)}
                        />
                      </label>
                      <small style={{ color: 'var(--muted-text)', display: 'block', marginTop: '4px' }}>
                        {form.bio.length}/1000 {t('characters', 'ፊደላት')}
                      </small>
                    </motion.div>
                  )}

                  {/* ── STEP 4: REVIEW & CONFIRMATION ── */}
                  {step === 3 && (
                    <motion.div
                      key="step3"
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      transition={{ duration: 0.2 }}
                    >
                      <h2 style={{ fontSize: '24px', marginBottom: '6px' }}>
                        {t('4. Review & Activate Your Practice', '4. ማረጋገጫና ምዝገባ')}
                      </h2>
                      <p className="muted" style={{ margin: '0 0 20px', fontSize: '13px' }}>
                        {t('Confirm your practice profile before activating your workspace.', 'የሙያ መገለጫዎን አረጋግጠው ይመዝገቡ።')}
                      </p>

                      <div className="registration-review-summary">
                        <div>
                          <strong>{t('Practitioner Name:', 'ስም:')}</strong> {form.name}
                        </div>
                        <div>
                          <strong>{t('Title:', 'ማዕረግ:')}</strong> {form.title}
                        </div>
                        <div>
                          <strong>{t('Email & Phone:', 'ኢሜይልና ስልክ:')}</strong> {form.email} · {form.phone}
                        </div>
                        <div>
                          <strong>{t('License #:', 'ፈቃድ ቁጥር:')}</strong> {form.license}
                        </div>
                        <div>
                          <strong>{t('Languages:', 'ቋንቋዎች:')}</strong> {form.languages.join(', ')}
                        </div>
                        <div>
                          <strong>{t('Specialties:', 'ልዩ ሙያዎች:')}</strong> {form.specialties?.join(', ')}
                        </div>
                        <div>
                          <strong>{t('Session Rates:', 'ዋጋ:')}</strong> Online: {form.onlinePrice} ETB · In-Person: {form.inpersonPrice} ETB
                        </div>
                        <div style={{ marginTop: '10px', fontStyle: 'italic', color: 'var(--muted-text)' }}>
                          &ldquo;{form.bio}&rdquo;
                        </div>
                      </div>

                      <div style={{ margin: '24px 0 16px' }}>
                        <label className="checkbox-label" style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                          <input
                            type="checkbox"
                            checked={agree}
                            onChange={e => setAgree(e.target.checked)}
                            style={{ marginTop: '3px' }}
                          />
                          <span style={{ fontSize: '13px', lineHeight: '1.4' }}>
                            {t(
                              'I certify that I am a licensed mental health professional. I consent to storing my application securely for review and understand that approval is required before my practice is listed.',
                              'የተፈቀደልኝ የሥነ-አእምሮ ባለሙያ መሆኔን አረጋግጣለሁ። ምስጢራዊነትንና የሥነ-ምግባር ደንቦችን ለማክበር እስማማለሁ።'
                            )}
                          </span>
                        </label>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {error && (
                  <p role="alert" className="error-note" style={{ margin: '16px 0 8px', color: 'var(--danger)', fontSize: '13px', fontWeight: 600 }}>
                    ⚠ {error}
                  </p>
                )}

                {/* Stepper buttons */}
                <div className="form-actions" style={{ marginTop: '28px', display: 'flex', gap: '12px' }}>
                  {step > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setStep(step - 1);
                        setError('');
                      }}
                    >
                      ← {t('Previous', 'ተመለስ')}
                    </button>
                  )}
                  <button type="submit" className="solid" style={{ flex: 1 }}>
                    {step === 3
                      ? `🚀 ${t('Submit Practice for Review', 'አረጋግጥና ምዝገባ አጠናቅቅ')}`
                      : `${t('Continue', 'ቀጥል')} →`}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Page>
  );
}
