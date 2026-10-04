'use client';
import { useEffect, useRef, useState } from 'react';
import { usePlatform } from './Platform';
import { MessageCircle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';

export default function MessageToast() {
  const {messages,messagesReady,ownTherapistId,t,userId,people,viewedConversation}=usePlatform();
  const [toast,setToast]=useState<{id:string;name:string;voice:boolean;url:string}|null>(null);
  const seen=useRef(new Set<string>());
  const initialized=useRef(false);
  const account=useRef<string|null>(null);
  const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
  useEffect(()=>{
    if(account.current!==userId){account.current=userId;seen.current.clear();initialized.current=false;setTimeout(()=>setToast(null),0);}
    if(!userId || !messagesReady) return;
    if(!initialized.current){messages.forEach(m=>seen.current.add(m.id));initialized.current=true;return;}
    for(const m of messages){
      if(seen.current.has(m.id)) continue;
      seen.current.add(m.id);
      const incoming=ownTherapistId?m.from==='client':m.from==='therapist';
      if(!incoming || (document.visibilityState==='visible' && m.conversationId===viewedConversation)) continue;
      if(timer.current) clearTimeout(timer.current);
      setTimeout(()=>setToast({id:m.id,name:ownTherapistId?t('A client','ደንበኛ'):people.find(p=>p.id===m.therapist)?.name||t('Your therapist','ባለሙያዎ'),voice:Boolean(m.audio),url:ownTherapistId?`/portal?conversation=${m.conversationId}`:`/chat?therapist=${m.therapist}`}),0);
      timer.current=setTimeout(()=>setToast(null),8000);
    }
  },[messages,messagesReady,ownTherapistId,userId,viewedConversation,people,t]);
  useEffect(()=>()=>{if(timer.current) clearTimeout(timer.current);},[]);
  return <AnimatePresence>{userId && toast && <motion.aside key={toast.id} className="incoming-message-toast" role="status" aria-live="polite" initial={{opacity:0,y:-12}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-12}}>
    <span className="message-toast-icon"><MessageCircle size={21}/></span>
    <div><strong>{t('New private message','አዲስ የግል መልዕክት')}</strong><p>{toast.name} {toast.voice?t('sent a voice note.','የድምፅ መልዕክት ልከዋል።'):t('sent you a message.','መልዕክት ልከዋል።')}</p><Link href={toast.url} onClick={()=>setToast(null)}>{t('Open conversation →','ውይይት ክፈት →')}</Link></div>
    <button type="button" aria-label="Dismiss notification" onClick={()=>setToast(null)}><X size={17}/></button>
  </motion.aside>}</AnimatePresence>;
}
