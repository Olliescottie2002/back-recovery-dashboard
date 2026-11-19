import {openJournal} from './db.mjs';
import {categories,dateKey,shiftDay,currentStage,activate,activation,parseBackup,csv,minutes} from './model.mjs';
import {renderTrends, trendState, chart, symptomSeries} from './trends.mjs';
import {escape as e, button, table, describe, typeNames} from './view.mjs';

const main = document.querySelector('main');
const dialog = document.querySelector('dialog');
const status = document.querySelector('#status');
let journal, records = [], statusTimer;
function notify(text) {
  status.textContent = text;
  clearTimeout(statusTimer);
  statusTimer = setTimeout(()=>status.textContent='',5500);
}
const today = () => dateKey();
const localTime = () => {
  const now = new Date();
  return today()+'T'+now.toTimeString().slice(0,8);
};
const byType = type => records.filter(record=>record.type===type);
const newest = list => [...list].sort((a,b)=>(b.start||b.day).localeCompare(a.start||a.day));
const quick = () => '<div class="row">'+Object.entries({check:'Daily check-in',activity:'Log activity',flare:'Log flare-up',session:'Log exercise'}).map(([type,label])=>button(label,'new',type)).join('')+'</div>';
const checkSummary = days => {
  const start = shiftDay(today(),1-days);
  const within = record => record.day>=start && record.day<=today();
  const checks = byType('check').filter(within);
  const sessions = byType('session').filter(within);
  const exerciseDays = new Set([...sessions.map(r=>r.day),...checks.filter(r=>r.exercised==='Yes').map(r=>r.day)]);
  return `<div class="card"><h2>Last ${days} days</h2><div class="metric">${checks.length} / ${days}</div><small>Daily check-ins</small><p>${exerciseDays.size} recorded exercise days · ${sessions.length} logged sessions<br>${byType('flare').filter(within).length} logged flare starts</p></div>`;
};
function home() {
  const check = newest(byType('check'))[0];
  const stage = currentStage(records);
  const start = shiftDay(today(),-6);
  return `<h1>Recovery overview</h1><section class="card hero"><h2>${e(new Date().toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'}))}</h2><p>${byType('check').some(r=>r.day===today())?'Today’s check-in is saved.':'Today’s check-in is due.'}</p>${quick()}</section>
  <div class="grid"><div class="card"><h2>Latest pain</h2><span class="metric">${check?.pain==null?'—':e(check.pain)+' / 10'}</span><small>${check?e(check.day):'Save a check-in to see your score'}</small></div>
  <div class="card"><h2>Current routine</h2><span class="metric">${e(stage?.name||'No active stage')}</span><a href="#routine">Open exercises</a></div></div>
  <div class="grid">${checkSummary(7)}${checkSummary(30)}</div>
  <section class="card"><h2>Symptoms over the last 7 days</h2>${chart(symptomSeries(byType('check').filter(r=>r.day>=start&&r.day<=today())),start,today(),'Score / 10',10)}<a href="#trends">Explore trends</a></section>`;
}
function log() {
  const entries = newest(records.filter(r=>['check','activity','flare','session'].includes(r.type)));
  const filtered = entries.filter(r=>(!logFilter || r.type===logFilter) && (!logMonth || r.day.startsWith(logMonth)));
  return `<h1>Journal</h1>${quick()}<div class="fields"><label>Record type<select id="log-type"><option value="">All records</option>${Object.entries(typeNames).filter(([key])=>['check','activity','flare','session'].includes(key)).map(([key,label])=>`<option value="${key}" ${key===logFilter?'selected':''}>${label}</option>`).join('')}</select></label><label>Month<input type="month" id="log-month" value="${e(logMonth)}"></label></div>${filtered.map(r=>`<article class="card"><h2>${e(typeNames[r.type])} · ${e(r.day)}</h2><p>${e(describe(r))}</p>${r.notes?`<p>${e(r.notes)}</p>`:''}<div class="row">${button(r.type==='flare'&&!r.end?'Edit / resolve':'Edit','edit',r.id,true)}${button('Delete','delete',r.id,true)}</div></article>`).join('')||'<p>No records match these filters.</p>'}`;
}
let logFilter='', logMonth='';
function routine() {
  const current = currentStage(records);
  const draft = records.find(r=>r.type==='draft');
  const history = [...byType('activation')].sort((a,b)=>b.timestamp.localeCompare(a.timestamp));
  const exerciseTable = stage => table(['Exercise','Sets','Reps','Minutes','kg','Resistance / notes'],stage.exercises.map(r=>[r.name,r.sets,r.reps,r.duration,r.weight,[r.resistance,r.notes].filter(Boolean).join(' · ')]));
  return `<h1>Exercises</h1><section class="card"><h2>Current exercises</h2>${current?`<h3>${e(current.name)}</h3>${exerciseTable(current)}${button('Log session','new','session')}`:'<p>Create and activate a routine with the exercises you already perform.</p>'}</section>
  <section class="card"><h2>Exercise progressions</h2><div class="row">${button(draft?'Edit draft':current?'Copy current routine to draft':'Create routine draft','draft')}${draft?button('Activate draft','activate'):''}</div>${draft?`<h3>${e(draft.name)}</h3><p>${e(draft.goal||'')} ${e(draft.criteria||'')}</p>${exerciseTable(draft)}`:''}</section>
  <section class="card"><h2>Progression history</h2>${history.map(event=>{
    const stage = records.find(r=>r.id===event.stageId);
    if (!stage) return '';
    return `<details><summary>${e(event.timestamp.slice(0,16).replace('T',' '))} · ${e(stage.name)}</summary><p>${e(stage.goal||'')} ${e(stage.criteria||'')}</p>${exerciseTable(stage)}${stage.id!==current?.id?`<h3>Current · ${e(current?.name||'')}</h3>${current?exerciseTable(current):''}${button('Restore this stage','restore',stage.id,true)}`:''}</details>`;
  }).join('')||'<p>Activated stages will appear here.</p>'}</section>`;
}
function render() {
  const route = location.hash.slice(1);
  const page = ['log','routine','trends'].includes(route)?route:'home';
  main.innerHTML = {home,log,routine,trends:()=>renderTrends(records)}[page]();
  document.querySelectorAll('nav a').forEach(a=>{
    if (a.hash==='#'+page) a.setAttribute('aria-current','page');
    else a.removeAttribute('aria-current');
  });
}
async function refresh() { records = await journal.all(); render(); }
async function commit(add,remove,merge) { await journal.write(add,remove,merge); await refresh(); }
function show(title, content, save) {
  dialog.innerHTML = `<form><h2>${title}</h2>${content}<p class="error" role="alert"></p><div class="row">${save?'<button type="submit">Save</button>':''}${button(save?'Cancel':'Close','close','',true)}</div></form>`;
  if (!dialog.open) dialog.showModal();
  const form = dialog.querySelector('form');
  form.onsubmit = async event=>{
    event.preventDefault();
    if (!save) return;
    const submit = form.querySelector('[type=submit]');
    submit.disabled = true;
    try {
      await save(new FormData(form));
      dialog.close();
      notify('Saved on this device.');
    } catch (error) {
      form.querySelector('.error').textContent = error.message || 'The record could not be saved.';
    } finally { submit.disabled = false; }
  };
}
const input = (label,key,value='',type='text',extra='') => `<label>${label}<input name="${key}" type="${type}" value="${e(value??'')}" ${extra}></label>`;
const area = (label,key,value) => `<label class="wide">${label}<textarea name="${key}" rows="2">${e(value??'')}</textarea></label>`;
const select = (label,key,options,value) => `<label>${label}<select name="${key}">${options.map(option=>`<option ${option===value?'selected':''}>${e(option)}</option>`).join('')}</select></label>`;
const score = (label,key,value,required=false) => input(label+' (0–10)',key,value,'number',`min="0" max="10" ${required?'required':''}`);
const nonnegative = (label,key,value) => input(label,key,value,'number','min="0" step="any"');
const exerciseFields = (exercise={}) => `<fieldset><legend>Exercise</legend><div class="fields">${input('Name','exercise',exercise.name,'text','required')}${nonnegative('Sets','sets',exercise.sets)}${nonnegative('Reps','reps',exercise.reps)}${nonnegative('Duration (min)','ex-duration',exercise.duration)}${nonnegative('Weight (kg)','weight',exercise.weight)}${input('Resistance','resistance',exercise.resistance)}${area('Exercise notes','exercise-notes',exercise.notes)}</div>${button('Remove exercise','remove-exercise','',true)}</fieldset>`;
const exerciseList = exercises=>`<div id="exercises">${(exercises?.length?exercises:[{}]).map(exerciseFields).join('')}</div><div class="row">${button('Add exercise','add-exercise','',true)}</div>`;
const number = value => value==null||value===''?null:Number(value);
function exercisesFrom(form) {
  const exercises = form.getAll('exercise').map((name,i)=>({
    name:name.trim(), sets:number(form.getAll('sets')[i]), reps:number(form.getAll('reps')[i]),
    duration:number(form.getAll('ex-duration')[i]),weight:number(form.getAll('weight')[i]),
    resistance:form.getAll('resistance')[i],notes:form.getAll('exercise-notes')[i]
  }));
  if (!exercises.length || exercises.some(ex=>!ex.name)) throw Error('Enter at least one named exercise.');
  return exercises;
}
function editRecord(type, old) {
  const r = old || (type==='check'?records.find(item=>item.id==='check:'+today()):null) || {};
  const date = input('Date','day',r.day||today(),'date','required');
  const symptoms = score('Pain','pain',r.pain,true)+score('Instability / weakness','instability',r.instability,true);
  const response = score('Pain before','before',r.before)+score('Pain after','after',r.after);
  const stage = currentStage(records);
  const yesNo = ['Unknown','Yes','No'];
  const fields = {
    check:date+symptoms+score('Leg symptoms','sciatica',r.sciatica,true)+select('Activity level','level',['Unknown','Low','Moderate','High'],r.level)+nonnegative('Comfortable sitting (min)','sitting',r.sitting)+select('Exercised','exercised',yesNo,r.exercised)+select('Flare-up today','flare',yesNo,r.flare),
    activity:date+select('Category','category',categories,r.category)+nonnegative('Duration (min)','duration',r.duration)+nonnegative('Quantity','quantity',r.quantity)+input('Quantity unit','unit',r.unit)+response+input('Symptom response','response',r.response),
    flare:input('Started','start',r.start||localTime().slice(0,16),'datetime-local','required')+input('Resolved at (optional)','end',r.end,'datetime-local')+symptoms+input('Suspected trigger','trigger',r.trigger)+input('Impact on daily activities','impact',r.impact)+nonnegative('Recovery time (hours)','recovery',r.recovery),
    session:date+score('Difficulty','difficulty',r.difficulty)+response+input('Symptom response','response',r.response)
  };
  show(typeNames[type],`<div class="fields">${fields[type]}${area('Notes','notes',r.notes)}</div>${type==='session'?exerciseList(r.exercises||stage?.exercises):''}`,async form=>{
    const record = {...r,type};
    for (const [key,value] of form) {
      if (['exercise','sets','reps','weight','ex-duration','resistance','exercise-notes'].includes(key)) continue;
      record[key] = ['pain','instability','sciatica','sitting','duration','quantity','before','after','recovery','difficulty'].includes(key)?number(value):value.trim();
    }
    if (type==='flare') {
      record.day = record.start.slice(0,10);
      if (record.end && minutes(record.start,record.end)<0) throw Error('Resolution must be after the start.');
    }
    if (type==='session') {
      record.exercises = exercisesFrom(form);
      record.stageId = old ? old.stageId : stage?.id;
    }
    record.id = type==='check'?'check:'+record.day:r.id||crypto.randomUUID();
    if (type==='check' && r.id!==record.id && (await journal.all()).some(item=>item.id===record.id)) throw Error('A check-in already exists for this date. Edit it from the journal.');
    await commit([record],r.id&&r.id!==record.id?[r.id]:[]);
  });
}
function editDraft() {
  const draft = records.find(r=>r.type==='draft');
  const previous = draft||currentStage(records);
  show('Routine draft',`<div class="fields">${input('Stage name','name',draft?.name||'','text','required')}${area('Goal','goal',draft?.goal)}${area('Criteria','criteria',draft?.criteria)}</div>${exerciseList(previous?.exercises)}`,async form=>{
    const name = form.get('name').trim();
    if (!name) throw Error('Enter a stage name.');
    await commit([{id:'draft',type:'draft',day:today(),name,goal:form.get('goal'),criteria:form.get('criteria'),exercises:exercisesFrom(form)}]);
  });
}
function download(name, data, type) {
  const url = URL.createObjectURL(new Blob([data],{type}));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(()=>URL.revokeObjectURL(url),60000);
}
function backups() {
  show('Backups and privacy',`<p>Records stay in this browser’s storage. Clearing website data, changing devices, or losing this device can remove access. Safari and the installed app may use separate storage. Export regularly and keep backup files private.</p><div class="row">${button('Export JSON','json')}${button('Export CSV','csv', '',true)}</div><label>Import JSON (adds records and keeps existing entries with matching IDs)<input type="file" id="import" accept=".json,application/json"></label><p role="status" id="backup-status"></p>`);
}
async function action(op,id,target) {
  const record = records.find(r=>r.id===id);
  switch (op) {
    case 'new': editRecord(id); break;
    case 'edit': if (record) editRecord(record.type,record); break;
    case 'delete':
      if (record && confirm('Delete this journal entry?')) { await commit([], [id]); notify('Entry deleted.'); }
      break;
    case 'close': dialog.close(); break;
    case 'draft': editDraft(); break;
    case 'activate': {
      const draft = records.find(r=>r.type==='draft');
      if (draft && confirm('Activate this routine and keep earlier stages in history?')) {
        await commit(activate(draft,crypto.randomUUID(),localTime()+'.'+String(new Date().getMilliseconds()).padStart(3,'0')),['draft']);
        notify('Routine activated.');
      }
      break;
    }
    case 'restore':
      if (record?.type==='stage' && confirm('Restore this routine as the current stage?')) {
        await commit([activation(record,localTime()+'.'+String(new Date().getMilliseconds()).padStart(3,'0'),crypto.randomUUID())]);
        notify('Routine restored.');
      }
      break;
    case 'add-exercise': dialog.querySelector('#exercises').insertAdjacentHTML('beforeend',exerciseFields()); break;
    case 'remove-exercise': target.closest('fieldset').remove(); break;
    case 'json': download('recovery-'+today()+'.json',JSON.stringify({version:2,records},null,2),'application/json'); break;
    case 'csv': download('recovery-'+today()+'.csv',csv(records),'text/csv'); break;
  }
}
try {
  journal = await openJournal();
  await refresh();
  window.addEventListener('hashchange',render);
  window.addEventListener('focus',()=>refresh().catch(error=>notify(error.message)));
  document.querySelector('#backup').onclick = backups;
  document.addEventListener('click', event=>{
    const control = event.target.closest('button[data-action]');
    if (control) action(control.dataset.action,control.dataset.id,control).catch(error=>notify(error.message));
  });
  document.addEventListener('change',async event=>{
    const {id,value,files} = event.target;
    if (id==='import' && files?.length) {
      const result = dialog.querySelector('#backup-status');
      try {
        const additions = parseBackup(await files[0].text());
        const total = records.length;
        await commit(additions,[],true);
        result.textContent = `Added ${records.length-total} records. Matching records were kept.`;
      } catch (error) { result.textContent = error.message; }
      event.target.value = '';
    }
    if (id==='log-type') { logFilter=value; render(); }
    if (id==='log-month') { logMonth=value; render(); }
    if (id.startsWith('trend-')) { trendState[id.slice(6)] = value; render(); document.getElementById(id)?.focus(); }
  });
  navigator.serviceWorker?.register('./sw.js').catch(()=>notify('Offline setup is unavailable in this browser.'));
} catch (error) {
  main.innerHTML = '<h1>Journal storage unavailable</h1><p>'+e(error.message)+'</p>';
}
