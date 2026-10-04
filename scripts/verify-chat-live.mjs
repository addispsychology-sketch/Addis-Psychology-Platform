import {createClient} from '@supabase/supabase-js';
import {randomUUID} from 'node:crypto';
import {writeFileSync,readFileSync,existsSync,unlinkSync} from 'node:fs';
import assert from 'node:assert/strict';
const stateFile='.env.qa-session.json';
const admin=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const site=process.env.QA_SITE||'http://localhost:3000';
const password='QA-only-Addis-2026!b7kz9';
const client=()=>createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const check=result=>{if(result.error)throw new Error(result.error.message);return result.data;};
function silence() {
 const crc=bytes=>{let c=0;for(const b of bytes){c=(c^(b<<24))>>>0;for(let i=0;i<8;i++)c=(c&0x80000000?((c<<1)^0x04c11db7):(c<<1))>>>0;}return c;};
 const page=(packets,seq,flags,granule)=>{
  const payload=Buffer.concat(packets),header=Buffer.alloc(27+packets.length);
  header.write('OggS');header[5]=flags;header.writeBigUInt64LE(BigInt(granule),6);header.writeUInt32LE(12345,14);header.writeUInt32LE(seq,18);header[26]=packets.length;
  packets.forEach((p,i)=>header[27+i]=p.length);
  const data=Buffer.concat([header,payload]);data.writeUInt32LE(crc(data),22);return data;
 };
 const head=Buffer.alloc(19);head.write('OpusHead');head[8]=1;head[9]=1;head.writeUInt32LE(48000,12);
 const tags=Buffer.alloc(24);tags.write('OpusTags');tags.writeUInt32LE(8,8);tags.write('Addis QA',12);
 return Buffer.concat([page([head],0,2,0),page([tags],1,0,0),page(Array.from({length:50},()=>Buffer.from([0xf8,0xff,0xfe])),2,4,48000)]);
}
async function session(email){const db=client();check(await db.auth.signInWithPassword({email,password}));return db;}
async function api(db,path,options={}) {
 const token=(await db.auth.getSession()).data.session.access_token;
 return fetch(site+path,{...options,headers:{'Content-Type':'application/json',Authorization:'Bearer '+token,...options.headers}});
}
async function cleanup() {
 if(!existsSync(stateFile))return;
 const state=JSON.parse(readFileSync(stateFile,'utf8'));
 const audioKeys=[...new Set([state.audioKey,...(state.audioKeys||[])].filter(Boolean))];
 if(audioKeys.length)check(await admin.storage.from('voice-notes').remove(audioKeys));
 if(state.conversation)check(await admin.from('conversations').delete().eq('id',state.conversation));
 if(state.practitioner){
  const practice=check(await admin.from('practitioners').select('profile').eq('id',state.practitioner).single());
  if(practice.profile.name!=='Temporary QA practitioner')throw new Error('Cleanup identity check failed.');
  const remaining=check(await admin.from('conversations').select('id').eq('therapist_id',state.practitioner));
  for(const c of remaining){
   const result=await admin.from('messages').select('id',{count:'exact',head:true}).eq('conversation_id',c.id);
   if(result.error || result.count!==0)throw new Error('Preserve conversation: unexpected messages found.');
   check(await admin.from('conversations').delete().eq('id',c.id));
  }
 }
 if(state.practitioner)check(await admin.from('practitioners').delete().eq('id',state.practitioner));
 for(const u of state.users||[]){
  for(const table of ['credit_lots','payment_requests','wallet_ledger','wallets','terms_acceptances','account_status']) check(await admin.from(table).delete().eq('user_id',u.id));
  check(await admin.auth.admin.deleteUser(u.id));
 }
 unlinkSync(stateFile);
 console.log('Temporary users, conversation, credits and audio removed.');
}
if(process.argv.includes('--cleanup')){await cleanup();process.exit(0);}
let state;
if(process.argv.includes('--setup')) {
 if(existsSync(stateFile))throw new Error('Clean up the previous QA run first.');
 state={users:[]};writeFileSync(stateFile,JSON.stringify(state));
 const tag=randomUUID().slice(0,8);
 for(const role of ['client','therapist','outsider']){
  const email=`qa.${role}.${tag}@example.invalid`;
  const {user}=check(await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{full_name:`Temporary QA ${role}`}}));
  state.users.push({id:user.id,email,role});writeFileSync(stateFile,JSON.stringify(state));
  check(await admin.from('account_preferences').upsert({user_id:user.id,email_notifications:false,telegram_notifications:false}));
 }
 const t=state.users[1];
 const practice=check(await admin.from('practitioners').insert({user_id:t.id,approved:true,profile:{name:'Temporary QA practitioner',title:'Verification only',bio:'Disposable test profile',specialties:[],languages:['Amharic','English'],education:[],approaches:[],yearsExperience:0,priceOnline:1000,priceInPerson:1200,rating:0,reviewCount:0,availability:'',imageColor:'',gender:'Unspecified'},settings:{online:1000,inperson:1200,discount:0,presence:'available',days:[1,2,3,4,5],start:'09:00',end:'17:00',chatDays:[1],chatStart:'09:00',chatEnd:'17:00'}}).select('id').single());
 state.practitioner=practice.id;writeFileSync(stateFile,JSON.stringify(state));
 const c=state.users[0];
 check(await admin.from('terms_acceptances').insert([{user_id:c.id,audience:'client',version:'2026-10-03.2'},{user_id:t.id,audience:'therapist',version:'2026-10-03.2'}]));
 if(!process.argv.includes('--activity-only')){
  const payment=check(await admin.from('payment_requests').insert({user_id:c.id,kind:'combined',principal_cents:57000,fee_cents:2850,method:'telebirr',reference:'QA-'+tag,status:'approved'}).select('id').single());
  check(await admin.from('credit_lots').insert({user_id:c.id,payment_id:payment.id,principal_cents:57000,texts:10,voice_seconds:30,initial_texts:10,initial_voice_seconds:30}));
 }
 const db=await session(c.email);
 const conversation=check(await db.from('conversations').insert({client_id:c.id,therapist_id:practice.id}).select('id').single());
 state.conversation=conversation.id;writeFileSync(stateFile,JSON.stringify(state));
 console.log('QA accounts created:',JSON.stringify({client:c.email,therapist:t.email,practitioner:practice.id,conversation:conversation.id}));
}
if(process.argv.includes('--activity-only'))process.exit(0);
state??=JSON.parse(readFileSync(stateFile,'utf8'));
const c=await session(state.users[0].email),t=await session(state.users[1].email),other=await session(state.users[2].email);
try {
 const m=check(await c.from('messages').insert({conversation_id:state.conversation,sender_id:state.users[0].id,text:'Temporary QA: client text delivery'}).select().single());
 assert.ok(check(await t.from('messages').select('id').eq('id',m.id).single()));
 const unread=check(await t.rpc('unread_message_count'));assert.ok(unread>0);
 check(await t.rpc('mark_conversation_read',{conversation:state.conversation,last_message:m.id}));
 assert.equal(check(await t.rpc('unread_message_count')),0);
 check(await t.rpc('touch_activity'));
 const practice=check(await c.from('practitioners').select('settings,last_seen_at').eq('id',state.practitioner).single());assert.ok(Date.now()-Date.parse(practice.last_seen_at)<10000);
 check(await t.from('practitioners').update({settings:{...practice.settings,online:1350}}).eq('id',state.practitioner).select('id').single());
 console.log('PASS: first conversation, text delivery, unread reset, heartbeat and pricing save.');
 const audio=silence();
 const uploadResponse=await api(t,'/api/voice',{method:'POST',body:JSON.stringify({conversationId:state.conversation,contentType:'audio/ogg',size:audio.length})});
 assert.equal(uploadResponse.status,200);const upload=await uploadResponse.json();
 state.audioKeys=[...new Set([...(state.audioKeys||[]),state.audioKey,upload.key].filter(Boolean))];
 state.audioKey=upload.key;writeFileSync(stateFile,JSON.stringify(state));
 check(await t.storage.from(upload.bucket).uploadToSignedUrl(upload.key,upload.token,audio,{contentType:'audio/ogg'}));
 check(await t.from('messages').insert({conversation_id:state.conversation,sender_id:state.users[1].id,audio_url:upload.audioUrl,duration_seconds:1}).select().single());
 state.audioUrl=upload.audioUrl;writeFileSync(stateFile,JSON.stringify(state));
 const playback=await api(c,upload.audioUrl);assert.equal(playback.status,200);const link=await playback.json();
 const content=await fetch(link.url);assert.equal(content.status,200);assert.deepEqual(Buffer.from(await content.arrayBuffer()),audio);
 assert.equal((await api(other,upload.audioUrl)).status,403);
 console.log('PASS: therapist voice upload, client playback URL and audio bytes; outsider denied.');
 const channels=[];
 const join=async(db)=>{const channel=db.channel('typing:'+state.conversation,{config:{private:true}});channels.push([db,channel]);await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Private broadcast subscription timed out')),12000);channel.subscribe(status=>{if(status==='SUBSCRIBED'){clearTimeout(timer);resolve();}if(status==='CHANNEL_ERROR'){clearTimeout(timer);reject(new Error('Private channel authorization failed'));}});});return channel;};
 try {
  const cc=c.channel('typing:'+state.conversation,{config:{private:true}});channels.push([c,cc]);
  const activity=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Recording broadcast missing')),12000);cc.on('broadcast',{event:'activity'},({payload})=>{if(payload.state==='recording'){clearTimeout(timer);resolve();}}).subscribe();});
  const tc=await join(t);
  await new Promise(r=>setTimeout(r,1000));
  assert.equal(await tc.send({type:'broadcast',event:'activity',payload:{user:state.users[1].id,state:'recording'}}),'ok');await activity;
  console.log('PASS: private therapist recording broadcast reaches client.');
 }finally{await Promise.all(channels.map(([db,ch])=>db.removeChannel(ch)));}
 writeFileSync('public/voice-verification.ogg',audio);
 console.log('QA fixtures kept for browser playback verification; run --cleanup afterwards.');
}finally{await Promise.all([c,t,other].map(db=>db.auth.signOut()));}
process.exit(0);
