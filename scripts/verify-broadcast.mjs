import {createClient} from '@supabase/supabase-js';
import {readFileSync,writeFileSync,existsSync,unlinkSync} from 'node:fs';
import assert from 'node:assert/strict';
const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const options={auth:{persistSession:false,autoRefreshToken:false}};
const service=()=>createClient(url,process.env.SUPABASE_SECRET_KEY,options);
const check=result=>{if(result.error)throw new Error('Verification database operation failed');return result.data;};
const sessionPath='.env.qa-admin-session.json';
if(process.argv.includes('--prepare')){
 const ids=(process.env.TELEGRAM_ADMIN_IDS||'').split(',').map(v=>v.trim()).filter(Boolean);
 const accounts=check(await service().from('telegram_accounts').select('user_id,telegram_id').in('telegram_id',ids).limit(1));
 assert.ok(accounts.length,'No linked administrator');
 const user=check(await service().auth.admin.getUserById(accounts[0].user_id)).user;
 const link=check(await service().auth.admin.generateLink({type:'magiclink',email:user.email}));
 const client=createClient(url,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,options);
 const signed=check(await client.auth.verifyOtp({token_hash:link.properties.hashed_token,type:'magiclink'}));
 assert.equal(signed.user.id,accounts[0].user_id);
 writeFileSync(sessionPath,JSON.stringify({access_token:signed.session.access_token,refresh_token:signed.session.refresh_token}));
 console.log('Prepared temporary administrator verification session (credentials remain local).');
}else if(process.argv.includes('--discard')){
 const id=process.argv[process.argv.indexOf('--discard')+1];
 assert.match(id,/^[0-9a-f-]{36}$/i);
 const session=JSON.parse(readFileSync(sessionPath,'utf8'));
 const response=await fetch((process.env.VERIFY_BASE_URL||'http://localhost:3001')+'/api/admin/broadcast',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},body:JSON.stringify({action:'discard',id})});
 assert.equal(response.status,200);console.log('Removed the specified temporary preview draft.');
}else if(process.argv.includes('--cleanup')){
 if(existsSync(sessionPath)){
  const client=createClient(url,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,options);
  check(await client.auth.setSession(JSON.parse(readFileSync(sessionPath,'utf8'))));
  check(await client.auth.signOut({scope:'local'}));unlinkSync(sessionPath);
 }
 console.log('Temporary verification session removed.');
}else{
 const session=JSON.parse(readFileSync(sessionPath,'utf8'));
 const base=process.env.VERIFY_BASE_URL||'http://localhost:3001';
 const route=base+'/api/admin/broadcast';
 const invoke=async(body,authenticated=true)=>{
  const response=await fetch(route,{method:'POST',headers:{'Content-Type':'application/json',...(authenticated?{Authorization:'Bearer '+session.access_token}:{})},body:JSON.stringify(body)});
  return {response,data:await response.json()};
 };
 const drafts=[];
 try {
  assert.equal((await invoke({action:'upload',contentType:'image/png',size:1},false)).response.status,401);
  assert.equal((await invoke({action:'upload',contentType:'video/mp4',size:20*1024*1024+1})).response.status,400);
  const connection=await fetch(route,{headers:{Authorization:'Bearer '+session.access_token}});
  assert.equal(connection.status,200);const setup=await connection.json();assert.equal(setup.canPost,true);assert.equal(setup.canLaunch,true,'Direct Mini App launch is not enabled');
  for(const [contentType,bytes] of [['image/png',readFileSync('public/img-seated.png')],['video/mp4',Buffer.from('0000ftypisom0000verification-header-only')]]){
   const {response,data:upload}=await invoke({action:'upload',contentType,size:bytes.length});
   assert.equal(response.status,200);drafts.push(upload.id);
   const anon=createClient(url,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,options);
   check(await anon.storage.from(upload.bucket).uploadToSignedUrl(upload.path,upload.token,bytes,{contentType}));
   assert.ok((await anon.storage.from(upload.bucket).download(upload.path)).error,'Private upload must not be publicly readable');
   const saved=await invoke({action:'preview',id:upload.id,title:'Temporary private verification',body:'Private media preview. This will not be published.'});
   assert.equal(saved.response.status,200,JSON.stringify(saved.data));
   const length=await invoke({action:'preview',id:upload.id,title:'Temporary private verification',body:'a'.repeat(1100)});
   assert.equal(length.response.status,400);
   const row=check(await service().from('channel_posts').select('status,media_type,media_size').eq('id',upload.id).single());
   assert.equal(row.status,'draft');assert.equal(row.media_type,contentType==='video/mp4'?'video':'photo');assert.equal(Number(row.media_size),bytes.length);
   assert.equal((await invoke({action:'detach',id:upload.id})).response.status,200);
   assert.equal((await invoke({action:'preview',id:upload.id,title:'Private text preview',body:'a'.repeat(1100)})).response.status,200);
  }
  const forged=await invoke({action:'upload',contentType:'image/png',size:23});
  drafts.push(forged.data.id);
  const anon=createClient(url,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,options);
  check(await anon.storage.from(forged.data.bucket).uploadToSignedUrl(forged.data.path,forged.data.token,Buffer.from('<html>not a photo</html>'),{contentType:'image/png'}));
  assert.equal((await invoke({action:'preview',id:forged.data.id,title:'Invalid media',body:'Must reject this upload.'})).response.status,400);
  console.log('PASS: authorized direct photo/video uploads, private storage, saved captions, caption limits, attachment removal, forged-file rejection and anonymous denial. No Telegram messages sent.');
 }finally{
  for(const id of drafts)await invoke({action:'discard',id});
 }
}
