import {createClient} from '@supabase/supabase-js';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const state=JSON.parse(readFileSync('.env.qa-session.json','utf8'));
const clients=[];
const check=r=>{if(r.error)throw new Error(r.error.message);return r.data;};
for(const user of state.users){const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});check(await db.auth.signInWithPassword({email:user.email,password:'QA-only-Addis-2026!b7kz9'}));clients.push(db);}
const [c,t,o]=clients,channels=[];
const watching=async(db,user)=>{
 await db.realtime.setAuth();
 const events=[];
 const channel=db.channel('messages:'+user.id,{config:{private:true}}).on('postgres_changes',{event:'UPDATE',schema:'public',table:'messages'},payload=>events.push(payload.new));channels.push([db,channel]);
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Subscribe timed out')),10000);channel.subscribe(status=>{if(status==='SUBSCRIBED'){clearTimeout(timer);resolve();}if(status==='CHANNEL_ERROR'){clearTimeout(timer);reject(new Error('Subscription denied'));}});});
 return events;
};
try{
 const ce=await watching(c,state.users[0]),te=await watching(t,state.users[1]);
 const original=check(await c.from('messages').select('id,created_at').eq('conversation_id',state.conversation).eq('sender_id',state.users[0].id).not('text','is',null).limit(1).single());
 const before=check(await c.from('credit_lots').select('texts').eq('user_id',state.users[0].id).single()).texts;
 const edited=check(await c.from('messages').update({text:'Temporary QA: verified client edit'}).eq('id',original.id).select().single());
 assert.ok(edited.edited_at);assert.equal(edited.created_at,original.created_at);
 assert.equal(check(await c.from('credit_lots').select('texts').eq('user_id',state.users[0].id).single()).texts,before);
 const own=check(await t.from('messages').insert({conversation_id:state.conversation,sender_id:state.users[1].id,text:'Temporary QA: therapist original'}).select().single());
 check(await t.from('messages').update({text:'Temporary QA: verified therapist edit'}).eq('id',own.id).select().single());
 assert.equal(check(await t.from('messages').update({text:'Unauthorized edit'}).eq('id',original.id).select()).length,0);
 assert.equal(check(await o.from('messages').update({text:'Outsider edit'}).eq('id',original.id).select()).length,0);
 const forged=await c.from('messages').update({sender_id:state.users[1].id}).eq('id',original.id);assert.ok(forged.error);
 const deadline=Date.now()+10000;
 while(Date.now()<deadline&&(!te.some(m=>m.id===original.id)||!ce.some(m=>m.id===own.id)))await new Promise(r=>setTimeout(r,100));
 assert.ok(te.some(m=>m.id===original.id),'Therapist did not receive client edit live');
 assert.ok(ce.some(m=>m.id===own.id),'Client did not receive therapist edit live');
 console.log('PASS: both roles edit their own messages; reciprocal Realtime UPDATE; identity, ownership, original timestamp and credits protected.');
}finally{await Promise.all(channels.map(([db,ch])=>db.removeChannel(ch)));await Promise.all(clients.map(db=>db.auth.signOut()));}
process.exit(0);
