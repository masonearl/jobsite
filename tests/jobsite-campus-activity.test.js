const test=require('node:test'),assert=require('node:assert/strict');
const M=import('../web/assets/js/jobsite-campus-activity.mjs');
test('cut, load, haul and tip form an ordered earthmoving cycle',async()=>{
 const {earthCycle}=await M,at=f=>earthCycle(f/6);
 assert.equal(at(.1).soil,false);assert.equal(at(.3).soil,true);
 assert.equal(at(.47).payload,1);assert.equal(at(.47).soil,false);
 assert.notDeepEqual(at(.6).truck,at(.6).loading);assert.equal(at(.6).fill,0);
 assert.ok(at(.74).tip>.3);assert.ok(at(.78).fill>.8);assert.equal(at(.85).payload,0);
 assert.deepEqual(at(.99999).truck.map(n=>Math.round(n)),at(.99999).loading.map(n=>Math.round(n)));
});
test('parallel excavators and their loading pads stay separate',async()=>{
 const {earthCycle}=await M;
 for(let p=0;p<1;p+=.01){const a=earthCycle(p,0),b=earthCycle(p,1);for(const x of [a.machine,a.truck])for(const y of [b.machine,b.truck])assert.ok(Math.hypot(x[0]-y[0],x[2]-y[2])>6);}
});
test('earthwork removes a bank and fills low ground after the truck tips',async()=>{
 const {earthCell,earthHeight}=await M,c=earthCell(0);
 assert.ok(earthHeight(...c.cut,0)>1);assert.ok(earthHeight(...c.fill,0)<-.8);
 assert.ok(earthHeight(...c.cut,.3/6)<earthHeight(...c.cut,0));
 assert.ok(earthHeight(...c.fill,.83/6)>earthHeight(...c.fill,.6/6));
 for(const x of [-60,0,50])for(const z of [-40,10,35])assert.equal(earthHeight(x,z,1),-.08);
});
test('trench excavation leads pipe and backfill never overtakes installation',async()=>{
 const {trenchStages,trenchDepth,trenchX}=await M;
 for(let p=0;p<=1;p+=.01){const s=trenchStages(p);assert.ok(s.dig>=s.pipe&&s.pipe>=s.fill);assert.ok(s.fill>=0&&s.dig<=24);}
 const stage=trenchStages(.4);assert.ok(trenchDepth(trenchX(stage.pipe-.5),30,.4)<-1);
 assert.equal(trenchDepth(0,30,0),0);assert.equal(trenchDepth(0,30,1),0);
 for(let i=0;i<24;i++)assert.equal(trenchDepth(trenchX(i+.5),30,1),0);
 assert.equal(trenchDepth(0,40,.4),0);assert.deepEqual(trenchStages(1),{dig:24,pipe:24,fill:24});
});
test('articulated arm reaches its target and clamps impossible targets',async()=>{
 const {armAngles}=await M;
 for(const [reach,rise] of [[6,-2.6],[7,1.4],[4,3]]){const {shoulder:a,elbow:b}=armAngles(reach,rise);assert.ok(Math.abs(5*Math.cos(a)+4*Math.cos(a+b)-reach)<1e-6);assert.ok(Math.abs(5*Math.sin(a)+4*Math.sin(a+b)-rise)<1e-6);}
 for(const [r,h] of [[100,0],[0,0],[0,20]])assert.ok(Object.values(armAngles(r,h)).every(Number.isFinite));
});
test('arrivals progress from access road into 32 distinct bays outside the site',async()=>{
 const {arrivalPose,parkingBay}=await M,positions=new Set();
 for(let i=0;i<32;i++){const first=arrivalPose(i,0),last=arrivalPose(i,2),bay=parkingBay(i);assert.equal(first.visible,false);assert.equal(last.parked,true);assert.deepEqual(last.position,bay);assert.ok(bay[2]>61);positions.add(bay.join(','));}
 assert.equal(positions.size,32);assert.equal(arrivalPose(0,.15).parked,false);assert.ok(arrivalPose(0,.15).visible);
});
test('pedestrian arrivals go through the walking route and site gate',async()=>{
 const {pedestrianRoute}=await M,p=pedestrianRoute([-50,0,73],[20,.6,-15]);
 assert.ok(p.some(v=>v[0]===-76&&v[2]===64));assert.ok(p.some(v=>v[0]===-48&&v[2]===64));assert.ok(p.some(v=>v[2]===43));assert.deepEqual(p.at(-1),[20,.6,-15]);
});
test('saved progress reconstructs identical equipment and terrain poses',async()=>{
 const {earthCycle,earthProfile,trenchStages}=await M;
 for(const p of [.04,.235,.66,1]){const saved=JSON.parse(JSON.stringify({progress:p}));assert.deepEqual(earthCycle(p),earthCycle(saved.progress));assert.deepEqual(earthProfile(p),earthProfile(saved.progress));assert.deepEqual(trenchStages(p),trenchStages(saved.progress));}
});

test('excavators travel continuously into the next cut before digging',async()=>{const {earthCycle}=await M;for(let i=1;i<6;i++){const before=earthCycle(i/6-1e-7),after=earthCycle(i/6+1e-7);assert.ok(Math.hypot(...before.machine.map((v,j)=>v-after.machine[j]))<.01);assert.ok(Math.hypot(...before.truck.map((v,j)=>v-after.truck[j]))<.01);}});

test('every package has finite worker positions throughout its work',async()=>{const {workLocation}=await M,C=require('../web/assets/js/jobsite-campus.js');for(const site of ['stratos','starbase','terafab'])for(const task of C.plan(site))for(const p of [0,.01,.24,.5,.99,1])for(let worker=0;worker<(C.TRADES[task.trade]?.people||1);worker++)assert.ok(workLocation(task,p,worker).every(Number.isFinite),task.id+' '+p);});
