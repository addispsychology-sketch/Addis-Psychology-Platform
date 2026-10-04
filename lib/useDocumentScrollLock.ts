'use client';
import { useEffect } from 'react';

export function useDocumentScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const bodyOverflow = document.body.style.overflow;
    const rootOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = bodyOverflow;
      document.documentElement.style.overflow = rootOverflow;
    };
  }, [active]);
}
