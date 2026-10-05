'use client';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { usePlatform } from './Platform';
import { authenticatedFetch } from '@/lib/supabase';

export default function PhotoUpload({
  value,
  onChange,
  onLocalPreview,
}: {
  value: string;
  onChange: (value: string) => void;
  /** Optional: called with a local blob URL for instant sidebar preview while uploading, then '' when done */
  onLocalPreview?: (blobUrl: string) => void;
}) {
  const { t } = usePlatform();
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  // Local object URL for instant preview before the upload resolves
  const [localPreview, setLocalPreview] = useState('');
  const localPreviewRef = useRef('');

  // Clean up the object URL when the component unmounts
  useEffect(() => {
    return () => {
      if (localPreviewRef.current) URL.revokeObjectURL(localPreviewRef.current);
    };
  }, []);

  // The photo to show in the inline preview: CDN URL (after upload) takes priority, then local blob
  const previewSrc = value || localPreview;

  function clearLocalPreview() {
    if (localPreviewRef.current) {
      URL.revokeObjectURL(localPreviewRef.current);
      localPreviewRef.current = '';
    }
    setLocalPreview('');
    onLocalPreview?.('');
  }

  return (
    <div className="photo-upload">
      {/* Instant photo preview — shown inside the upload widget */}
      {previewSrc && (
        <div className="photo-upload-preview">
          <Image
            src={previewSrc}
            alt={t('Profile photo preview', 'የፎቶ ቅድመ-እይታ')}
            width={120}
            height={144}
            unoptimized
            style={{ objectFit: 'cover', border: '2px solid var(--ink)', display: 'block' }}
          />
          {uploading && (
            <p style={{ fontSize: '11px', margin: '4px 0 0', color: 'var(--muted-text)' }}>
              {t('Uploading…', 'በመጫን ላይ…')}
            </p>
          )}
        </div>
      )}

      <label>
        {t('Profile photo (optional)', 'የመገለጫ ፎቶ (አማራጭ)')}
        <input
          type="file"
          disabled={uploading}
          accept="image/png,image/jpeg,image/webp"
          onChange={async e => {
            setError('');
            const file = e.target.files?.[0];
            if (!file) return;
            if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 1048576) {
              setError(t('Choose a JPG, PNG, or WebP image smaller than 1 MB.', 'ከ1 ሜባ ያነሰ JPG፣ PNG ወይም WebP ፎቶ ይምረጡ።'));
              e.target.value = '';
              return;
            }

            // Show a local blob preview immediately so the user sees their photo right away
            if (localPreviewRef.current) URL.revokeObjectURL(localPreviewRef.current);
            const objectUrl = URL.createObjectURL(file);
            localPreviewRef.current = objectUrl;
            setLocalPreview(objectUrl);
            onLocalPreview?.(objectUrl); // Notify parent for sidebar preview

            setUploading(true);
            try {
              const body = new FormData();
              body.set('photo', file);
              const { url } = await authenticatedFetch('/api/profile-photo', { method: 'POST', body });
              // Replace local blob with the permanent CDN URL
              onChange(url);
              clearLocalPreview();
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Photo upload failed.');
            } finally {
              setUploading(false);
            }
          }}
        />
      </label>
      <small>
        {uploading
          ? t('Uploading…', 'በመጫን ላይ…')
          : t('JPG, PNG or WebP · maximum 1 MB · public profile photo', 'JPG፣ PNG ወይም WebP · እስከ 1 ሜባ · ይፋዊ የመገለጫ ፎቶ')}
      </small>
      {value && (
        <button
          type="button"
          disabled={uploading}
          onClick={() => {
            onChange('');
            clearLocalPreview();
          }}
        >
          {t('Remove photo', 'ፎቶ አስወግድ')}
        </button>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
