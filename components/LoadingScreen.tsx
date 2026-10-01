'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';

const quotes = [
  { text: "Healing is not weakness. It is the most disciplined act of self-mastery.", author: "Addis Psychology Platform" },
  { text: "The mind is the foundation of everything. Strengthen it.", author: "Dr. Selamawit Tadesse" },
  { text: "Asking for help isn't vulnerability — it's strategy.", author: "Addis Psychology Platform" },
  { text: "The bravest thing you can do is decide to know yourself better.", author: "Addis Psychology Platform" },
];

interface LoadingScreenProps {
  onFinish: () => void;
}

export default function LoadingScreen({ onFinish }: LoadingScreenProps) {
  const [progress, setProgress] = useState(0);
  const [quoteIndex] = useState(() => Math.floor(Math.random() * quotes.length));

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) { clearInterval(interval); setTimeout(onFinish, 700); return 100; }
        return prev + 1.5;
      });
    }, 50);
    return () => clearInterval(interval);
  }, [onFinish]);

  const quote = quotes[quoteIndex];

  return (
    <motion.div
      className="fixed inset-0 bg-loading grid-pattern flex flex-col items-center justify-center overflow-hidden"
      exit={{ opacity: 0, filter: 'blur(10px)', scale: 1.03 }}
      transition={{ duration: 0.7, ease: 'easeInOut' }}
    >
      {/* Ambient glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(0,212,170,0.08) 0%, transparent 70%)', filter: 'blur(40px)' }} />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(79,142,247,0.08) 0%, transparent 70%)', filter: 'blur(40px)' }} />

      {/* Scan line effect */}
      <motion.div
        className="absolute inset-x-0 h-px pointer-events-none"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(0,212,170,0.4), transparent)' }}
        animate={{ y: ['-100vh', '100vh'] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'linear', repeatDelay: 2 }}
      />

      {/* Orbiting particles */}
      {[0, 1, 2].map(i => (
        <motion.div
          key={i}
          className="absolute w-1.5 h-1.5 rounded-full"
          style={{
            background: i === 0 ? 'var(--teal)' : i === 1 ? 'var(--electric-blue)' : 'var(--gold)',
            top: '50%', left: '50%',
          }}
          animate={{ rotate: 360 }}
          transition={{
            duration: 8 + i * 4,
            repeat: Infinity,
            ease: 'linear',
            delay: i * 2,
          }}
        />
      ))}

      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, y: -24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
        className="flex flex-col items-center mb-12"
      >
        {/* Logo mark */}
        <div className="flex items-center gap-3 mb-3">
          <motion.div
            className="logo-mark w-14 h-14 flex items-center justify-center glow-teal"
            whileHover={{ scale: 1.05 }}
          >
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <path d="M14 3C8.477 3 4 7.477 4 13C4 16.5 5.8 19.6 8.5 21.5L7 25L11.5 23C12.3 23.3 13.1 23.5 14 23.5C19.523 23.5 24 19.023 24 13.5C24 7.977 19.523 3 14 3Z" fill="white" fillOpacity="0.9"/>
              <circle cx="10" cy="14" r="1.5" fill="#0A0F1E"/>
              <circle cx="14" cy="14" r="1.5" fill="#0A0F1E"/>
              <circle cx="18" cy="14" r="1.5" fill="#0A0F1E"/>
            </svg>
          </motion.div>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
              Addis <span className="shimmer-text">Psychology</span>
            </h1>
            <p className="text-xs font-medium tracking-widest uppercase" style={{ color: 'var(--text-muted)' }}>
              Mental Health Platform
            </p>
          </div>
        </div>
      </motion.div>

      {/* Quote card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.7, delay: 0.3 }}
        className="max-w-lg text-center px-6 mb-14"
      >
        <div className="glass rounded-2xl p-8 relative overflow-hidden">
          {/* Top accent line */}
          <div className="absolute top-0 left-0 right-0 h-px"
            style={{ background: 'linear-gradient(90deg, transparent, var(--teal), transparent)' }} />
          
          <p className="font-display text-xl font-semibold leading-relaxed mb-4" style={{ color: 'var(--text-primary)' }}>
            &ldquo;{quote.text}&rdquo;
          </p>
          <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: 'var(--text-accent)' }}>
            — {quote.author}
          </p>
        </div>
      </motion.div>

      {/* Progress */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="flex flex-col items-center gap-3 w-72"
      >
        <div className="progress-track w-full">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <div className="flex items-center justify-between w-full">
          <motion.p
            className="text-xs font-medium tracking-wide"
            style={{ color: 'var(--text-muted)' }}
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            Initializing your session...
          </motion.p>
          <span className="text-xs font-bold tabular-nums" style={{ color: 'var(--teal)' }}>
            {Math.round(progress)}%
          </span>
        </div>
      </motion.div>

      {/* Skip for returning clients */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
        className="absolute bottom-10 flex flex-col items-center gap-2"
      >
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Already registered?</p>
        <Link href="/therapists">
          <button className="btn-ghost py-2 px-5 text-sm">
            Skip to Therapist Directory →
          </button>
        </Link>
      </motion.div>
    </motion.div>
  );
}
