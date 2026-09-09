const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../web/assets/js/jobsite-campus.js'),legacy=require('./fixtures/jobsite-campus-v1.json');
const task=(s,id)=>C.plan(s.site).find(t=>t.id===id);
function start(){const s=C.create('stratos');C.dispatch(s,'all',true);Object.keys(C.MATERIALS).forEach(k=>C.order(s,k));s.running=true;return s;}
function until(s,condition,inspect=true){for(let i=0;i<3000&&!condition(s);i++){C.advance(s,.05);if(inspect)C.plan(s.site).filter(t=>t.gate).forEach(t=>C.inspect(s,t.id));}assert.ok(condition(s),JSON.stringify(C.allocation(s).reasons));return s;}
test('clearing waits for access and erosion controls; distinct fronts can overlap',()=>{
 const s=start();C.dispatch(s,'controls',false);until(s,s=>C.done(s,'survey'));C.advance(s,10);assert.equal(s.tasks.clear.progress,0);C.dispatch(s,'controls',true);until(s,s=>s.tasks.grade.progress>0&&s.tasks.drain.progress>0);assert.ok(s.tasks.grade.progress<1);
});
test('reach inspection requires a field crew and cannot be skipped by a large time step',async()=>{
 const M=await import('../web/assets/js/jobsite-campus-activity.mjs'),s=start();
 until(s,s=>s.tasks.drain.progress>0&&C.workPhase(s,task(s,'drain')).trade==='survey');
 C.capacity(s,'crews','survey',-1);const before=s.tasks.drain.progress,st=M.trenchStages(before);C.advance(s,5);
 assert.equal(s.tasks.drain.progress,before);assert.equal(st.fill,0);assert.equal(st.pipe,4);assert.match(C.allocation(s).reasons.drain,/survey/i);
 C.capacity(s,'crews','survey',1);until(s,s=>M.trenchStages(s.tasks.drain.progress).fill>0);assert.ok(s.tasks.drain.progress>.6/6);
});
test('utility geometry opens only a short reach and cover follows its field check',async()=>{
 const {trenchStages}=await import('../web/assets/js/jobsite-campus-activity.mjs');
 for(let r=0;r<6;r++){assert.equal(trenchStages((r+.59)/6).fill,r*4);assert.ok(trenchStages((r+.7)/6).fill>r*4);}
 for(let p=0;p<1;p+=.002){const a=trenchStages(p);assert.ok(a.dig-a.fill<=4.00001);assert.ok(a.pipe>=a.fill&&a.dig>=a.pipe);}
});
test('curing uses elapsed time without reserving a crew, pump or productive labor hours',()=>{
 const s=start();until(s,s=>C.done(s,'a-slab'));C.dispatch(s,'all',false);C.capacity(s,'crews','concrete',-1);C.capacity(s,'equipment','pump',-1);
 const before=s.laborHours,a=C.allocation(s);assert.ok(a.passive.some(t=>t.id==='a-cure'));assert.ok(a.active.every(t=>!t.elapsed));C.advance(s,1);assert.ok(s.tasks['a-cure'].progress>=1/3-.001);assert.equal(s.laborHours,before);
 s.running=false;const p=s.tasks['a-cure'].progress;C.advance(s,5);assert.equal(s.tasks['a-cure'].progress,p);
});
test('more concrete crews do not accelerate curing and elapsed time alone cannot release erection',()=>{
 const s=start();until(s,s=>C.done(s,'a-slab'));const extra=C.decode(JSON.stringify(s));extra.running=true;C.capacity(extra,'crews','concrete',1);C.capacity(extra,'equipment','pump',1);C.advance(s,1);C.advance(extra,1);assert.equal(s.tasks['a-cure'].progress,extra.tasks['a-cure'].progress);
 until(s,s=>s.tasks['a-strength'].progress===1,false);assert.equal(s.tasks['a-frame'].progress,0);assert.equal(C.done(s,'a-strength'),false);assert.ok(C.inspect(s,'a-strength'));assert.ok(C.readiness(s,task(s,'a-frame'))==='Ready'||C.weather(s).crane);
});
test('plant setting requires a released equipment foundation and consumes one package',()=>{
 const s=start();C.dispatch(s,'power-ready',false);until(s,s=>C.done(s,'power-cure'));C.advance(s,20);assert.equal(s.tasks.power.progress,0);assert.equal(s.orders.power.used,0);C.dispatch(s,'power-ready',true);until(s,s=>s.tasks.power.progress>0);assert.equal(s.orders.power.used,1);assert.ok(C.done(s,'power-ready'));
});
test('startup and functional tests precede integrated tests and owner turnover',()=>{
 const s=start();C.dispatch(s,'startup',false);until(s,s=>C.done(s,'release'));C.advance(s,20);assert.equal(s.tasks.functional.progress,0);assert.equal(s.tasks.test.progress,0);C.dispatch(s,'startup',true);until(s,s=>s.complete);for(const [before,after] of [['release','startup'],['startup','functional'],['functional','test'],['test','handover']])assert.ok(s.tasks[before].finish<=s.tasks[after].start+.051);
});
for(const [index,old] of legacy.entries())test('version 1 save '+index+' keeps quantities, money and completed work through migration and reload',()=>{
 const before=JSON.stringify(old),s=C.decode(before);assert.ok(s);assert.equal(s.version,2);assert.equal(s.spent,old.spent);assert.equal(s.day,old.day);assert.equal(s.complete,old.complete);assert.deepEqual(s.orders,old.orders);for(const [id,state] of Object.entries(old.tasks))assert.deepEqual(s.tasks[id],state,id);assert.ok(C.decode(JSON.stringify(s)),'updated save must reload');s.running=!s.complete;until(s,s=>s.complete);assert.equal(JSON.stringify(old),before);
});
test('invalid earlier saves are rejected rather than given migration credit',()=>{
 const broken=JSON.parse(JSON.stringify(legacy[0]));broken.tasks['a-frame'].started=true;broken.tasks['a-frame'].progress=.2;assert.equal(C.decode(JSON.stringify(broken)),null);
 const started=JSON.parse(JSON.stringify(legacy[3]));started.tasks['a-frame'].accepted=false;started.tasks['a-frame'].progress=.99;assert.equal(C.decode(JSON.stringify(started)),null,'migration must not waive an invalid original dependency');
});
test('every work package links a published process source; calendar waits have no resources',()=>{
 for(const t of C.plan('stratos')){assert.ok(t.sources?.length,t.id);for(const key of t.sources)assert.ok(C.PROCESS_SOURCES[key].url.startsWith('https://'));if(t.elapsed){assert.equal(t.trade,null);assert.equal(t.equipment,null);assert.equal(t.cost,0);}}
});
