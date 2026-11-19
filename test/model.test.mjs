import test from 'node:test';
import assert from 'node:assert/strict';
import {activate,activation,currentStage,parseBackup,csv,average,period,shiftMonth,recordedFlareFree} from '../site/model.mjs';
import {subsequentSymptoms,symptomSeries,chart} from '../site/trends.mjs';

const check = {type:'check',id:'check:2025-01-03',day:'2025-01-03',pain:0,flare:'No'};
test('backup round trips and migrates dated check-ins',()=>{
  assert.deepEqual(parseBackup(JSON.stringify({version:2,records:[check]})),[check]);
  assert.deepEqual(parseBackup(JSON.stringify({version:1,records:[{...check,id:'old'}]})),[check]);
  assert.throws(()=>parseBackup(JSON.stringify({version:3,records:[check]})));
  assert.throws(()=>parseBackup(JSON.stringify({version:2,records:[check,check]})));
});
test('routine restoration preserves previous and later stage snapshots',()=>{
  const draft = {type:'draft',id:'draft',name:'Stage one',exercises:[{name:'Example',reps:5}]};
  const first = activate(draft,'one','2025-01-01T10:00:00');
  const second = activate({...draft,name:'Stage two',exercises:[{name:'Example',reps:8}]},'two','2025-02-01T10:00:00');
  const records = [...first,...second];
  assert.equal(currentStage(records).id,'two');
  records.push(activation(first[0],'2025-03-01T10:00:00'));
  assert.equal(currentStage(records).exercises[0].reps,5);
  assert.equal(records.find(r=>r.id==='two').exercises[0].reps,8);
  assert.equal(parseBackup(JSON.stringify({version:2,records})).length,5);
});
test('analytics preserves zeroes, excludes missing measurements and uses calendar dates',()=>{
  assert.equal(average([0,3,null]),1.5);
  assert.equal(average([null]),null);
  assert.equal(period('2025-01-05','week'),'2024-12-30');
  assert.equal(shiftMonth('2025-03-31',-1),'2025-02-28');
  assert.deepEqual(subsequentSymptoms([{day:'2025-01-02'},{day:'2025-01-03'}],[check]).map(r=>[r.day,r.pain]),[['2025-01-02',0]]);
  assert.match(chart(symptomSeries([check]),check.day,check.day,'Score / 10',10),/Pain \(n=1\).*Instability \(n=0\)/s);
  assert.equal(recordedFlareFree([check],[]),1);
  assert.equal(recordedFlareFree([check],[{day:'2025-01-02'}]),0);
});
test('CSV quotes text and neutralises spreadsheet formulas',()=>{
  const result = csv([{...check,notes:'=1+"2"'}]);
  assert.ok(result.includes('"\'=1+""2"""'));
});
