const test=require('node:test');
const assert=require('node:assert/strict');
const C=require('../web/assets/js/jobsite-campus.js');
test('old attempts retain their original geometry; fresh attempts use destination layouts',()=>{
 const fresh=C.create('starbase');assert.equal(fresh.modelRevision,2);assert.equal(C.model(fresh).context,'launch');
 const old={...fresh};delete old.modelRevision;const restored=C.decode(JSON.stringify(old));assert.equal(restored.modelRevision,1);assert.equal(C.model(restored).context,'legacy');
 restored.modelRevision=2;assert.deepEqual(C.decode(JSON.stringify(restored)).tasks,fresh.tasks);
 assert.equal(C.decode(JSON.stringify({...fresh,modelRevision:3})),null);
 assert.match(C.plan(fresh).find(t=>t.id==='b-frame').name,/Launch mount 1/);
 assert.match(C.plan({...fresh,modelRevision:1}).find(t=>t.id==='b-frame').name,/Integration building/);
});
test('each destination has a distinct layout and explicit source-versus-reconstruction provenance',()=>{
 const models=C.SITES.map(p=>C.model(p.id));assert.equal(new Set(models.map(m=>JSON.stringify([m.fronts,m.context,m.roads]))).size,7);
 for(const m of models){assert.ok(m.observed&&m.inferred&&m.basis&&m.sources.length);assert.ok(m.sources.every(s=>s.url.startsWith('https://')&&s.date));assert.equal(m.fronts.length,2);}
});
test('workstations, slab pours and foundation excavation follow each rendered footprint',async()=>{
 const {workLocation,frontFoundationDepth,roadPoint}=await import('../web/assets/js/jobsite-campus-activity.mjs');
 for(const site of C.SITES){const s=C.create(site.id),model=C.model(s);
  for(const f of model.fronts){
   const t=C.plan(s).find(t=>t.id===f.key+'-prep');const point=workLocation(t,0,0,model);
   assert.ok(Math.abs(point[0]-(f.x-18*f.width/40))<1e-8);
   assert.ok(frontFoundationDepth(point[0],point[2],.1,0,f)<-.8);
   assert.ok(Math.abs(frontFoundationDepth(point[0],point[2],1,1,f))<1e-9);
  }
  for(let p=0;p<=1;p+=.01){const a=roadPoint(p,model);assert.ok(a.every(Number.isFinite));for(const f of model.fronts)assert.ok(Math.abs(a[0]-f.x)>f.width/2+3||Math.abs(a[2]-f.z)>f.depth/2+3);}
 }
});
