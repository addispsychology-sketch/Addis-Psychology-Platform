import {authorizeAdmin} from '@/lib/admin-auth';
import {apiError} from '@/lib/server-services';
import {telegram,miniLink,TelegramRejectedError,mainMiniAppReady,requireDirectMiniApp} from '@/lib/telegram-server';
import {announcementChannel} from '@/lib/channel-server';
import {postActions,postText,postCaptionLength} from '@/lib/channel-post';
import {CHANNEL_MEDIA_BUCKET,MEDIA_CAPTION_LIMIT,channelMediaSpec,channelMediaType} from '@/lib/channel-media';
import type {SupabaseClient} from '@supabase/supabase-js';

export const maxDuration = 60;

type MediaPost = {media_path:string|null;media_mime:string|null;media_size:number|null;media_type:'photo'|'video'|null};

async function verifiedMedia(db:SupabaseClient,post:MediaPost) {
 if(!post.media_path)return null;
 const bucket=db.storage.from(CHANNEL_MEDIA_BUCKET);
 const {data:info,error}=await bucket.info(post.media_path);
 if(error || !info)throw new Error('The media upload is incomplete. Please upload the file again.');
 const spec=channelMediaSpec(info.contentType || '',Number(info.size));
 if(spec.type!==post.media_type || spec.contentType!==post.media_mime || spec.size!==Number(post.media_size))throw new Error('The uploaded media does not match this draft. Upload the file again.');
 const {data:link,error:linkError}=await bucket.createSignedUrl(post.media_path,600);
 if(linkError || !link)throw new Error('Unable to prepare this attachment. Please try again.');
 // Only inspect the file header; large videos never pass through the function.
 const response=await fetch(link.signedUrl,{headers:{Range:'bytes=0-511'},signal:AbortSignal.timeout(10000)});
 const reader=response.body?.getReader();
 if(!response.ok || !reader)throw new Error('Unable to check this attachment. Please try again.');
 const {value}=await reader.read();
 await reader.cancel();
 if(!value || channelMediaType(value.slice(0,512))!==spec.contentType)throw new Error('Choose a valid JPG, PNG or MP4 file.');
 return {type:spec.type,url:link.signedUrl};
}

export async function GET(request:Request) {
 try {
  await authorizeAdmin(request);
  const channel=await announcementChannel();
  const [chat,bot]=await Promise.all([telegram('getChat',{chat_id:channel}),telegram('getMe',{})]);
  const member=await telegram('getChatMember',{chat_id:channel,user_id:bot.id});
  return Response.json({title:chat.title,canPost:member.status==='creator' || member.status==='administrator' && member.can_post_messages===true,canLaunch:mainMiniAppReady(bot)});
 } catch(error){return apiError(error);}
}

export async function POST(request:Request) {
 try {
  const {user,db}=await authorizeAdmin(request);
  const input=await request.json();
  if(input.action==='upload') {
   const spec=channelMediaSpec(input.contentType,Number(input.size));
   const id=crypto.randomUUID();
   const path=`${user.id}/${id}/${crypto.randomUUID()}.${spec.extension}`;
   const {data:upload,error}=await db.storage.from(CHANNEL_MEDIA_BUCKET).createSignedUploadUrl(path);
   if(error || !upload)throw new Error('Unable to prepare an upload. Please try again.');
   await db.from('channel_posts').insert({id,actor:user.id,title:'',body:'',media_path:path,media_type:spec.type,media_mime:spec.contentType,media_size:spec.size}).throwOnError();
   return Response.json({id,bucket:CHANNEL_MEDIA_BUCKET,path,token:upload.token});
  }
  if(input.action==='detach' || input.action==='discard') {
   const {data:post,error}=await db.from('channel_posts').select('id,media_path').eq('id',input.id).eq('actor',user.id).eq('status','draft').single();
   if(error || !post)throw new Error('Only an unpublished draft can be changed.');
   if(post.media_path) {
    const {error:removeError}=await db.storage.from(CHANNEL_MEDIA_BUCKET).remove([post.media_path]);
    if(removeError)throw new Error('Unable to remove the attachment. Please try again.');
   }
   if(input.action==='discard')await db.from('channel_posts').delete().eq('id',post.id).eq('status','draft').throwOnError();
   else await db.from('channel_posts').update({media_path:null,media_type:null,media_mime:null,media_size:null}).eq('id',post.id).eq('status','draft').throwOnError();
   return Response.json({ok:true});
  }
  if(input.action==='preview') {
   const title=typeof input.title==='string'?input.title.trim():'';
   const body=typeof input.body==='string'?input.body.trim():'';
   if(!title || title.length>120 || !body || body.length>2800)throw new Error('Add a heading and a message of up to 2,800 characters.');
   const therapist=input.therapistId?Number(input.therapistId):null;
   if(therapist) {
    const {data}=await db.from('practitioners').select('id').eq('id',therapist).eq('approved',true).single();
    if(!data)throw new Error('Select an approved practitioner.');
   }
   const id=input.id || crypto.randomUUID();
   if(input.id) {
    const {data:post}=await db.from('channel_posts').select('*').eq('id',id).eq('actor',user.id).eq('status','draft').single();
    if(!post)throw new Error('Draft not found. Create a new preview.');
    if(post.media_path && postCaptionLength(title,body)>MEDIA_CAPTION_LIMIT)throw new Error('Photo and video captions, including the heading and footer, must fit within 1,024 characters.');
    await verifiedMedia(db,post);
    const {data:saved}=await db.from('channel_posts').update({title,body,therapist_id:therapist}).eq('id',id).eq('status','draft').select('id').throwOnError();
    if(!saved?.length)throw new Error('This draft was already submitted.');
   } else await db.from('channel_posts').insert({id,actor:user.id,title,body,therapist_id:therapist}).throwOnError();
   return Response.json({id,title,body,actions:postActions(therapist)});
  }
  if(input.action!=='publish')throw new Error('Choose preview or publish.');
  const channel=await announcementChannel();
  const {data:post}=await db.from('channel_posts').select('*').eq('id',input.id).eq('actor',user.id).single();
  if(!post || !post.title || !post.body)throw new Error('Draft not found. Save your preview first.');
  if(post.status==='published')return Response.json({ok:true,messageId:post.telegram_message_id});
  await requireDirectMiniApp();
  if(post.media_path && postCaptionLength(post.title,post.body)>MEDIA_CAPTION_LIMIT)throw new Error('This media caption is too long. Shorten it and save the preview.');
  const media=await verifiedMedia(db,post);
  const {data:claim}=await db.from('channel_posts').update({status:'publishing'}).eq('id',post.id).eq('status','draft').select('id');
  if(!claim?.length)throw new Error('This post was already submitted. Check the channel before publishing again.');
  const formatted=postText(post.title,post.body);
  const payload={chat_id:channel,parse_mode:'HTML',reply_markup:{inline_keyboard:postActions(post.therapist_id).map(row=>row.map(button=>({text:button.text,url:miniLink(button.path)})))},...(media?{[media.type]:media.url,caption:formatted,...(media.type==='video'?{supports_streaming:true}:{})}:{text:formatted})};
  let result;
  try {result=await telegram(media?(media.type==='photo'?'sendPhoto':'sendVideo'):'sendMessage',payload);}
  catch(error) {
   // Explicit API rejection is safe to retry. A timed-out delivery may already exist.
   if(error instanceof TelegramRejectedError)await db.from('channel_posts').update({status:'draft'}).eq('id',post.id).eq('status','publishing');
   throw error instanceof TelegramRejectedError?new Error('Telegram rejected this post. Check the attachment and channel permission, then try again.'):new Error('Telegram did not confirm delivery. Check the channel before creating another post.');
  }
  await db.from('channel_posts').update({status:'published',telegram_message_id:result.message_id}).eq('id',post.id).throwOnError();
  return Response.json({ok:true,messageId:result.message_id});
 }catch(error){return apiError(error);}
}
