'use client';
import { useState } from 'react';
import { Appointment, usePlatform, statusLabel } from './Platform';
import { Modal } from './Shell';
import { dateKey, shiftDate, slots, isFutureSlot } from '@/lib/calendar';

export default function PortalCalendar({ id }: { id: number }) {
  const { t, state, date, settings, updateAppointment, money } = usePlatform();
  const [mode, setMode] = useState<'month' | 'week' | 'day'>('month');
  const [focus, setFocus] = useState(dateKey());
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [newDay, setNewDay] = useState('');
  const [newTime, setNewTime] = useState('');
  const [error, setError] = useState('');
  const appointments = state.appointments.filter(a => a.therapist === id && a.status !== 'cancelled');
  const weekday = (d: string) => new Date(d + 'T12:00:00+03:00').getUTCDay();
  const monthStart = focus.slice(0, 7) + '-01';
  const weekStart = shiftDate(focus, -weekday(focus));
  const days = Array.from({ length: mode === 'month' ? 42 : mode === 'week' ? 7 : 1 }, (_, i) =>
    shiftDate(mode === 'month' ? shiftDate(monthStart, -weekday(monthStart)) : mode === 'week' ? weekStart : focus, i));
  const forDay = (d: string) => appointments.filter(a => a.date === d).sort((a, b) => a.time.localeCompare(b.time));
  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0') + ':00');
  const visibleAppointments = appointments.filter(a => days.includes(a.date));
  const firstHour = Math.min(Number(settings(id).start.split(':')[0]), ...visibleAppointments.map(a => Number(a.time.split(':')[0])));
  const lastHour = Math.max(Number(settings(id).end.split(':')[0]), ...visibleAppointments.map(a => Number(a.time.split(':')[0]) + 1));
  const visibleHours = hours.slice(firstHour, lastHour);
  function move(direction: number) {
    if (mode === 'month') {
      const d = new Date(monthStart + 'T12:00:00Z');
      d.setUTCMonth(d.getUTCMonth() + direction);
      setFocus(d.toISOString().slice(0, 10));
    } else setFocus(shiftDate(focus, direction * (mode === 'week' ? 7 : 1)));
  }
  function openAppointment(a: Appointment) { setSelected(a); setNewDay(a.date); setNewTime(a.time); setError(''); }
  function event(a: Appointment) {
    return <button className={'calendar-event ' + a.status} key={a.id} onClick={() => openAppointment(a)}>
      <strong>{a.time}</strong><span>{a.client === 'demo-client' ? t('Demo client', 'የማሳያ ደንበኛ') : a.client}</span>
      <small>{statusLabel(a.status, t)}</small>
    </button>;
  }
 function reschedule(){const conf=settings(id);if(!selected||!isFutureSlot(newDay,newTime)||!conf.days.includes(new Date(`${newDay}T12:00`).getDay())||!slots(conf.start,conf.end).includes(newTime)||state.appointments.some(a=>a.id!==selected.id&&a.therapist===id&&a.date===newDay&&a.time===newTime&&a.status!=='cancelled')){setError(t('Choose a future, available time within your working hours.','በሥራ ሰዓትዎ ውስጥ ያለ ያልተያዘ የወደፊት ሰዓት ይምረጡ።'));return;}updateAppointment(selected.id,{date:newDay,time:newTime,status:'confirmed'});setSelected(null);}
 function exportCSV(){const cell=(s:string)=>'"'+(/^[=+@-]/.test(s)?"'":'')+s.replaceAll('"','""')+'"';const rows=[[t('Client','ደንበኛ'),t('Date','ቀን'),t('Time UTC+3','ሰዓት UTC+3'),t('Status','ሁኔታ'),t('Price ETB','ዋጋ ብር')],...appointments.map(a=>[a.client==='demo-client'?t('Demo client','የማሳያ ደንበኛ'):a.client,a.date,a.time,statusLabel(a.status,t),String(a.price)])];const url=URL.createObjectURL(new Blob(['\uFEFF'+rows.map(r=>r.map(cell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='addis-demo-appointments.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}

  return <section className="practice-calendar">
    <div className="section-line"><div><span className="eyebrow">{t('YOUR PRACTICE / YOUR PACE', 'የእርስዎ ሥራ / የእርስዎ ፍጥነት')}</span><h2>{t('Your calendar.', 'የቀጠሮ ሰሌዳዎ።')}</h2></div><button onClick={exportCSV}>{t('Export CSV', 'CSV አውርድ')}</button></div>
    <div className="practice-calendar-toolbar">
      <div className="segmented">{(['month', 'week', 'day'] as const).map(m => <button key={m} aria-pressed={mode === m} onClick={() => setMode(m)}>{m === 'month' ? t('Month', 'ወር') : m === 'week' ? t('Week', 'ሳምንት') : t('Day', 'ቀን')}</button>)}</div>
      <div className="calendar-paging"><button onClick={() => move(-1)} aria-label={t('Previous period', 'ቀዳሚ ጊዜ')}>←</button><button onClick={() => setFocus(dateKey())}>{t('Today', 'ዛሬ')}</button><button onClick={() => move(1)} aria-label={t('Next period', 'ቀጣይ ጊዜ')}>→</button></div>
    </div>
    <div className="calendar-period-heading"><h3>{mode === 'week' ? date(days[0] + 'T12:00') + ' – ' + date(days[6] + 'T12:00') : date(focus + 'T12:00', { month: 'long', year: 'numeric', ...(mode === 'day' ? { day: 'numeric' } : {}) })}</h3><small>{t('Addis Ababa · UTC+3', 'አዲስ አበባ · UTC+3')}</small></div>
    {mode === 'month' ? <div className="month-board">
      {days.slice(0, 7).map(d => <div className="weekday-label" key={d}>{date(d + 'T12:00', { weekday: 'short' })}</div>)}
      {days.map(d => <div key={d} className={'month-cell ' + (d.slice(0, 7) !== focus.slice(0, 7) ? 'outside-month ' : '') + (d === dateKey() ? 'is-today' : '')}>
        <button className="calendar-date-button" aria-label={date(d + 'T12:00', { weekday: 'long', month: 'long', day: 'numeric' })} onClick={() => { setFocus(d); setMode('day'); }}>{Number(d.slice(-2))}</button>
        <div className="month-events">{forDay(d).slice(0, 2).map(event)}</div>
        {forDay(d).length > 0 && <button className="month-count" onClick={() => { setFocus(d); setMode('day'); }}>{forDay(d).length} {t('booked', 'ቀጠሮ')}</button>}
      </div>)}
    </div> : <>
      {mode === 'week' && <div className="mobile-week-strip">{days.map(d => <button key={d} aria-pressed={d === focus} onClick={() => setFocus(d)}><small>{date(d + 'T12:00', { weekday: 'short' })}</small><strong>{Number(d.slice(-2))}</strong><span aria-label={forDay(d).length + ' bookings'}>{forDay(d).length ? '●' : '·'}</span></button>)}</div>}
      <div className={'schedule-board ' + mode} style={{ '--day-count': days.length } as React.CSSProperties}>
        <div className="schedule-grid-head"><span>{t('Time', 'ሰዓት')}</span>{days.map(d => <button key={d} className={d === dateKey() ? 'is-today' : ''} onClick={() => { setFocus(d); setMode('day'); }}>{date(d + 'T12:00', { weekday: 'short', day: 'numeric' })}</button>)}</div>
        {visibleHours.map(hour => <div className="schedule-hour-row" key={hour}><time>{hour}</time>{days.map(d => <div className="schedule-hour-cell" key={d}>{forDay(d).filter(a => a.time.slice(0, 2) === hour.slice(0, 2)).map(event)}</div>)}</div>)}
      </div>
      {mode === 'week' && <div className="mobile-week-agenda"><h3>{date(focus + 'T12:00', { weekday: 'long', month: 'short', day: 'numeric' })}</h3>{forDay(focus).length ? forDay(focus).map(event) : <p className="muted">{t('A little room to breathe. No appointments today.', 'ዛሬ ምንም ቀጠሮ የለም።')}</p>}</div>}
    </>}
    <p className="calendar-legend"><span>● {t('Confirmed', 'የተረጋገጠ')}</span><span>◌ {t('Pending', 'በመጠባበቅ ላይ')}</span><small>{t('Select an appointment to manage it.', 'ለማስተዳደር ቀጠሮ ይምረጡ።')}</small></p>
 {selected&&<Modal title={t('Appointment details','የቀጠሮ ዝርዝር')} close={()=>setSelected(null)}><p>{selected.client==='demo-client'?t('Demo client','የማሳያ ደንበኛ'):selected.client} · {statusLabel(selected.status,t)}</p><p>{date(`${selected.date}T12:00`)} · {selected.time} · {money(selected.price)}</p><div className="form-actions">{selected.status==='pending'&&<button className="solid" onClick={()=>{updateAppointment(selected.id,{status:'confirmed'});setSelected(null);}}>{t('Confirm','አረጋግጥ')}</button>}{selected.status==='confirmed'&&<button onClick={()=>{updateAppointment(selected.id,{status:'completed'});setSelected(null);}}>{t('Mark completed','ተጠናቋል ብለው ያመልክቱ')}</button>}{selected.status!=='completed'&&<button onClick={()=>{updateAppointment(selected.id,{status:'cancelled'});setSelected(null);}}>{t('Cancel appointment','ቀጠሮ ሰርዝ')}</button>}</div>{selected.status!=='completed'&&<><h3>{t('Reschedule','እንደገና ቀጠሮ ያዙ')}</h3><p>{t('Changes update this local demo booking. No notification is sent.','ለውጦች ይህን የማሳያ ቀጠሮ ያዘምናሉ። ማሳወቂያ አይላክም።')}</p><div className="field-grid"><label>{t('Date','ቀን')}<input type="date" min={dateKey()} value={newDay} onChange={e=>setNewDay(e.target.value)}/></label><label>{t('Time','ሰዓት')}<select value={newTime} onChange={e=>setNewTime(e.target.value)}>{slots(settings(id).start,settings(id).end).map(s=><option key={s}>{s}</option>)}</select></label></div>{error&&<p role="alert">{error}</p>}<button className="solid" onClick={reschedule}>{t('Save new time','አዲስ ሰዓት አስቀምጥ')}</button></>}</Modal>}

  </section>;
}
