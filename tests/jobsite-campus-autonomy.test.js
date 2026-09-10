const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../web/assets/js/jobsite-campus.js'),legacy=require('./fixtures/jobsite-campus-v1.json');
function fresh(id='stratos') { const s=C.create(id);for(const group of ['crews','equipment'])for(const k of Object.keys(s[group]))s[group][k]=0;return s; }
function until(s,condition,step=.05){for(let i=0;i<4000&&!condition(s);i++)C.advanceProject(s,step);assert.ok(condition(s),JSON.stringify(C.allocation(s).reasons));}
for(const site of C.SITES)test(site.id+' reaches handover with one Start and no management actions',()=>{
 const s=fresh(site.id);C.startProject(s);until(s,s=>s.complete,.1);
 assert.ok(s.day<100);assert.equal(s.running,false);assert.equal(C.progress(s),1);
 for(const t of C.plan(s)){
  const v=s.tasks[t.id];assert.ok(v.accepted,t.id);
  for(const dep of t.deps)assert.ok(s.tasks[dep].finish<=v.start+1e-6,t.id+' started before '+dep);
  if(t.elapsed)assert.ok(v.finish-v.start>=t.days-1e-6,t.id+' skipped its wait');
  if(t.gate)assert.ok(v.finish-v.start>=t.days-1e-6,t.id+' skipped inspection work');
 }
 for(const [key,o] of Object.entries(s.orders)){assert.ok(o.ordered);assert.equal(o.used,C.MATERIALS[key].quantity);}
 for(const group of ['crews','equipment'])assert.ok(Object.values(s[group]).every(n=>n===0));
 assert.ok(C.decode(JSON.stringify(s)));const done=JSON.stringify(s);C.advanceProject(s,5);C.startProject(s);assert.equal(JSON.stringify(s),done);
});
test('the clock and automatic staffing respect Pause and invalid elapsed time',()=>{
 const s=fresh(),before=JSON.stringify(s);C.supervise(s);C.advanceProject(s,5);assert.equal(JSON.stringify(s),before);
 C.startProject(s);C.advanceProject(s,4);s.running=false;const paused=JSON.stringify(s);C.supervise(s);C.advanceProject(s,5);assert.equal(JSON.stringify(s),paused);
 C.startProject(s);const running=JSON.stringify(s);for(const dt of [NaN,Infinity,-1,0])C.advanceProject(s,dt);assert.equal(JSON.stringify(s),running);
});
test('staffing mobilizes only approaching trades and releases idle capacity',()=>{
 const s=fresh();C.startProject(s);assert.ok(s.crews.survey>0);assert.equal(s.crews.steel,0);assert.equal(s.crews.electrical,0);assert.equal(s.equipment.crane,0);
 const cost=s.spent;for(let i=0;i<20;i++)C.supervise(s);assert.equal(s.spent,cost,'repeated supervision must not recharge crews or materials');
 until(s,s=>s.tasks['a-frame'].progress>.1);assert.ok(s.crews.steel>0);assert.ok(s.equipment.crane>0);
 until(s,s=>s.tasks.functional.progress>0);for(const key of ['earth','civil','concrete','steel'])assert.equal(s.crews[key],0,key);
});
test('old held packages and empty rosters resume, retaining work and existing purchases',()=>{
 const s=C.create('stratos');C.dispatch(s,'all',true);s.running=true;
 for(let i=0;i<500&&s.tasks.formation.progress<1;i++)C.advance(s,.1);
 assert.equal(s.tasks.formation.progress,1);assert.equal(s.tasks.formation.accepted,false);
 C.dispatch(s,'all',false);for(const group of ['crews','equipment'])for(const key of Object.keys(s[group]))s[group][key]=0;
 C.order(s,'steel');C.expedite(s,'steel');const oldOrder={...s.orders.steel},day=s.day,progress=s.tasks.grade.progress;
 s.running=false;const restored=C.decode(JSON.stringify(s));assert.ok(restored);C.startProject(restored);
 assert.equal(restored.tasks.formation.accepted,true);assert.equal(restored.day,day);assert.equal(restored.tasks.grade.progress,progress);assert.deepEqual(restored.orders.steel,oldOrder);
 until(restored,s=>s.complete,.1);
});
test('inspection completion releases the next stage without erasing curing or test work',()=>{
 const s=fresh();C.startProject(s);until(s,s=>C.done(s,'a-slab'));
 assert.equal(s.tasks['a-frame'].progress,0);const day=s.day;
 C.advanceProject(s,2.9);assert.equal(s.tasks['a-frame'].progress,0);assert.equal(s.tasks['a-strength'].progress,0);
 until(s,s=>C.done(s,'a-strength'));assert.ok(s.day-day>=3.5-1e-6);assert.ok(s.tasks['a-strength'].finish!==null);
 until(s,s=>s.tasks['a-frame'].progress>0);assert.ok(s.tasks['a-strength'].finish<=s.tasks['a-frame'].start);
});
test('saved staffing standby resumes without another mobilization charge',()=>{
 const s=fresh();C.startProject(s);C.advanceProject(s,18.3);const restored=C.decode(JSON.stringify(s));assert.ok(restored);
 const cost=s.spent;C.startProject(restored);assert.equal(restored.spent,cost);assert.deepEqual(restored.staffing,s.staffing);
 C.advanceProject(s,2);C.advanceProject(restored,2);assert.equal(restored.spent,s.spent);assert.deepEqual(restored.tasks,s.tasks);assert.deepEqual(restored.crews,s.crews);
 for(const field of [null,{}, {crews:{survey:[-1,null,null]},equipment:{}}])assert.equal(C.decode(JSON.stringify({...s,staffing:field})),null);
});
for(const stage of ['stopped','review','ready'])test('old '+stage+' incident resumes with timed automatic review and no second release click',()=>{
 const s=fresh();C.startProject(s);C.advanceProject(s,5);C.incident(s,'Truck','Civil crew');
 if(stage!=='stopped')C.recover(s);if(stage==='review')C.advance(s,.17);if(stage==='ready')C.advance(s,.5);
 const restored=C.decode(JSON.stringify(s)),before=JSON.stringify(restored.tasks),day=restored.day,remaining=restored.safety.remaining;
 C.startProject(restored);
 if(remaining>0){C.advanceProject(restored,remaining/2);assert.equal(JSON.stringify(restored.tasks),before);restored.running=false;const paused=JSON.stringify(restored);C.advanceProject(restored,1);assert.equal(JSON.stringify(restored),paused);C.startProject(restored);C.advanceProject(restored,remaining/2);}
 assert.equal(restored.safety.stage,null);assert.equal(restored.running,true);assert.equal(restored.safety.incidents,1);assert.ok(Math.abs(restored.day-day-remaining)<1e-6);assert.equal(JSON.stringify(restored.tasks),before);
 until(restored,s=>s.complete,.1);
});
for(const [i,old] of legacy.entries())test('original process save '+i+' can finish automatically with retained quantities',()=>{
 const s=C.decode(JSON.stringify(old));assert.ok(s);C.startProject(s);until(s,s=>s.complete,.1);assert.ok(C.decode(JSON.stringify(s)));
});
test('large clock steps preserve automatic decisions and do not bill beyond handover',()=>{
 const a=fresh(),b=fresh();C.startProject(a);C.startProject(b);
 C.advanceProject(a,20);for(let i=0;i<200;i++)C.advanceProject(b,.1);
 assert.ok(Math.abs(a.spent-b.spent)<.01);for(const t of C.plan(a))assert.ok(Math.abs(a.tasks[t.id].progress-b.tasks[t.id].progress)<1e-6,t.id);
 until(a,s=>s.tasks.handover.progress>.5);const near=C.decode(JSON.stringify(a));C.startProject(near);C.advanceProject(a,20);until(near,s=>s.complete);assert.ok(Math.abs(a.spent-near.spent)<.01);assert.ok(Math.abs(a.day-near.day)<1e-6);
});

test('near-zero remaining review time in an older save cannot trap the automatic clock',()=>{
 const s=fresh();C.startProject(s);C.incident(s,'Truck','Crew');C.recover(s);s.safety.remaining=1e-12;const restored=C.decode(JSON.stringify(s));assert.ok(restored);C.startProject(restored);C.advanceProject(restored,.1);assert.equal(restored.day,.1);assert.equal(restored.safety.stage,null);
});
