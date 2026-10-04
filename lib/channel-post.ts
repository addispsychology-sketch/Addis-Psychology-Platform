export function escapeTelegram(value:string) {return value.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]!));}
export function postText(title:string,body:string) {
 return `<b>ADDIS PSYCHOLOGY</b>\n<i>ድጋፍ። በእርስዎ ምርጫ።</i>\n\n<b>${escapeTelegram(title)}</b>\n\n${escapeTelegram(body)}\n\n<i>Professional support. Space to be heard.</i>`;
}
export function postCaptionLength(title:string,body:string) {
 return `ADDIS PSYCHOLOGY\nድጋፍ። በእርስዎ ምርጫ።\n\n${title}\n\n${body}\n\nProfessional support. Space to be heard.`.length;
}
export function postActions(therapistId?:number|null) {
 return therapistId ? [
  [{text:'💬 Text therapist',path:`/chat?therapist=${therapistId}`},{text:'🎙 Voice conversation',path:`/chat?therapist=${therapistId}`}],
  [{text:'📅 Book a session',path:`/schedule/${therapistId}`}]
 ] : [[{text:'Open Addis Platform',path:'/'}],[{text:'Find your psychologist',path:'/therapists'}]];
}
