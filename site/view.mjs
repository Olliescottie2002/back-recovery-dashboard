export const escape = value => String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
export const button = (label,action,id='',quiet=false) => `<button type="button" data-action="${escape(action)}" data-id="${escape(id)}" ${quiet?'class="quiet"':''}>${escape(label)}</button>`;
export const table = (headers,rows) => `<div class="table"><table><thead><tr>${headers.map(h=>'<th scope="col">'+escape(h)+'</th>').join('')}</tr></thead><tbody>${rows.map(row=>'<tr>'+row.map(cell=>'<td>'+escape(cell??'—')+'</td>').join('')+'</tr>').join('')}</tbody></table></div>`;
export const typeNames = {check:'Daily check-in',activity:'Activity',flare:'Flare-up',session:'Exercise session'};
export function describe(record) {
  const r=record;
  const response = [r.before!=null?'Pain before '+r.before+'/10':'',r.after!=null?'Pain after '+r.after+'/10':'',r.response].filter(Boolean).join(' · ');
  switch(r.type) {
    case 'check': return `Pain ${r.pain}/10 · Instability ${r.instability}/10 · Leg symptoms ${r.sciatica}/10 · Activity ${r.level} · Sitting ${r.sitting==null?'—':r.sitting+' min'} · Exercised ${r.exercised} · Flare-up ${r.flare}`;
    case 'activity': return [r.category,r.duration!=null?r.duration+' min':'',r.quantity!=null?`${r.quantity} ${r.unit||''}`:'',response].filter(Boolean).join(' · ');
    case 'flare': return [r.start.replace('T',' '),r.end?'Resolved '+r.end.replace('T',' '):'Ongoing',`Pain ${r.pain}/10 · Instability ${r.instability}/10`,r.trigger?'Suspected trigger: '+r.trigger:'',r.impact,r.recovery!=null?`${r.recovery} h recovery`:''].filter(Boolean).join(' · ');
    case 'session': return [r.exercises.map(ex=>[ex.name,ex.sets!=null?`${ex.sets} sets`:'',ex.reps!=null?`${ex.reps} reps`:'',ex.duration!=null?`${ex.duration} min`:'',ex.weight!=null?`${ex.weight} kg`:'',ex.resistance,ex.notes].filter(Boolean).join(' ')).join(', '),r.difficulty!=null?`Difficulty ${r.difficulty}/10`:'',response].filter(Boolean).join(' · ');
    default: return '';
  }
}
