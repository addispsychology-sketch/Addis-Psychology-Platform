'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const quotes = [
  {
    en: 'Healing is not weakness. It is the most disciplined act of self-mastery.',
    am: 'መዳን ድካም አይደለም። የራስን ማንነት የመግዛት ጥበብ ነው።',
    author: 'Addis Psychology Platform',
  },
  {
    en: 'The shoe that fits one person pinches another; there is no recipe for living that suits all cases.',
    am: 'ለአንዱ የተመቸው ጫማ ሌላውን ያጠባል፤ ለሁሉም የሚሆን አንድ ዓይነት የሕይወት ቀመር የለም።',
    author: 'Carl Jung',
  },
  {
    en: 'When we are no longer able to change a situation, we are challenged to change ourselves.',
    am: 'ሁኔታዎችን መለወጥ በማንችልበት ጊዜ፣ ራሳችንን እንድንለውጥ እንፈተናለን።',
    author: 'Viktor E. Frankl',
  },
  {
    en: 'Asking for help isn’t vulnerability — it is profound tactical clarity.',
    am: 'እርዳታ መጠየቅ ድካም ሳይሆን ከፍተኛ የአእምሮ ብልሃትና ግልጽነት ነው።',
    author: 'Addis Psychology Platform',
  },
  {
    en: 'The curious paradox is that when I accept myself just as I am, then I can change.',
    am: 'የሚገርመው እውነት ራሴን እንዳለሁ ስቀበል ብቻ መለወጥ እችላለሁ።',
    author: 'Carl Rogers',
  },
  {
    en: 'Your feelings are valid visitors. Welcome them, understand them, and let them guide you.',
    am: 'ስሜቶችዎ እንግዶች ናቸው። ተቀበሏቸው፣ አስተውሏቸው፣ ከዚያም ወደ ብርሃን ይምሯችሁ።',
    author: 'Addis Psychology Platform',
  },
  {
    en: 'Knowing your own darkness is the best method for dealing with the darknesses of others.',
    am: 'የራስዎን ጨለማ ጠንቅቆ ማወቅ የሌሎችን ጨለማ ለመረዳት የተሻለው መንገድ ነው።',
    author: 'Addis Clinical Collective',
  },
];

export default function LoadingScreen() {
  const [loading, setLoading] = useState(false);
  const [quoteIndex, setQuoteIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  // Show loading screen on home page visit
  useEffect(() => {
    if (window.location.pathname !== '/') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    
    setLoading(true);
    setQuoteIndex(Math.floor(Math.random() * quotes.length));
    
    const startTime = Date.now();
    const duration = 1600;

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, Math.round((elapsed / duration) * 100));
      setProgress(pct);

      if (pct >= 100) {
        clearInterval(interval);
        setLoading(false);
      }
    }, 40);

    return () => clearInterval(interval);
  }, []);

  // Lock document scrolling while full-screen loading is active
  useEffect(() => {
    if (loading) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, [loading]);

  const activeQuote = quotes[quoteIndex];

  return (
    <AnimatePresence>
      {loading && (
        <motion.div
          key="route-loader"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: 'easeInOut' }}
          className="fullscreen-loading-screen"
          onClick={() => setLoading(false)}
          role="status"
          aria-live="polite"
        >
          {/* Subtle brutalist grid overlay */}
          <div className="fullscreen-loading-grid" />

          {/* Central Hero Quote Experience */}
          <main className="fullscreen-loading-center">
            {/* Animated Rotating Geometric Emblem */}
            <div className="fullscreen-loading-icon-wrap">
              <motion.div
                className="loading-aperture-large"
                animate={{ rotate: 360 }}
                transition={{ duration: 16, repeat: Infinity, ease: 'linear' }}
              >
                <div className="aperture-inner-ring" />
                <div className="aperture-crosshair vertical" />
                <div className="aperture-crosshair horizontal" />
                <div className="aperture-center-core" />
              </motion.div>
            </div>

            {/* Inspiring Psychological Quote */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="fullscreen-quote-container"
            >
              <span className="fullscreen-quote-badge">
                REFLECTIVE MEDITATION / የዕለቱ ማስታወሻ
              </span>

              <blockquote className="fullscreen-quote-text-en">
                &ldquo;{activeQuote.en}&rdquo;
              </blockquote>

              <p className="fullscreen-quote-text-am">{activeQuote.am}</p>

              <cite className="fullscreen-quote-author">
                — {activeQuote.author}
              </cite>
            </motion.div>
          </main>

          {/* Bottom Dock with Full-Bleed Progress Bar & Skip Option */}
          <footer className="fullscreen-loading-footer">
            <div className="fullscreen-loading-meta">
              <span>PREPARING YOUR CONFIDENTIAL ENVIRONMENT</span>
              <strong>{progress}%</strong>
            </div>

            <div className="fullscreen-progress-bar-track">
              <motion.div
                className="fullscreen-progress-bar-fill"
                style={{ width: `${progress}%` }}
              />
            </div>

            <div className="fullscreen-skip-row">
              <small>Click anywhere or tap screen to proceed immediately · ጠቅ ያድርጉ ለመዝለል</small>
            </div>
          </footer>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
