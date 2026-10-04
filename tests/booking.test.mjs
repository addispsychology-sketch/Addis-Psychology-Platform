import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

function moduleAt(path, dependencies={}) {
  const source=readFileSync(new URL('../'+path,import.meta.url),'utf8');
  const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
  const loaded={exports:{}};
  new Function('require','module','exports',output)(name=>{
    if(name in dependencies)return dependencies[name];
    throw new Error('Unexpected dependency: '+name);
  },loaded,loaded.exports);
  return loaded.exports;
}
const calendar=moduleAt('lib/calendar.ts');
const booking=moduleAt('lib/booking-validation.ts');
const commerce=moduleAt('lib/commerce.ts');
const availability=moduleAt('lib/booking-slots.ts',{'./calendar':calendar});

test('quick and full booking share future slots, skip exhausted days and exclude occupied times',()=>{
  const conf={days:[1,2,3,4,5],start:'09:00',end:'11:00'};
  const now=Date.parse('2026-10-05T08:00:00Z'); // Monday 11:00 in Addis.
  assert.equal(availability.upcomingBookingDays(1,conf,[],now)[0],'2026-10-06');
  const appointments=[{therapist:1,date:'2026-10-06',time:'09:00',status:'pending'}];
  assert.deepEqual(availability.availableBookingSlots(1,'2026-10-06',conf,appointments,now),['10:00']);
  assert.deepEqual(availability.availableBookingSlots(1,'2026-10-06',conf,[{...appointments[0],status:'cancelled'}],now),['09:00','10:00']);
  assert.deepEqual(availability.availableBookingSlots(1,'2026-10-11',conf,[],now),[]);
  assert.deepEqual(availability.upcomingBookingDays(1,{...conf,days:[]},[],now),[]);
  assert.deepEqual(availability.availableBookingSlots(1,'',conf,[],now),[]);
});

function hooks() {
  const values=[],effects=[];let cursor=0,pending=[];
  const react={
    useState(initial){const id=cursor++;if(!(id in values))values[id]=typeof initial==='function'?initial():initial;return [values[id],v=>{values[id]=typeof v==='function'?v(values[id]):v;}];},
    useRef(initial){const id=cursor++;return values[id]??=( {current:initial} );},
    useCallback(fn){cursor++;return fn;},
    useEffect(fn,deps){const id=cursor++,prior=effects[id];if(!prior||deps.some((v,i)=>v!==prior.deps[i])){pending.push(()=>{prior?.cleanup?.();effects[id]={deps,cleanup:fn()};});}}
  };
  return {react,render(fn){cursor=0;return fn();},flush(){const jobs=pending;pending=[];jobs.forEach(fn=>fn());},unmount(){effects.forEach(e=>e?.cleanup?.());}};
}
const jsx={jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})};
function nodes(tree) {return !tree||typeof tree!=='object'?[]:Array.isArray(tree)?tree.flatMap(nodes):[tree,...nodes(tree.props?.children)];}

test('leaving the home loader releases document scrolling before the timer completes',()=>{
  const h=hooks(),document={body:{style:{overflow:'auto'}},documentElement:{style:{overflow:'scroll'}}};
  const source=ts.transpileModule(readFileSync(new URL('../lib/useDocumentScrollLock.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
  const mod={exports:{}};new Function('require','module','exports','document',source)(()=>h.react,mod,mod.exports,document);
  const lock=mod.exports.useDocumentScrollLock;
  h.render(()=>lock(true));h.flush();assert.equal(document.body.style.overflow,'hidden');
  h.render(()=>lock(false));h.flush();assert.equal(document.body.style.overflow,'auto');assert.equal(document.documentElement.style.overflow,'scroll');
  h.render(()=>lock(true));h.flush();h.unmount();assert.equal(document.body.style.overflow,'auto');
});

function formHarness(request) {
  const h=hooks();let refreshed=0,booked=0;
  const Component=moduleAt('components/BookingDetails.tsx',{
    react:h.react,'react/jsx-runtime':jsx,'next/link':{default:'a'},'lucide-react':{ArrowRight:'icon',ShieldCheck:'icon'},'framer-motion':{motion:{div:'div'}},
    './Platform':{usePlatform:()=>({userId:'qa-client',refreshAppointments:async()=>{refreshed++;}})},
    '@/lib/supabase':{getSupabase:()=>null,authenticatedFetch:request},'@/lib/booking-validation':booking
  }).default;
  const props={therapist:1,day:calendar.shiftDate(calendar.dateKey(),1),time:'10:00',medium:'online',available:true,onBooked:()=>booked++};
  const render=()=>h.render(()=>Component(props));
  const fill=()=>{
    let tree=render();let inputs=nodes(tree).filter(n=>n.type==='input');
    assert.equal(inputs[0].props.required,true);assert.equal(inputs[1].props.type,'tel');
    inputs[0].props.onChange({target:{value:'QA Client'}});inputs[1].props.onChange({target:{value:'0911 111 111'}});inputs[2].props.onChange({target:{checked:true}});
    tree=render();return nodes(tree).find(n=>n.type==='form').props.onSubmit;
  };
  return {render,fill,props,counts:()=>({refreshed,booked})};
}
test('booking confirmation sends name and normalized phone once and displays success only after saving',async()=>{
  const calls=[];let finish;
  const h=formHarness(async(path,init)=>{calls.push({path,body:JSON.parse(init.body)});await new Promise(resolve=>finish=resolve);return {id:'qa-booking'};});
  const submit=h.fill();const first=submit({preventDefault(){}});await submit({preventDefault(){}});
  assert.equal(calls.length,1);assert.equal(calls[0].path,'/api/bookings');assert.equal(calls[0].body.name,'QA Client');assert.equal(calls[0].body.phone,'+251911111111');
  assert.equal(h.counts().booked,0);finish();await first;
  assert.deepEqual(h.counts(),{refreshed:1,booked:1});assert.ok(nodes(h.render()).some(n=>n.props?.role==='status'));
});
test('invalid contact details and failed bookings remain retryable without false confirmation',async()=>{
  let calls=0;const h=formHarness(async()=>{calls++;throw new Error('That time has just been booked. Please choose another.');});
  let submit=h.fill();await submit({preventDefault(){}});
  assert.equal(h.counts().booked,0);assert.ok(nodes(h.render()).some(n=>n.props?.role==='alert'));
  submit=h.fill();await submit({preventDefault(){}});assert.equal(calls,2);
  const inputs=nodes(h.render()).filter(n=>n.type==='input');inputs[1].props.onChange({target:{value:'123'}});
  submit=nodes(h.render()).find(n=>n.type==='form').props.onSubmit;await submit({preventDefault(){}});assert.equal(calls,2);
  h.props.available=false;await nodes(h.render()).find(n=>n.type==='form').props.onSubmit({preventDefault(){}});assert.equal(calls,2);
});

test('booking API saves contact details, rejects invalid requests and schedules notification delivery',async()=>{
  let saved,conflict=false,notifications=0;const after=[];
  const db={from(table){const query={select(){return query;},eq(){return query;},insert(value){saved=value;return query;},async single(){return table==='practitioners'?{data:{id:1,user_id:'therapist',approved:true,settings:{days:[0,1,2,3,4,5,6],start:'09:00',end:'17:00',online:1200},profile:{}},error:null}:{data:conflict?null:{id:'qa-booking'},error:conflict?{code:'23505'}:null};}};return query;}};
  const {POST}=moduleAt('app/api/bookings/route.ts',{
    'next/server':{after:fn=>after.push(fn)},'@/lib/notifications':{deliverNotifications:async()=>{notifications++;}},'@/lib/require-terms':{requireTerms:async()=>{}},
    '@/lib/server-auth':{authorize:async r=>{if(r.headers.get('Authorization')!=='Bearer qa-client')throw new Error('Unauthorized');return {user:{id:'client'}};}},
    '@/lib/server-services':{serviceDb:()=>db,apiError:error=>Response.json({error:error.message},{status:error.message==='Unauthorized'?401:400})},
    '@/lib/booking-validation':booking,'@/lib/calendar':calendar,'@/lib/commerce':commerce
  });
  const input={therapist:1,date:calendar.shiftDate(calendar.dateKey(),1),time:'10:00',medium:'online',name:'QA Client',phone:'0911111111',consent:true};
  const request=(body=input,auth=true)=>new Request('https://example.com/api/bookings',{method:'POST',headers:auth?{Authorization:'Bearer qa-client'}:{},body:JSON.stringify(body)});
  assert.equal((await POST(request(input,false))).status,401);
  assert.equal((await POST(request({...input,phone:'123'}))).status,400);
  assert.equal((await POST(request())).status,201);assert.equal(saved.client_name,'QA Client');assert.equal(saved.phone,'+251911111111');assert.equal(saved.price,1200);
  await after[0]();assert.equal(notifications,1);
  conflict=true;assert.equal((await POST(request())).status,409);assert.equal(after.length,1);
});
