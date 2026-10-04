'use client';
/* eslint-disable @next/next/no-img-element -- Attachment previews use local, temporary blob URLs. */
import {useEffect,useState} from 'react';
import {Send,Eye,CheckCircle,MessageCircle,ImagePlus,Film,X,LoaderCircle} from 'lucide-react';
import type {Therapist} from '@/lib/data';
import {postActions,postCaptionLength} from '@/lib/channel-post';
import {channelMediaSpec,channelMediaType,MEDIA_CAPTION_LIMIT} from '@/lib/channel-media';
import {getSupabase} from '@/lib/supabase';
type AdminRequest=(init?:RequestInit,secret?:string,path?:string)=>Promise<Response>;
type Attachment={name:string;type:'photo'|'video';url:string;size:number};

export default function AdminBroadcast({people,adminRequest}:{people:Therapist[];adminRequest:AdminRequest}) {
 const [kind,setKind]=useState('general'),[therapist,setTherapist]=useState('');
 const [title,setTitle]=useState('A space to be heard');
 const [body,setBody]=useState('Connect with a mental health professional at your own pace. Explore specialties and languages, start a private text or voice conversation, or request an online or in-person appointment.');
 const [draft,setDraft]=useState(''),[saved,setSaved]=useState(false),[status,setStatus]=useState('');
 const [busy,setBusy]=useState<'upload'|'remove'|'preview'|'publish'|'connection'|null>(null);
 const [media,setMedia]=useState<Attachment|null>(null);
 const [channel,setChannel]=useState<{title:string;canPost:boolean;canLaunch:boolean}|null>(null);
 const [connectionError,setConnectionError]=useState(false);
 const mediaUrl=media?.url;
 useEffect(()=>()=>{if(mediaUrl)URL.revokeObjectURL(mediaUrl);},[mediaUrl]);
 useEffect(()=>{
  let alive=true;
  void adminRequest({},undefined,'/api/admin/broadcast').then(r=>r.json()).then(data=>{
   if(alive){if(data.error){setStatus(data.error);setConnectionError(true);}else setChannel(data);}
  }).catch(()=>{if(alive){setConnectionError(true);setStatus('Could not check the channel connection. Reopen this section to try again.');}});
  return()=>{alive=false;};
 // Check once when the publishing studio opens.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[]);
 async function request(input:Record<string,unknown>) {
  const response=await adminRequest({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)},undefined,'/api/admin/broadcast');
  const data=await response.json();
  if(!response.ok)throw new Error(data.error||'Could not save this post.');
  return data;
 }
 async function checkConnection(){
  if(busy)return;setBusy('connection');
  try{
   const response=await adminRequest({},undefined,'/api/admin/broadcast');const data=await response.json();
   if(!response.ok)throw new Error(data.error || 'Could not check the connection.');
   setChannel(data);setConnectionError(false);setStatus(data.canLaunch?'Direct Mini App launch is ready.':'Enable the Main Mini App in BotFather, then check again.');
  }catch(error){setStatus(error instanceof Error?error.message:'Could not check the connection.');}
  finally{setBusy(null);}
 }
 const edit=()=>{setSaved(false);setStatus('');};
 function template(next:string){
  setKind(next);edit();
  setTitle(next==='therapist'?'Meet your psychologist':next==='care'?'Make room for a check-in':'A space to be heard');
  setBody(next==='care'?'Pause for a moment and notice how you are feeling. You can explore professional support in a private space, in your preferred language, at a pace that feels right for you.':next==='therapist'?'Get to know this practitioner’s approach, specialties and languages. Start a confidential text or voice conversation, or request a session using the buttons below.':'Connect with a mental health professional at your own pace. Explore specialties and languages, start a private text or voice conversation, or request an online or in-person appointment.');
 }
 async function attach(file:File) {
  if(busy)return;
  setBusy('upload');setStatus('');let uploadId='';
  try {
   const spec=channelMediaSpec(file.type,file.size);
   if(channelMediaType(new Uint8Array(await file.slice(0,512).arrayBuffer()))!==spec.contentType)throw new Error('Choose a valid JPG, PNG or MP4 file.');
   if(spec.type==='photo'){
    const image=await createImageBitmap(file);
    const invalid=image.width+image.height>10000 || Math.max(image.width/image.height,image.height/image.width)>20;
    image.close();
    if(invalid)throw new Error('Choose a photo with width + height below 10,000 pixels and an aspect ratio below 20:1.');
   }
   const db=getSupabase();if(!db)throw new Error('Uploads are awaiting setup.');
   const upload=await request({action:'upload',contentType:spec.contentType,size:spec.size});uploadId=upload.id;
   const {error}=await db.storage.from(upload.bucket).uploadToSignedUrl(upload.path,upload.token,file,{contentType:spec.contentType});
   if(error)throw new Error('The upload could not finish. Check your connection and choose the file again.');
   if(draft)await request({action:'discard',id:draft});
   setDraft(upload.id);setSaved(false);
   setMedia({name:file.name,type:spec.type,size:file.size,url:URL.createObjectURL(file)});
   setStatus('Attachment ready. Save the preview to review your caption and buttons.');
  }catch(error){
   if(uploadId)await request({action:'discard',id:uploadId}).catch(()=>{});
   setStatus(error instanceof Error?error.message:'The file could not be uploaded.');
  }finally{setBusy(null);}
 }
 async function removeMedia(){
  if(busy)return;setBusy('remove');setStatus('');
  try {await request({action:'detach',id:draft});setMedia(null);setSaved(false);}
  catch(error){setStatus(error instanceof Error?error.message:'Could not remove this attachment.');}
  finally{setBusy(null);}
 }
 async function submit(action:'preview'|'publish') {
  if(busy)return;setBusy(action);setStatus('');
  try {
   const data=await request({action,id:draft||undefined,title,body,therapistId:kind==='therapist'?Number(therapist):null});
   if(action==='preview'){setDraft(data.id);setSaved(true);setStatus('Preview saved. Review the post before publishing.');}
   else {setStatus('Published to your official Telegram channel.');setDraft('');setSaved(false);setMedia(null);}
  }catch(error){setStatus(error instanceof Error?error.message:'Please try again.');}
  finally{setBusy(null);}
 }
 const actions=postActions(kind==='therapist' && therapist?Number(therapist):null);
 const captionLength=postCaptionLength(title.trim(),body.trim());
 const tooLong=Boolean(media && captionLength>MEDIA_CAPTION_LIMIT);
 return <section className="publishing-studio">
  <div className="studio-heading"><div><span className="eyebrow">OFFICIAL CHANNEL</span><h2>Publishing studio</h2><p>Thoughtful announcements. A clear next step.</p></div><span className="channel-connection"><CheckCircle size={16}/>{channel?.canPost?channel.title:channel?'Posting permission required':connectionError?'Connection unavailable':'Checking channel connection…'}</span></div>
  {channel && !channel.canLaunch && <div className="studio-launch-setup" role="status"><div><strong>Connect direct Mini App launch</strong><p>In BotFather, enable your bot’s Main Mini App and set its URL to the Addis platform. Your channel buttons will then open the app directly.</p></div><a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer">Open BotFather ↗</a><button type="button" disabled={Boolean(busy)} onClick={()=>void checkConnection()}>{busy==='connection'?'Checking…':'Check connection'}</button></div>}
  <div className="studio-grid"><form onSubmit={e=>{e.preventDefault();void submit('preview');}} className="studio-editor">
   <fieldset disabled={Boolean(busy)} className="studio-fields">
    <label>Post type<select value={kind} onChange={e=>template(e.target.value)}><option value="general">General announcement</option><option value="therapist">Introduce a practitioner</option><option value="care">Wellbeing & community</option></select></label>
    {kind==='therapist' && <label>Practitioner<select required value={therapist} onChange={e=>{setTherapist(e.target.value);edit();const p=people.find(p=>p.id===Number(e.target.value));if(p)setTitle(`Meet ${p.name}`);}}><option value="">Choose a practitioner</option>{people.filter(p=>!p.badge).map(p=><option key={p.id} value={p.id}>{p.name} · {p.title}</option>)}</select></label>}
    <label>Heading<input required maxLength={120} value={title} onChange={e=>{setTitle(e.target.value);edit();}}/></label>
    <div className="studio-media-control">
     <div className="studio-media-title"><strong>Photo or video</strong><span>Optional</span></div>
     <label className={`studio-media-upload ${busy==='upload'?'is-uploading':''}`}>
      {busy==='upload'?<LoaderCircle size={24} className="spin"/>:<ImagePlus size={24}/>}
      <span><strong>{busy==='upload'?'Uploading attachment…':media?'Replace photo or video':'Add a photo or video'}</strong><small>JPG / PNG · up to 5 MB &nbsp; MP4 · up to 20 MB</small></span>
      <input aria-label="Upload photo or video" type="file" accept="image/jpeg,image/png,video/mp4" onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file)void attach(file);}}/>
     </label>
     {media && <div className="studio-attachment">{media.type==='video'?<Film size={18}/>:<ImagePlus size={18}/>}<div><strong>{media.name}</strong><small>{(media.size/1024/1024).toFixed(1)} MB · Ready to attach</small></div><button type="button" aria-label="Remove attachment" onClick={()=>void removeMedia()}><X size={18}/></button></div>}
    </div>
    <label>{media?'Caption':'Message'}<textarea required rows={7} maxLength={2800} value={body} onChange={e=>{setBody(e.target.value);edit();}}/><small className={tooLong?'studio-limit-error':''}>{media?`${captionLength.toLocaleString()} / 1,024 · includes heading and footer`:`${body.length.toLocaleString()} / 2,800`}</small></label>
    {tooLong && <p role="alert" className="studio-limit-error">Shorten the caption to fit Telegram’s 1,024-character limit.</p>}
    <div className="studio-submit"><button type="submit" disabled={tooLong} className="solid"><Eye size={16}/>{busy==='preview'?'Saving…':'Save preview'}</button>{saved && <button type="button" className="solid" disabled={!channel?.canPost || !channel.canLaunch || tooLong} onClick={()=>void submit('publish')}><Send size={16}/>{busy==='publish'?'Publishing…':'Publish to channel'}</button>}</div>
   </fieldset>
   {status && <p role="status" className="notice">{status}</p>}
  </form><div className="studio-preview"><span className="eyebrow"><MessageCircle size={14}/> TELEGRAM PREVIEW</span><article className="telegram-post-preview"><header><span>AP</span><div><strong>Addis Psychology</strong><small>Official channel</small></div></header>
   {media && <div className="telegram-media-preview">{media.type==='video'?<video src={media.url} controls playsInline preload="metadata" aria-label="Channel video preview"/>:<img src={media.url} alt="Selected channel attachment"/>}<span>{media.type==='video'?'VIDEO':'PHOTO'}</span></div>}
   <strong className="telegram-brand">ADDIS PSYCHOLOGY</strong><em>ድጋፍ። በእርስዎ ምርጫ።</em><h3>{title}</h3><p>{body}</p><footer>Professional support. Space to be heard.</footer></article><div className="telegram-preview-buttons">{actions.map((row,i)=><div key={i}>{row.map(b=><span key={b.path+b.text}>{b.text} ↗</span>)}</div>)}</div><small className="studio-preview-note">The attachment, caption and buttons appear together in your channel. Save the preview after each change.</small></div></div>
 </section>;
}
