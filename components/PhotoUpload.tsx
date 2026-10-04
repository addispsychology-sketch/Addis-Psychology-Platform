'use client';
import { useState } from 'react';
import { usePlatform } from './Platform';
import { authenticatedFetch } from '@/lib/supabase';

export default function PhotoUpload({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { t } = usePlatform();
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  return <div className="photo-upload"><label>{t('Profile photo (optional)', 'የመገለጫ ፎቶ (አማራጭ)')}
    <input type="file" disabled={uploading} accept="image/png,image/jpeg,image/webp" onChange={async e => {
      setError('');
      const file = e.target.files?.[0];
      if (!file) return;
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 1048576) {
        setError(t('Choose a JPG, PNG, or WebP image smaller than 1 MB.', 'ከ1 ሜባ ያነሰ JPG፣ PNG ወይም WebP ፎቶ ይምረጡ።'));
        e.target.value = ''; return;
      }
      setUploading(true);
      try {
        const body = new FormData(); body.set('photo', file);
        const { url } = await authenticatedFetch('/api/profile-photo', { method: 'POST', body });
        onChange(url);
      } catch (error) { setError(error instanceof Error ? error.message : 'Photo upload failed.'); }
      finally { setUploading(false); }
    }} />
  </label><small>{uploading ? t('Uploading…', 'በመጫን ላይ…') : t('JPG, PNG or WebP · maximum 1 MB · public profile photo', 'JPG፣ PNG ወይም WebP · እስከ 1 ሜባ · ይፋዊ የመገለጫ ፎቶ')}</small>
    {value && <button type="button" disabled={uploading} onClick={() => onChange('')}>{t('Remove photo', 'ፎቶ አስወግድ')}</button>}
    {error && <p role="alert">{error}</p>}
  </div>;
}
