export const categories = ['Walking','Sitting / commuting','Gym / rehabilitation','Standing','Bending / lifting','Swimming','Sex / repetitive pelvic movement','General daily activity','Other'];
export const types = ['check','activity','flare','session','stage','draft','activation'];
export const dateKey = (date = new Date()) => [date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
export const shiftDay = (day, days) => {
  const date = new Date(day+'T12:00:00');
  date.setDate(date.getDate()+days);
  return dateKey(date);
};
export const shiftMonth = (day, months) => {
  const date = new Date(day+'T12:00:00');
  const previous = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth()+months);
  date.setDate(Math.min(previous, new Date(date.getFullYear(),date.getMonth()+1,0).getDate()));
  return dateKey(date);
};
export const minutes = (start,end) => (new Date(end)-new Date(start))/60000;
export const daysBetween = (start,end) => (Date.parse(end.slice(0,10))-Date.parse(start.slice(0,10)))/86400000;
export const average = values => {
  const measured = values.filter(Number.isFinite);
  return measured.length ? measured.reduce((a,b)=>a+b,0)/measured.length : null;
};
export const group = (records, key) => records.reduce((groups,record)=>{ (groups[key(record)] ??= []).push(record); return groups; },Object.create(null));
export const period = (day, mode) => mode==='month' ? day.slice(0,7) : shiftDay(day,-((new Date(day+'T12:00:00').getDay()+6)%7));
export function recordedFlareFree(checks, flares) {
  return checks.filter(check => check.flare === 'No' && !flares.some(flare => flare.day <= check.day && (!flare.end || flare.end.slice(0,10) >= check.day))).length;
}
export function activate(draft, id, timestamp) {
  const stage = {...draft,type:'stage',id,day:timestamp.slice(0,10)};
  return [stage, activation(stage, timestamp)];
}
export function activation(stage, timestamp, id = stage.id+'@'+timestamp) {
  return {type:'activation',id,stageId:stage.id,day:timestamp.slice(0,10),timestamp};
}
export const currentStage = records => {
  const latest = records.filter(r=>r.type==='activation').sort((a,b)=>b.timestamp.localeCompare(a.timestamp))[0];
  return records.find(r=>r.type==='stage' && r.id===latest?.stageId);
};
const numberFields = {
  check:['pain','instability','sciatica','sitting'], activity:['duration','quantity','before','after'],
  flare:['pain','instability','recovery'], session:['before','after','difficulty']
};
const validDay = day => typeof day==='string' && /^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(Date.parse(day)) && new Date(day).toISOString().slice(0,10)===day;
function validRecord(record) {
  if (!record || !types.includes(record.type) || typeof record.id!=='string' || !record.id || !validDay(record.day)) return false;
  if (record.type==='check' && record.id!=='check:'+record.day) return false;
  if (record.type==='draft' && record.id!=='draft') return false;
  if (record.type==='activation' && (typeof record.stageId!=='string' || !Number.isFinite(Date.parse(record.timestamp)))) return false;
  if (record.type==='activity' && !categories.includes(record.category)) return false;
  if (record.type==='flare' && (!Number.isFinite(Date.parse(record.start)) || record.start.slice(0,10)!==record.day || (record.end && !(minutes(record.start,record.end)>=0)))) return false;
  if (!((numberFields[record.type]||[]).every(key=>record[key]==null || (Number.isFinite(record[key]) && record[key]>=0 && (!['pain','instability','sciatica','before','after','difficulty'].includes(key) || record[key]<=10))))) return false;
  if (['stage','draft','session'].includes(record.type)) {
    if (!Array.isArray(record.exercises) || !record.exercises.length || !record.exercises.every(ex=>ex && typeof ex.name==='string' && ex.name.trim() && ['sets','reps','duration','weight'].every(key=>ex[key]==null || (Number.isFinite(ex[key]) && ex[key]>=0)))) return false;
  }
  return true;
}
export function parseBackup(text) {
  const backup = JSON.parse(text);
  if (!backup || ![1,2].includes(backup.version) || !Array.isArray(backup.records)) throw Error('Unsupported backup format.');
  const records = backup.records.map(record => backup.version===1 && record?.type==='check' ? {...record,id:'check:'+record.day} : record);
  if (!records.every(validRecord) || new Set(records.map(r=>r.id)).size!==records.length) throw Error('The backup contains invalid or duplicate records.');
  const stages = new Set(records.filter(r=>r.type==='stage').map(r=>r.id));
  if (records.some(r=>r.type==='activation' && !stages.has(r.stageId))) throw Error('The backup is missing a routine stage.');
  return records;
}
export function csv(records) {
  const keys = ['type','id','day',...new Set(records.flatMap(Object.keys).filter(k=>!['type','id','day'].includes(k)))];
  const cell = value => {
    const raw = value==null ? '' : typeof value==='object' ? JSON.stringify(value) : String(value);
    const safe = typeof value==='string' && /^[\s]*[=+@-]|^[\t\r\n]/.test(raw) ? "'"+raw : raw;
    return '"'+safe.replaceAll('"','""')+'"';
  };
  return [keys,...records.map(record=>keys.map(key=>record[key]))].map(row=>row.map(cell).join(',')).join('\r\n');
}
