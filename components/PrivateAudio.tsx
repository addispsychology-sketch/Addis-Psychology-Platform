'use client';
import { useEffect, useRef, useState } from 'react';
import { Play, RotateCcw, Mic } from 'lucide-react';
import { authenticatedFetch } from '@/lib/supabase';

const signed = new Map<string,{url:string,expires:number}>();
function VoicePlayer({src}:{src:string}) {
  const audio=useRef<HTMLAudioElement>(null);
  const local=src.startsWith('blob:');
  const cached=signed.get(src);
  const [url,setUrl]=useState(()=>local?src:cached && cached.expires>Date.now()?cached.url:'');
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const busy=useRef(false);
  const playRequested=useRef(false);
  useEffect(()=>{
    if(url && playRequested.current) {playRequested.current=false;void audio.current?.play().catch(()=>{});}
  },[url]);
  async function prepare() {
    if(busy.current) return;
    busy.current=true;setLoading(true);setError('');
    try {
      if(!src.startsWith('/api/voice?')) throw new Error('This voice note has an invalid reference.');
      const data=await authenticatedFetch(src);
      if(!data.url) throw new Error('Playback is unavailable. Please try again.');
      signed.set(src,{url:data.url,expires:Date.now()+50*60*1000});
      playRequested.current=true;setUrl(data.url);
    } catch(err) {setError(err instanceof Error?err.message:'Playback is unavailable. Please try again.');}
    finally {busy.current=false;setLoading(false);}
  }
  return <div className="private-voice-player">
    <span className="voice-note-label"><Mic size={14}/> Voice note</span>
    <audio ref={audio} controls={Boolean(url) && !error} preload="metadata" src={url||undefined} aria-label="Play private voice note" onError={()=>{signed.delete(src);setError('Could not play this voice note. Tap retry to reconnect.');}} />
    {(!url || error) && <button type="button" className="voice-play-button" disabled={loading} onClick={()=>void prepare()}>
      {error?<RotateCcw size={17}/>:<Play size={17}/>}{loading?'Preparing audio…':error?'Retry playback':'Play voice note'}
    </button>}
    {error && <small role="alert">{error}</small>}
  </div>;
}
export default function PrivateAudio({src}:{src:string}) {return <VoicePlayer key={src} src={src}/>;}
