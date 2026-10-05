'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabase } from './supabase';
import { usePageVisible } from './usePageVisible';

type Activity = 'typing' | 'recording' | 'idle';
// Supabase reuses a channel with the same topic until its asynchronous leave completes.
const closingChannels=new Map<string,Promise<unknown>>();
export function useConversationActivity(conversationId: string | undefined, userId: string | null, recording: boolean) {
  const visible = usePageVisible();
  const [received, setReceived] = useState<{conversation:string;state:Activity}>({conversation:'',state:'idle'});
  const channel = useRef<RealtimeChannel | null>(null);
  const subscribed = useRef(false);
  const lastSent = useRef(0);
  const local = useRef<Activity>('idle');
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sendActivity = useCallback((state: Activity) => {
    const changed=local.current!==state;
    local.current=state;
    if (!subscribed.current || !userId) return;
    if (!changed && Date.now() - lastSent.current < 2500) return;
    lastSent.current = Date.now();
    void channel.current?.send({type:'broadcast',event:'activity',payload:{user:userId,state}});
  }, [userId]);
  useEffect(() => {
    const db=getSupabase();
    subscribed.current=false;local.current='idle';lastSent.current=0;
    if(!db || !conversationId || !userId || !visible) return;
    let disposed=false;
    let timeout:ReturnType<typeof setTimeout>;
    const topicName=`typing:${conversationId}`;
    let topic:RealtimeChannel | null=null;
    const publish=()=>{
      if(!disposed && subscribed.current && document.visibilityState==='visible' && Date.now()-lastSent.current>=2500) {
        lastSent.current=Date.now();
        void topic?.send({type:'broadcast',event:'activity',payload:{user:userId,state:local.current}});
      }
    };
    const join=async()=>{
      await db.realtime.setAuth();
      await closingChannels.get(topicName);
      if(disposed) return;
      topic=db.channel(topicName,{config:{private:true,broadcast:{self:false}}});
      channel.current=topic;
      topic.on('broadcast',{event:'activity'},({payload})=>{
        if(disposed || payload?.user===userId || !['typing','recording','idle'].includes(payload?.state)) return;
        setReceived({conversation:conversationId,state:payload.state});
        clearTimeout(timeout);
        timeout=setTimeout(()=>setReceived({conversation:conversationId,state:'idle'}),7000);
      }).on('broadcast',{event:'activity-request'},({payload})=>{
        if(payload?.user!==userId) publish();
      });
      // Flush input that started while joining, and ask for the participant's current state.
      topic.subscribe(status=>{
        if(disposed) return;
        subscribed.current=status==='SUBSCRIBED';
        if(subscribed.current) {
          publish();
          void topic?.send({type:'broadcast',event:'activity-request',payload:{user:userId}});
        }
      });
    };
    void join().catch(()=>{});
    // Only active composition emits a pulse; no HTTP requests or database writes.
    const pulse=setInterval(()=>{if(local.current!=='idle') publish();},3000);
    return ()=>{
      disposed=true;
      if(subscribed.current) void topic?.send({type:'broadcast',event:'activity',payload:{user:userId,state:'idle'}});
      subscribed.current=false;channel.current=null;clearTimeout(timeout);clearInterval(pulse);
      if(idleTimer.current) clearTimeout(idleTimer.current);
      if(topic) {
        const closing=db.removeChannel(topic);
        closingChannels.set(topicName,closing);
        const forget=()=>{if(closingChannels.get(topicName)===closing) closingChannels.delete(topicName);};
        void closing.then(forget,forget);
      }
    };
  },[conversationId,userId,visible]);
  useEffect(()=>{
    if(idleTimer.current) clearTimeout(idleTimer.current);
    if(!recording) {sendActivity('idle');return;}
    sendActivity('recording');
    return ()=>{sendActivity('idle');};
  },[recording,conversationId,sendActivity]);
  const typing=useCallback((hasText=true)=>{
    sendActivity(hasText?'typing':'idle');
    if(idleTimer.current) clearTimeout(idleTimer.current);
    if(hasText) idleTimer.current=setTimeout(()=>sendActivity('idle'),2500);
  },[sendActivity]);
  return {remote:received.conversation===conversationId?received.state:'idle',typing,stop:()=>{if(idleTimer.current) clearTimeout(idleTimer.current);sendActivity('idle');}};
}
