'use client';
import { useEffect, useState } from 'react';
import { authenticatedFetch } from '@/lib/supabase';
export default function PrivateAudio({ src }: { src: string }) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    if (src.startsWith('blob:')) {
      setUrl(src);
      return;
    }
    authenticatedFetch(src).then(data => { if (alive) setUrl(data.url); }).catch(() => { if (alive) setError('Audio unavailable. Reload to retry.'); });
    return () => { alive = false; };
  }, [src]);
  return error ? <span role="alert">{error}</span> : <audio controls preload="none" src={url || undefined} />;
}
