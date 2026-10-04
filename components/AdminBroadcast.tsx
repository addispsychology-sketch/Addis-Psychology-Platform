'use client';

import { useState } from 'react';
import { Therapist } from '@/lib/data';

type AdminRequest = (init?: RequestInit, secret?: string, path?: string) => Promise<Response>;

export default function AdminBroadcast({ people, adminRequest }: { people: Therapist[]; adminRequest: AdminRequest }) {
  const [type, setType] = useState<'general' | 'therapist'>('general');
  const [therapistId, setTherapistId] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('');
  const [sending, setSending] = useState(false);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (sending) return;
    setSending(true);
    setStatus('');
    try {
      const res = await adminRequest({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, type, therapistId: type === 'therapist' ? Number(therapistId) : null }),
      }, undefined, '/api/admin/broadcast');
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to send broadcast');
      setStatus('Broadcast sent successfully!');
      setMessage('');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Error sending broadcast.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="admin-section" style={{ marginTop: '24px' }}>
      <div className="admin-section-header">
        <h2>📢 Telegram Channel Broadcast</h2>
      </div>
      <form onSubmit={handleSend} style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '600px' }}>
        <p style={{ color: 'var(--muted-text)', fontSize: '13px' }}>
          Post an announcement to the official Telegram channel with interactive buttons attached.
        </p>

        <label style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontWeight: 600 }}>
          Broadcast Type
          <select value={type} onChange={e => setType(e.target.value as 'general' | 'therapist')} style={{ padding: '8px', border: '1px solid var(--ink)', borderRadius: '4px' }}>
            <option value="general">General Announcement</option>
            <option value="therapist">Promote a Therapist</option>
          </select>
        </label>

        {type === 'therapist' && (
          <label style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontWeight: 600 }}>
            Select Therapist
            <select value={therapistId} onChange={e => setTherapistId(e.target.value)} required style={{ padding: '8px', border: '1px solid var(--ink)', borderRadius: '4px' }}>
              <option value="">-- Choose a therapist --</option>
              {people.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.title})</option>
              ))}
            </select>
          </label>
        )}

        <label style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontWeight: 600 }}>
          Message Text (HTML supported)
          <textarea 
            rows={5}
            required
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder={type === 'therapist' ? "Meet our newest practitioner..." : "We are excited to announce..."}
            style={{ padding: '8px', border: '1px solid var(--ink)', borderRadius: '4px', fontFamily: 'inherit' }}
          />
        </label>

        {status && <div className={status.includes('successfully') ? "notice" : "error"} style={{ padding: '12px', background: status.includes('successfully') ? 'var(--success-soft, #e6ffe6)' : 'var(--danger-soft, #ffe6e6)', border: `1px solid ${status.includes('successfully') ? 'green' : 'red'}` }}>{status}</div>}

        <button type="submit" disabled={sending} className="solid" style={{ alignSelf: 'flex-start' }}>
          {sending ? 'Sending...' : 'Send Broadcast Now ✈️'}
        </button>
      </form>
    </div>
  );
}
