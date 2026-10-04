'use client';
import {useRef,useState} from 'react';
import {Check,Pencil,X} from 'lucide-react';
import {usePlatform,type Message} from './Platform';

export default function EditableMessage({message,mine,bodyClass}:{message:Message;mine:boolean;bodyClass:string}) {
 const {editMessage,t,date}=usePlatform();
 const [editing,setEditing]=useState(false),[draft,setDraft]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const saving=useRef(false);
 const cancel=()=>{if(!saving.current){setEditing(false);setError('');}};
 async function save(){
  if(saving.current || !draft.trim())return;
  if(draft.trim()===message.text){cancel();return;}
  saving.current=true;setBusy(true);setError('');
  const result=await editMessage(message.id,draft);
  saving.current=false;setBusy(false);
  if(result.ok)setEditing(false);else setError(result.error||t('Could not save your edit.','ለውጡን ማስቀመጥ አልተቻለም።'));
 }
 if(editing)return <form className="message-inline-editor" onSubmit={e=>{e.preventDefault();void save();}}>
  <span className="message-edit-heading"><Pencil size={13}/>{t('EDIT MESSAGE','መልዕክት ያስተካክሉ')}</span>
  <textarea autoFocus aria-label={t('Edit your message','መልዕክትዎን ያስተካክሉ')} value={draft} maxLength={2000} rows={3} disabled={busy} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Escape')cancel();if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();void save();}}}/>
  <div className="message-edit-actions"><small>{draft.length}/2000</small><button type="button" onClick={cancel} disabled={busy}><X size={14}/>{t('Cancel','ሰርዝ')}</button><button className="message-edit-save" disabled={busy||!draft.trim()}><Check size={14}/>{busy?t('Saving…','በማስቀመጥ ላይ…'):t('Save','አስቀምጥ')}</button></div>
  {error&&<small role="alert">{error}</small>}
 </form>;
 return <><p className={bodyClass}>{message.text}</p><div className="message-edit-meta">
  {message.editedAt&&<small title={date(message.editedAt)}>{t('Edited','የተስተካከለ')}</small>}
  {mine&&<button type="button" className="message-edit-trigger" aria-label={t('Edit message','መልዕክት ያስተካክሉ')} title={t('Edit message','መልዕክት ያስተካክሉ')} onClick={()=>{setDraft(message.text||'');setError('');setEditing(true);}}><Pencil size={13}/><span>{t('Edit','አስተካክል')}</span></button>}
 </div></>;
}
