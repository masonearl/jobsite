const test=require('node:test'),assert=require('node:assert/strict'),C=require('../web/assets/js/jobsite-campus.js');
const spatial=import('../web/assets/js/jobsite-campus-spatial.mjs'),logistics=import('../web/assets/js/jobsite-campus-logistics.mjs');
function started(){const s=C.create('stratos');C.dispatch(s,'all',true);s.running=true;return s;}
test('pedestrians enter through the open doorway rather than crossing any built wall',async()=>{
 const {PedestrianNetwork,wallPanels}=await spatial,boxes=wallPanels(10).filter(p=>p.solid).map(p=>({x0:p.position[0]-p.size[0]/2,x1:p.position[0]+p.size[0]/2,z0:p.position[2]-p.size[2]/2,z1:p.position[2]+p.size[2]/2}));
 const nav=new PedestrianNetwork(boxes),route=nav.route([-30,0,5],[12,0,-15]);assert.ok(route?.length>2);for(let i=1;i<route.length;i++)assert.ok(nav.clear(route[i-1],route[i]));
 assert.ok(route.slice(1).some((b,i)=>{const a=route[i],t=(-22-a[2])/(b[2]-a[2]);return t>=0&&t<=1&&Math.abs(a[0]+(b[0]-a[0])*t)<3.62;}));
});
test('a blocked destination is reassigned to a clear service face and sealed rooms fail closed',async()=>{
 const {PedestrianNetwork}=await spatial,nav=new PedestrianNetwork([{x0:-2,x1:2,z0:-2,z1:2}]);const route=nav.route([-10,0,0],[0,0,0]);assert.ok(route&&nav.free(route.at(-1)));for(let i=1;i<route.length;i++)assert.ok(nav.clear(route[i-1],route[i]));
 const closed=new PedestrianNetwork([{x0:-5,x1:5,z0:-5,z1:-4},{x0:-5,x1:5,z0:4,z1:5},{x0:-5,x1:-4,z0:-5,z1:5},{x0:4,x1:5,z0:-5,z1:5}]);assert.equal(closed.route([0,0,0],[10,0,0]),null);
});
test('swept contact catches fast equipment and pedestrian crossing between frames',async()=>{
 const {sweptDistance}=await spatial;assert.equal(sweptDistance([-10,0,0],[10,0,0],[0,0,0]),0);assert.equal(sweptDistance([-10,0,0],[10,0,0],[0,0,-10],[0,0,10]),0);assert.equal(sweptDistance([-10,0,0],[10,0,0],[0,0,5]),5);
});
test('pieces exist on the carrier, hook or installed structure exactly once',async()=>{
 const {installation,deliveryPose}=await logistics;
 for(const count of [6,8,15])for(let i=0;i<count;i++)for(const f of [.05,.3,.5,.7,.87,.9,.999]){const p=(i+f)/count,v=deliveryPose(p,count,[2,0,-20],[10,8,-25]);assert.equal(Number(v.carried)+Number(v.suspended)+Number(v.placed),1);assert.equal(v.installed,i+Number(v.placed));assert.ok(v.cargo.every(Number.isFinite));}
 assert.equal(installation(1,15).installed,15);
 const a=deliveryPose(.2/15,15,[2,0,-20],[10,8,-25]),b=deliveryPose(.35/15,15,[2,0,-20],[10,8,-25]);assert.notDeepEqual(a.vehicle,b.vehicle);
});
test('a traffic hold stops only the affected production and is not saved',()=>{
 const s=started();C.siteHolds(s,{survey:'Traffic hold / pedestrian crossing'});C.advance(s,.2);assert.equal(s.tasks.survey.progress,0);assert.equal(C.allocation(s,true).active[0].id,'survey');assert.ok(!JSON.stringify(s).includes('_siteHolds'));C.siteHolds(s,{});C.advance(s,.2);assert.ok(s.tasks.survey.progress>0);
});
test('equipment contact pauses work, charges once, and requires review and release',()=>{
 const s=started();C.advance(s,.1);const quantity=s.tasks.survey.progress,cost=s.spent;
 assert.ok(C.incident(s,'Haul truck','civil worker'));assert.equal(s.running,false);assert.equal(s.spent,cost+25000);assert.equal(C.incident(s,'Haul truck','civil worker'),false);
 s.running=true;C.advance(s,2);assert.equal(s.tasks.survey.progress,quantity);assert.equal(s.running,false);
 assert.ok(C.recover(s));C.advance(s,.2);assert.equal(s.tasks.survey.progress,quantity);assert.equal(s.safety.stage,'review');assert.equal(C.recover(s),false);
 C.advance(s,1);assert.equal(s.safety.stage,'ready');assert.equal(s.running,false);assert.ok(Math.abs(s.safety.lostDays-.5)<1e-6);assert.ok(C.recover(s));s.running=true;C.advance(s,.1);assert.ok(s.tasks.survey.progress>quantity);assert.equal(C.report(s).incidents,1);assert.ok(C.report(s).score<=90);
});
test('old saves default to guarded traffic and active incident records survive reload paused',()=>{
 const s=started();const old=JSON.parse(JSON.stringify(s));delete old.safety;assert.equal(C.decode(JSON.stringify(old)).safety.controls,true);
 C.incident(s,'Material carrier','steel worker');C.recover(s);C.advance(s,.15);const restored=C.decode(JSON.stringify(s));assert.ok(restored);assert.equal(restored.running,false);assert.equal(restored.safety.stage,'review');assert.equal(restored.safety.incidents,1);assert.ok(Math.abs(restored.safety.remaining-.35)<1e-8);
 const bad=JSON.parse(JSON.stringify(s));bad.safety.remaining=-1;assert.equal(C.decode(JSON.stringify(bad)),null);
});
