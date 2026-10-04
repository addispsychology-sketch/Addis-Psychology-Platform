export default function ConversationActivity({state,name}:{state:'typing'|'recording'|'idle';name:string}) {
  if(state==='idle') return null;
  return <div className={`conversation-activity ${state}`} role="status" aria-live="polite">
    <span className={state==='recording'?'activity-wave':'typing-dots-anim'} aria-hidden="true"><span/><span/><span/></span>
    <span>{name} {state==='recording'?'is recording a voice note…':'is typing…'}</span>
  </div>;
}
