'use client';
import { useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { authenticatedFetch, getSupabase } from '@/lib/supabase';
import type { Conversation } from '@/lib/useMessaging';

type Signal = { callId: string; sender: string; description?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit };
type Active = { id: string; conversation: string; incoming?: RTCSessionDescriptionInit; peer?: RTCPeerConnection; stream?: MediaStream; candidates: RTCIceCandidateInit[]; timer?: ReturnType<typeof setTimeout> };
export function requestCall(conversation: string) { window.dispatchEvent(new CustomEvent('addis-call', { detail: conversation })); }

export default function AudioCalls({ userId, conversations }: { userId: string | null; conversations: Conversation[] }) {
  const [label, setLabel] = useState('');
  const [incoming, setIncoming] = useState(false);
  const [muted, setMuted] = useState(false);
  const active = useRef<Active | null>(null);
  const channels = useRef(new Map<string, RealtimeChannel>());
  const ready = useRef(new Set<string>());
  const audio = useRef<HTMLAudioElement>(null);
  const accept = useRef<() => Promise<void>>(async () => {});
  const end = useRef<() => void>(() => {});
  const ids = conversations.map(c => c.id).sort().join(',');
  const conversationIds = useRef(ids);
  useEffect(() => {
    conversationIds.current = ids;
    window.dispatchEvent(new Event('addis-call-conversations'));
  }, [ids]);
  useEffect(() => {
    const db = getSupabase();
    if (!db || !userId) return;
    let alive = true;
    async function signal(event: string, call: Active, extra: Partial<Signal> = {}) {
      const channel = channels.current.get(call.conversation);
      if (!channel || !ready.current.has(call.conversation)) throw new Error('Call connection is not ready. Try again.');
      const result = await channel.send({ type: 'broadcast', event, payload: { callId: call.id, sender: userId, ...extra } });
      if (result !== 'ok') throw new Error('Call signaling failed.');
    }
    function cleanup() {
      const call = active.current;
      active.current = null;
      if (call) { clearTimeout(call.timer); call.peer?.close(); call.stream?.getTracks().forEach(t => t.stop()); }
      if (audio.current) audio.current.srcObject = null;
      if (alive) { setIncoming(false); setMuted(false); setLabel(''); }
    }
    function hangup() { const call = active.current; if (call) void signal('hangup', call).catch(() => {}); cleanup(); }
    function fail(error: unknown) { hangup(); if (alive) setLabel(error instanceof Error ? error.message : 'Call failed.'); }
    function timeout(call: Active) { call.timer = setTimeout(() => { if (active.current === call) { hangup(); setLabel('Call was not answered or could not connect.'); } }, 45000); }
    async function peer(call: Active) {
      const { iceServers } = await authenticatedFetch('/api/calls/ice');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!alive || active.current !== call) { stream.getTracks().forEach(t => t.stop()); throw new Error('Call ended.'); }
      call.stream = stream;
      const pc = new RTCPeerConnection({ iceServers });
      call.peer = pc;
      stream.getTracks().forEach(t => pc.addTrack(t, stream));
      pc.onicecandidate = event => { if (event.candidate && active.current === call) void signal('ice-candidate', call, { candidate: event.candidate.toJSON() }).catch(fail); };
      pc.ontrack = event => { if (audio.current) { audio.current.srcObject = event.streams[0]; void audio.current.play().catch(() => setLabel('Connected — press Play to hear audio.')); } };
      pc.onconnectionstatechange = () => {
        if (active.current !== call) return;
        if (pc.connectionState === 'connected') { clearTimeout(call.timer); setLabel('Audio call connected'); }
        if (pc.connectionState === 'failed') fail(new Error('Connection failed. Check TURN configuration.'));
        if (pc.connectionState === 'disconnected') { clearTimeout(call.timer); call.timer = setTimeout(() => { if (pc.connectionState === 'disconnected') fail(new Error('Call disconnected.')); }, 10000); }
      };
      return pc;
    }
    async function flush(call: Active) { for (const candidate of call.candidates.splice(0)) await call.peer!.addIceCandidate(candidate); }
    accept.current = async () => {
      const call = active.current;
      if (!call?.incoming || call.peer) return;
      setIncoming(false); setLabel('Connecting…');
      try {
        const pc = await peer(call);
        await pc.setRemoteDescription(call.incoming);
        await flush(call);
        await pc.setLocalDescription(await pc.createAnswer());
        await signal('answer', call, { description: pc.localDescription!.toJSON() });
      } catch (error) { if (active.current === call) fail(error); }
    };
    end.current = hangup;
    async function receive(conversation: string, event: string, payload: Signal) {
      if (!payload || payload.sender === userId || typeof payload.callId !== 'string') return;
      try {
        if (event === 'offer') {
          if (payload.description?.type !== 'offer' || typeof payload.description.sdp !== 'string') return;
          if (active.current) { if (active.current.id !== payload.callId) await signal('hangup', { id: payload.callId, conversation, candidates: [] }); return; }
          const call: Active = { id: payload.callId, conversation, incoming: payload.description, candidates: [] };
          active.current = call; timeout(call); setIncoming(true); setLabel('Incoming audio call'); return;
        }
        const call = active.current;
        if (!call || call.id !== payload.callId || call.conversation !== conversation) return;
        if (event === 'hangup') cleanup();
        if (event === 'answer' && call.peer?.signalingState === 'have-local-offer' && payload.description?.type === 'answer') { await call.peer.setRemoteDescription(payload.description); await flush(call); }
        if (event === 'ice-candidate' && payload.candidate) { if (call.peer?.remoteDescription) await call.peer.addIceCandidate(payload.candidate); else if (call.candidates.length < 100) call.candidates.push(payload.candidate); }
      } catch (error) { fail(error); }
    }
    function synchronizeChannels() {
      if (!alive) return;
      for (const id of conversationIds.current.split(',').filter(Boolean)) {
        if (channels.current.has(id)) continue;
        const channel = db!.channel(`call:${id}`, { config: { private: true, broadcast: { ack: true } } });
        for (const event of ['offer', 'answer', 'ice-candidate', 'hangup']) channel.on('broadcast', { event }, ({ payload }) => void receive(id, event, payload));
        channels.current.set(id, channel);
        channel.subscribe(status => { if (status === 'SUBSCRIBED') ready.current.add(id); else { ready.current.delete(id); if (active.current?.conversation === id) fail(new Error('Call signaling disconnected.')); } });
      }
    }
    void db.realtime.setAuth().then(synchronizeChannels).catch(fail);
    window.addEventListener('addis-call-conversations', synchronizeChannels);
    async function start(event: Event) {
      if (active.current) return;
      const conversation = (event as CustomEvent<string>).detail;
      if (!ready.current.has(conversation)) { setLabel('Call connection is loading. Please try again shortly.'); return; }
      const call: Active = { id: crypto.randomUUID(), conversation, candidates: [] };
      active.current = call; setLabel('Calling…'); timeout(call);
      try {
        const pc = await peer(call);
        // Send the offer before candidates, so the receiver has a call to queue them against.
        const pending: RTCIceCandidateInit[] = [];
        pc.onicecandidate = e => { if (e.candidate) pending.push(e.candidate.toJSON()); };
        await pc.setLocalDescription(await pc.createOffer());
        await signal('offer', call, { description: pc.localDescription!.toJSON() });
        pc.onicecandidate = e => { if (e.candidate) void signal('ice-candidate', call, { candidate: e.candidate.toJSON() }).catch(fail); };
        for (const candidate of pending) await signal('ice-candidate', call, { candidate });
      } catch (error) { if (active.current === call) fail(error); }
    }
    window.addEventListener('addis-call', start);
    window.addEventListener('pagehide', hangup);
    const channelMap = channels.current;
    const readySet = ready.current;
    return () => { hangup(); alive = false; window.removeEventListener('addis-call-conversations', synchronizeChannels); window.removeEventListener('addis-call', start); window.removeEventListener('pagehide', hangup); channelMap.forEach(c => void db.removeChannel(c)); channelMap.clear(); readySet.clear(); };
  }, [userId]);
  return <>
    <audio ref={audio} autoPlay />
    {label && <section role="dialog" aria-label="Audio call" className="system-note" style={{ position: 'fixed', right: 16, bottom: 16, zIndex: 1000, maxWidth: 360, padding: 20, background: 'var(--paper)', border: '3px solid var(--ink)' }}>
      <p role="status">{label}</p>
      {incoming && <button className="solid" onClick={() => void accept.current()}>Accept</button>}
      {!incoming && <button onClick={() => { const tracks = active.current?.stream?.getAudioTracks(); tracks?.forEach(t => { t.enabled = muted; }); setMuted(!muted); }}> {muted ? 'Unmute' : 'Mute'} </button>}
      <button onClick={() => void audio.current?.play()}>Play audio</button>
      <button onClick={() => { end.current(); setLabel(''); }}>{incoming ? 'Decline' : 'End / Close'}</button>
    </section>}
  </>;
}
