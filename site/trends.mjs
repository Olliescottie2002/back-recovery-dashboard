import {dateKey,shiftDay,shiftMonth,daysBetween,average,group,period,minutes,recordedFlareFree,categories} from './model.mjs';
import {escape as e,table} from './view.mjs';

export const trendState = {range:'30 days',bucket:'Week',from:'',to:'',category:'All activities',exercise:''};
const colors = ['#24674a','#a35131','#575bc2','#89632e','#377483','#9a3d75'];
const format = value => value==null?'—':Number(value.toFixed(1));
const point = (day,value,detail='') => ({day,value,detail});
export const symptomSeries = checks => [['Pain','pain'],['Instability','instability'],['Leg symptoms','sciatica']].map(([label,key])=>({
  label,points:checks.map(r=>point(r.day,r[key]))
}));
export function chart(series,start,end,unit,maxScale,markers=[]) {
  const plotted = series.map(line=>({...line,points:line.points.filter(p=>Number.isFinite(p.value)).sort((a,b)=>a.day.localeCompare(b.day))}));
  const values = plotted.flatMap(line=>line.points.map(p=>p.value));
  if (!values.length && !markers.length) return '<p class="muted">No measurements in this date range.</p>';
  const limit = Math.max(1,maxScale||0,values.reduce((max,val)=>Math.max(max,val),0));
  const floor = values.reduce((min,val)=>Math.min(min,val),0);
  const span = Math.max(1,daysBetween(start,end));
  const x = day => 52+Math.min(419,Math.max(0,daysBetween(start,day)*419/span));
  const y = val => 170-(val-floor)*150/(limit-floor);
  const ticks = [floor,(floor+limit)/2,limit];
  const labels = [...new Set([start,shiftDay(start,Math.floor(span/2)),end])];
  const markerMarkup = markers.map(m=>`<line x1="${x(m.day)}" x2="${x(m.day)}" y1="20" y2="170" stroke="#788d79" stroke-dasharray="4 3"><title>${e(m.day+' · '+m.label)}</title></line>`).join('');
  const reveal = (line,p)=>`${p.day} · ${line.label} · ${format(p.value)} ${unit}${p.detail?' · '+p.detail:''}`;
  return `<figure style="margin:0"><figcaption>${e(unit)}</figcaption><svg class="chart" viewBox="0 0 485 202" aria-label="${e(unit+' by date')}">
    ${ticks.map(t=>`<line x1="52" x2="471" y1="${y(t)}" y2="${y(t)}" stroke="#d6dfd2"/><text x="45" y="${y(t)+4}" text-anchor="end">${format(t)}</text>`).join('')}
    ${labels.map((day,i)=>`<text x="${x(day)}" y="193" text-anchor="${i===0?'start':day===end?'end':'middle'}">${e(day)}</text>`).join('')}
    ${markerMarkup}${plotted.map((line,i)=>line.points.map(p=>`<circle role="button" tabindex="0" aria-label="${e(reveal(line,p))}" data-point="${e(reveal(line,p))}" cx="${x(p.day)}" cy="${y(p.value)}" r="5" fill="${colors[i%colors.length]}"><title>${e(reveal(line,p))}</title></circle>`).join('')).join('')}</svg>
    <p>${plotted.map((line,i)=>`<span style="color:${colors[i%colors.length]}">●</span> ${e(line.label)} (n=${line.points.length})`).join(' &nbsp; ')}</p><p class="muted point-detail" aria-live="polite">Tap or focus a point for its value.</p>
    ${markers.length?'<p>Stage activations · '+markers.map(m=>e(m.day+' '+m.label)).join(' · ')+'</p>':''}
    <details><summary>Chart values</summary>${table(['Date','Measure',unit,'Details'],plotted.flatMap(line=>line.points.map(p=>[p.day,line.label,format(p.value),p.detail])))}</details></figure>`;
}
function revealPoint(event) {
  const target = event.target.closest('[data-point]');
  if (target) target.closest('figure').querySelector('.point-detail').textContent = target.dataset.point;
}
if (typeof document!=='undefined') {
  for (const event of ['click','focusin']) document.addEventListener(event,revealPoint);
  document.addEventListener('keydown',event=>{
    if (event.target.matches('[data-point]') && ['Enter',' '].includes(event.key)) {
      event.preventDefault();
      revealPoint(event);
    }
  });
}
const select = (id,options,value,label) => `<label>${label}<select id="trend-${id}">${options.map(option=>`<option ${option===value?'selected':''}>${e(option)}</option>`).join('')}</select></label>`;
const card = (title,body) => `<section class="card"><h2>${title}</h2>${body}</section>`;
export function subsequentSymptoms(activities,checks) {
  const exposures = group(activities,r=>r.day);
  const daily = new Map(checks.map(r=>[r.day,r]));
  return Object.entries(exposures).flatMap(([day,events])=>{
    const next = daily.get(shiftDay(day,1));
    return next?[{day,events:events.length,pain:next.pain,instability:next.instability,sciatica:next.sciatica}]:[];
  }).sort((a,b)=>a.day.localeCompare(b.day));
}
export function renderTrends(records) {
  const now = dateKey();
  const starts = {'7 days':shiftDay(now,-6),'30 days':shiftDay(now,-29),'90 days':shiftDay(now,-89),'6 months':shiftMonth(now,-6),'12 months':shiftMonth(now,-12),'All time':records.map(r=>r.day).sort()[0]||now};
  const {range,bucket,from,to,category,exercise} = trendState;
  const start = range==='Custom'?(from||starts['30 days']):starts[range];
  const end = range==='Custom'?(to||now):range==='All time'?(records.map(r=>r.day).sort().at(-1)>now?records.map(r=>r.day).sort().at(-1):now):now;
  const filters = `<h1>Recovery trends</h1><div class="fields">${select('range',[...Object.keys(starts),'Custom'],range,'Date range')}${select('bucket',['Week','Month'],bucket,'Group by')}${range==='Custom'?`<label>From<input id="trend-from" type="date" value="${e(from)}"></label><label>Through<input id="trend-to" type="date" value="${e(to)}"></label>`:''}</div>`;
  if (start>end) return filters+'<p>Choose an end date on or after the start date.</p>';
  const rows = records.filter(r=>r.day>=start && r.day<=end);
  const get = type=>rows.filter(r=>r.type===type).sort((a,b)=>a.day.localeCompare(b.day));
  const checks = get('check'), flares = get('flare'), activities = get('activity'), sessions = get('session');
  const allFlares = records.filter(r=>r.type==='flare');
  const markers = get('activation').map(r=>({day:r.day,label:records.find(stage=>stage.id===r.stageId)?.name||'Routine stage'}));
  const groups = group(rows,r=>period(r.day,bucket.toLowerCase()));
  const exerciseNames = [...new Set(sessions.flatMap(r=>r.exercises.map(ex=>ex.name)))].sort();
  const selectedExercise = exerciseNames.includes(exercise)?exercise:exerciseNames[0];
  const exerciseLogs = sessions.flatMap(r=>r.exercises.filter(ex=>ex.name===selectedExercise).map(ex=>({...ex,day:r.day})));
  const totals = Object.entries(groups).sort(([a],[b])=>a.localeCompare(b)).map(([key,entries])=>{
    const c=entries.filter(r=>r.type==='check'), f=entries.filter(r=>r.type==='flare'), a=entries.filter(r=>r.type==='activity');
    const measured=a.filter(r=>Number.isFinite(r.duration));
    const s=entries.filter(r=>r.type==='session');
    return [key,c.length,format(average(c.map(r=>r.pain))),format(average(c.map(r=>r.instability))),format(average(c.map(r=>r.sciatica))),f.length,recordedFlareFree(c,allFlares),a.length,measured.length?format(measured.reduce((sum,r)=>sum+r.duration,0)):null,measured.length,s.length,new Set([...s.map(r=>r.day),...c.filter(r=>r.exercised==='Yes').map(r=>r.day)]).size];
  });
  const periodDay = key => {
    const day = bucket==='Month'?key+'-01':key;
    return day<start?start:day;
  };
  const averageSeries = ['Pain','Instability','Leg symptoms'].map((label,i)=>({
    label,points:totals.map(row=>point(periodDay(row[0]),typeof row[2+i]==='number'?row[2+i]:null,row[1]+' check-ins · '+row[0]))
  }));
  const flareCounts = totals.filter(row=>row[1] || row[5]).map(row=>point(periodDay(row[0]),row[5],row[1]+' check-ins · '+row[0]));
  const act = category==='All activities'?activities:activities.filter(r=>r.category===category);
  const actSeries = Object.entries(group(act,r=>r.category)).map(([label,list])=>({label,points:Object.entries(group(list,r=>r.day)).map(([day,events])=>point(day,events.length))}));
  const durationSeries = actSeries.map(line=>({label:line.label,points:Object.entries(group(act.filter(r=>r.category===line.label && Number.isFinite(r.duration)),r=>r.day)).map(([day,events])=>point(day,events.reduce((sum,r)=>sum+r.duration,0),events.length+' measured activities'))}));
  const flareGap = [...allFlares].sort((a,b)=>a.start.localeCompare(b.start)).flatMap((r,i,list)=>i&&r.day>=start&&r.day<=end?[point(r.day,daysBetween(list[i-1].day,r.day))]:[]);
  const triggers = Object.entries(group(flares.filter(r=>r.trigger?.trim()),r=>r.trigger.trim().toLowerCase())).sort((a,b)=>b[1].length-a[1].length);
  const paired = sessions.filter(r=>Number.isFinite(r.before)&&Number.isFinite(r.after));
  const exposure = subsequentSymptoms(act,checks);
  const reports = checks.filter(r=>r.flare==='Yes').length;
  return filters
    + card('Symptoms',chart(symptomSeries(checks),start,end,'Score / 10',10,markers)+chart(averageSeries,start,end,bucket+' mean score / 10',10))
    + card('Period summary',`<p>Counts use journal entries. Activity minutes include entries with a duration. Flare starts come from the flare log. Daily check-ins reporting a flare in this range: ${reports}.</p>${totals.length?table(['Period','Check-ins','Mean pain','Mean instability','Mean leg symptoms','Flare starts','Confirmed flare-free days','Activities','Activity min','Timed activities','Sessions','Exercise days'],totals):'<p>No entries in this range.</p>'}`)
    + card('Flare-ups',`<p>${flares.length} recorded starts · ${flares.filter(r=>!r.end).length} still ongoing · ${recordedFlareFree(checks,allFlares)} confirmed flare-free days of ${checks.length} check-ins. Confirmation requires a check-in reporting no flare and no overlapping logged flare.</p>`+chart([{label:'Recorded starts',points:flareCounts}],start,end,'Flare starts per '+bucket.toLowerCase())+chart([{label:'Pain',points:flares.map(r=>point(r.day,r.pain))},{label:'Instability',points:flares.map(r=>point(r.day,r.instability))}],start,end,'Severity / 10',10)+chart([{label:'Resolved flares',points:flares.filter(r=>r.end).map(r=>point(r.day,minutes(r.start,r.end)/60))}],start,end,'Duration (h)')+chart([{label:'Time since previous start',points:flareGap}],start,end,'Calendar days'))
    + card('Activity and sitting',select('category',['All activities',...categories],category,'Activity category')+chart(actSeries,start,end,'Logged activities per day')+chart(durationSeries,start,end,'Activity minutes per day')+chart([{label:'Comfortable sitting',points:checks.map(r=>point(r.day,r.sitting))}],start,end,'Sitting (min)')+chart([{label:'Rehabilitation sessions',points:Object.entries(group(sessions,r=>r.day)).map(([day,list])=>point(day,list.length))}],start,end,'Sessions per day'))
    + card('Exercise progression',exerciseNames.length?select('exercise',exerciseNames,selectedExercise,'Exercise')+[['weight','Weight (kg)'],['reps','Reps'],['duration','Duration (min)']].map(([key,label])=>chart([{label:selectedExercise,points:exerciseLogs.map(r=>point(r.day,r[key]))}],start,end,label,undefined,markers)).join(''):'<p>Log exercise sessions to chart your actual training.</p>')
    + card('Patterns',`<p>These comparisons describe recorded observations. Check-in coverage, activity choices and other factors may affect the results.</p><h3>Activity exposure and next-day symptoms</h3><p>${exposure.length} activity days with a next-day check-in in this range.</p>${exposure.length?table(['Activity date','Activities','Next-day pain','Next-day instability','Next-day leg symptoms'],exposure.map(r=>[r.day,r.events,r.pain,r.instability,r.sciatica])):''}<h3>Reported suspected triggers</h3>${triggers.length?table(['Trigger','Reports'],triggers.map(([name,items])=>[name,items.length])):'<p>No suspected triggers recorded.</p>'}<h3>Pain before and after exercise</h3><p>${paired.length} sessions with both scores · Mean change ${format(average(paired.map(r=>r.after-r.before)))}</p>${chart([{label:'After minus before',points:paired.map(r=>point(r.day,r.after-r.before))}],start,end,'Change in pain score')}<h3>Recorded activity and flare starts</h3><p>Compare activity, flare starts and check-in coverage by period in the period summary.</p>`);
}
