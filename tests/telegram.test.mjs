import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {randomUUID} from 'node:crypto';

test('bot launch buttons preserve destinations and media-first drafts keep their attachment',async()=>{
 const pure=async name=>import('data:text/javascript,'+encodeURIComponent(stripTypeScriptTypes(readFileSync(new URL(`../lib/${name}.ts`,import.meta.url),'utf8'))));
 const {miniAppLink}=await pure('telegram-links');
 const {postText,postActions,postCaptionLength}=await pure('channel-post');
 const calls=[],tables=new Map();
 const db={from(table){
  let mode='select',value,filters=[],single=false;
  const query={select(){return query;},eq(k,v){filters.push([k,v]);return query;},contains(){return query;},maybeSingle(){single=true;return query;},upsert(v){mode='upsert';value=v;return query;},update(v){mode='update';value=v;return query;},insert(v){mode='insert';value=v;return query;},delete(){mode='delete';return query;},throwOnError(){return query;},then(resolve,reject){
   try{
    let rows=tables.get(table)||[];
    const matches=row=>filters.every(([k,v])=>row[k]===v);
    if(mode==='upsert'){rows=[value];tables.set(table,rows);}
    if(mode==='insert'){rows.push(value);tables.set(table,rows);}
    if(mode==='update'){rows=rows.map(row=>matches(row)?{...row,...value}:row);tables.set(table,rows);}
    if(mode==='delete'){rows=rows.filter(row=>!matches(row));tables.set(table,rows);}
    resolve({data:single?rows.find(matches)||null:rows.filter(matches),error:null});
   }catch(error){reject(error);}
  }};return query;
 }};
 let source=stripTypeScriptTypes(readFileSync(new URL('../lib/telegram-bot.ts',import.meta.url),'utf8')).replace(/^import .*;\r?\n/gm,'');
 source=source.replace('export async function handleBotUpdate','async function handleBotUpdate');
 const create=await import('data:text/javascript,'+encodeURIComponent(`export function create({randomUUID,serviceDb,siteUrl,miniLink,privateAppButton,telegram,TelegramRejectedError,requireDirectMiniApp,normalizePhone,announcementChannel,postText,postActions,postCaptionLength,MEDIA_CAPTION_LIMIT}) {\n${source}\nreturn handleBotUpdate;}`));
 const origin='https://example.com';
 let configured=false;
 const handler=create.create({randomUUID,serviceDb:()=>db,siteUrl:path=>origin+path,miniLink:path=>miniAppLink('test_bot',path),privateAppButton:(text,path)=>({text,web_app:{url:origin+path}}),telegram:async(method,payload)=>{calls.push({method,payload});return {message_id:42};},TelegramRejectedError:class extends Error{},requireDirectMiniApp:async()=>{if(!configured)throw new Error('Main app missing');},normalizePhone:()=>{},announcementChannel:async()=>'-1001234567',postText,postActions,postCaptionLength,MEDIA_CAPTION_LIMIT:1024});
 const prior=process.env.TELEGRAM_ADMIN_IDS;process.env.TELEGRAM_ADMIN_IDS='123456';
 const message=fields=>({update_id:1,message:{chat:{id:123456,type:'private'},from:{id:123456},...fields}});
 try{
  await handler(message({text:'/start'}));
  assert.deepEqual(calls.at(-1).payload.reply_markup.inline_keyboard.flat().map(b=>b.web_app.url),['/','/chat','/appointments','/therapists','/account'].map(path=>origin+path));
  await handler(message({text:'/announce'}));
  await handler(message({video:{file_id:'private-test-video'}}));
  assert.match(calls.at(-1).payload.text,/caption next/);
  await handler(message({text:'Community check-in\nA calm, confidential space to be heard.'}));
  const preview=calls.findLast(call=>call.method==='sendVideo');
  assert.equal(preview.payload.video,'private-test-video');assert.equal(preview.payload.supports_streaming,true);
  assert.ok(preview.payload.caption.includes('<b>Community check-in</b>'));
  assert.equal(preview.payload.reply_markup.inline_keyboard[0][0].web_app.url,origin+'/');
  const draft=tables.get('telegram_admin_drafts')[0].draft;
  await handler({update_id:2,callback_query:{id:'callback',from:{id:123456},data:'publish:'+draft.id,message:{chat:{id:123456,type:'private'},from:{id:1,is_bot:true}}}});
  assert.equal(calls.filter(call=>call.method==='sendVideo'&&call.payload.chat_id==='-1001234567').length,0);
  assert.equal(tables.get('telegram_admin_drafts')[0].draft.stage,'ready');
  configured=true;
  await handler({update_id:3,callback_query:{id:'callback2',from:{id:123456},data:'publish:'+draft.id,message:{chat:{id:123456,type:'private'},from:{id:1,is_bot:true}}}});
  const published=calls.findLast(call=>call.method==='sendVideo');
  assert.equal(published.payload.chat_id,'-1001234567');
  assert.equal(published.payload.reply_markup.inline_keyboard[0][0].url,'https://t.me/test_bot?startapp=Lw');
 }finally{if(prior===undefined)delete process.env.TELEGRAM_ADMIN_IDS;else process.env.TELEGRAM_ADMIN_IDS=prior;}
});
