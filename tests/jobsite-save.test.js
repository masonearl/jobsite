const test = require('node:test');
const assert = require('node:assert/strict');
const Sim = require('../web/assets/js/jobsite-sim.js');
const Save = require('../web/assets/js/jobsite-save.js');
const storage = () => { const values = new Map(); return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }; };
function job(region = 'utah') { const s = Sim.createState(0, true, null, region); Sim.start(s); return s; }
function balance(s) { return s.terrain.dispatched + (s.truckState === 'waiting' ? s.truck : 0) + s.bucket + (s.phase === 'digging' ? s.pendingPayload * s.cut.applied : 0); }
test('reload restores an in-progress excavation and its mass without replaying held input', () => {
    const s = job(); Sim.setOperateHeld(s, true); Sim.step(s, .9);
    assert.equal(s.phase, 'digging'); const restored = Save.decode(Save.encode(s), 'utah', 'utility');
    assert.equal(restored.status, 'paused'); assert.equal(restored.operateHeld, false);
    assert.deepEqual(restored.terrain.depths, s.terrain.depths); assert.equal(restored.cut.applied, s.cut.applied);
    Sim.pause(restored); Sim.step(restored, 2);
    assert.ok(Math.abs(balance(restored) - restored.terrain.mass) < 1e-6);
});
test('saved regions and fleets are independent and old completion records stay intact', () => {
    const db = storage(); db.setItem('openmud-jobsite-world-records-v1', '{"utah:utility":{"completed":2}}');
    const a = job(), b = job('dubai'); Sim.setOperateHeld(a, true); Sim.step(a, 10);
    Save.write(db, a); Save.write(db, b);
    assert.ok(Save.read(db, 'utah', 'utility').state.terrain.volume > 0);
    assert.equal(Save.read(db, 'dubai', 'earthmover').state.terrain.volume, 0);
    assert.equal(Save.read(db, 'utah', 'quarry').state, null);
    assert.match(db.getItem('openmud-jobsite-world-records-v1'), /completed/);
});
test('pipe, fuel, money, upgrades, grade milestones and history survive reload and next shift', () => {
    const s = job(); Sim.setOperateHeld(s, true); Sim.step(s, 20); Sim.setOperateHeld(s, false);
    Sim.startPipeWork(s, 'install'); Sim.step(s, 10); s.credits = 400; Sim.buy(s, 'bucket');
    s.history.push({ level: 0, result: 'lost', hauled: 0, elapsed: 100 });
    const saved = Save.decode(Save.encode(s), 'utah', 'utility');
    const next = Sim.createState(0, false, saved);
    for (const value of [saved, next]) {
        assert.equal(value.utilities.pipes.length, 1); assert.equal(value.upgrades.bucket, true);
        assert.equal(value.graded.length, 1); assert.equal(value.history.length, 1);
        assert.equal(value.fuel, s.fuel); assert.equal(value.terrain.volume, s.terrain.volume); assert.equal(value.credits, 200);
        assert.ok(Math.abs(balance(value) - value.terrain.mass) < 1e-6);
    }
});
test('shift deadline preserves an unfinished cut and a new shift keeps its removed material', () => {
    const s = Sim.createState(); Sim.start(s); Sim.setOperateHeld(s, true); Sim.step(s, .9);
    s.elapsed = s.contract.seconds - .01; Sim.step(s, .02); assert.equal(s.status, 'lost');
    const next = Sim.createState(0, false, s);
    assert.equal(next.terrain, s.terrain); assert.ok(next.bucket > 0);
    assert.ok(Math.abs(balance(next) - next.terrain.mass) < 1e-6);
});
test('corrupt current save recovers its backup and keeps the unreadable original', () => {
    const db = storage(), s = job(), id = Save.key('utah', 'utility'); Save.write(db, s); Save.write(db, s);
    db.setItem(id, 'damaged'); const recovered = Save.read(db, 'utah', 'utility'); assert.equal(recovered.recovered, true);
    Save.write(db, recovered.state); assert.equal(db.getItem(id + ':unreadable'), 'damaged');
    assert.ok(Save.read(db, 'utah', 'utility').state);
});
test('unsupported and invalid saves are preserved instead of replaced with an empty job', () => {
    const db = storage(), id = Save.key('utah', 'utility'), future = '{"version":2}'; db.setItem(id, future);
    assert.equal(Save.read(db, 'utah', 'utility').blocked, true); assert.throws(() => Save.write(db, job()));
    assert.equal(db.getItem(id), future); db.setItem(id, '{broken');
    assert.equal(Save.read(db, 'utah', 'utility').blocked, true); assert.throws(() => Save.write(db, job()));
});
test('missing optional fields in version 1 receive defaults without losing excavation', () => {
    const s = job(); Sim.setOperateHeld(s, true); Sim.step(s, 5);
    const old = JSON.parse(Save.encode(s)); delete old.state.fuel; delete old.state.graded; delete old.state.history;
    const restored = Save.decode(JSON.stringify(old), 'utah', 'utility');
    assert.equal(restored.fuel, 0); assert.deepEqual(restored.graded, []); assert.deepEqual(restored.terrain.depths, s.terrain.depths);
});
test('crew skills and an unfinished lunch survive reload and site changes', () => {
 const s=job();s.skills.operator=65;s.skills.joiner=120;s.energy=10;Sim.crewActivity(s,'lunch');Sim.step(s,2);
 const restored=Save.decode(Save.encode(s),'utah','utility');assert.equal(Sim.crewLevel(restored,'operator'),2);assert.equal(Sim.crewLevel(restored,'joiner'),3);
 assert.equal(restored.crewActivity.elapsed,s.crewActivity.elapsed);Sim.pause(restored);Sim.step(restored,10);assert.ok(restored.energy>99);
 const next=Sim.createState(1,false,restored);assert.deepEqual(next.skills,restored.skills);assert.equal(next.energy,restored.energy);
});
test('a stale tab cannot overwrite newer excavation from another tab', () => {
 const db=storage(),a=job();Save.write(db,a);const b=Save.read(db,'utah','utility').state;
 Sim.setOperateHeld(a,true);Sim.step(a,2);Save.write(db,a);assert.throws(()=>Save.write(db,b),/another tab/);
 assert.ok(Save.read(db,'utah','utility').state.terrain.volume>0);
});
test('site plans and their visibility survive a reload without shifting alignment', () => {
 const s=job();s.machine.x=-4;s.machine.z=2;s.machine.heading=Math.PI/2;Sim.setPlan(s);s.planVisible=true;
 const restored=Save.decode(Save.encode(s),'utah','utility');assert.deepEqual(restored.plan,s.plan);assert.equal(restored.planVisible,true);
 assert.deepEqual(Sim.planSections(restored),Sim.planSections(s));
});
test('stored pipe positions survive reload and migration from an older save', () => {
 const s=job();const restored=Save.decode(Save.encode(s),'utah','utility');assert.deepEqual(restored.stockpiles,s.stockpiles);
 const old=JSON.parse(Save.encode(s));delete old.state.stockpiles; delete old.state.truckParked;assert.deepEqual(Save.decode(JSON.stringify(old),'utah','utility').stockpiles,s.stockpiles);
});
test('truck loading side and an unfinished relocation remain at the saved position', () => {
 const s=job();Sim.switchTruckSide(s);Sim.step(s,.3);const restored=Save.decode(Save.encode(s),'utah','utility');
 assert.equal(restored.haulSide,1);assert.deepEqual(restored.truckRoute,s.truckRoute);assert.deepEqual(restored.truckPose,s.truckPose);
 Sim.pause(restored);Sim.step(restored,5);assert.equal(restored.truckRoute.length,0);assert.equal(restored.truckPose.z,6);
});

test('reloading a queued recovery preserves the site and requires fresh operating input', () => {
    const s = job(); s.truckParked = true; Sim.setPrimaryHeld(s, true); assert.ok(s.recovery);
    const restored = Save.decode(Save.encode(s), 'utah', 'utility');
    assert.equal(restored.primaryHeld, false); assert.equal(restored.operationQueued, false); assert.equal(restored.recovery, null);
    assert.deepEqual(restored.terrain.depths, s.terrain.depths); assert.equal(restored.bucket, s.bucket);
    Sim.pause(restored); Sim.step(restored, 10); assert.equal(restored.digs, s.digs);
    Sim.setPrimaryHeld(restored, true); Sim.setPrimaryHeld(restored, false); Sim.step(restored, 15);
    assert.equal(restored.truckParked, false); assert.equal(restored.digs, s.digs + 1);
});
