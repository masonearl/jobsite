const test = require('node:test');
const assert = require('node:assert/strict');
const Sim = require('../web/assets/js/jobsite-sim.js');
const Save = require('../web/assets/js/jobsite-save.js');
const make = (region = 'utah', fleet) => { const s = Sim.createState(0, true, null, region, fleet); Sim.startProject(s); Sim.enableAutonomy(s); return s; };
function until(s, condition, limit = 1200) { for (let t = 0; t < limit; t += .1) { if (condition(s)) return; Sim.step(s, .1); } assert.fail(JSON.stringify(s.project.flow.messages)); }
function balance(s) {
    const p = s.project, f = p.flow, reserve = [f.pipeWork, f.backfillWork].filter(Boolean);
    const pendingMass = reserve.reduce((sum, w) => sum + w.reuseMass * (1 - w.applied), 0);
    const accounted = s.terrain.dispatched + (s.truckState === 'waiting' ? s.truck : 0) + s.bucket + (s.phase === 'digging' ? s.pendingPayload * s.cut.applied : 0) + f.spoilMass + f.reusedMass + pendingMass;
    assert.ok(Math.abs(s.terrain.mass - accounted) < 1e-5, 'excavated mass must remain in bucket, truck, bank, reserve or backfill');
    const open = s.terrain.depths.reduce((sum, d) => sum + d, 0) * (Sim.TERRAIN.size / Sim.TERRAIN.segments) ** 2;
    assert.ok(Math.abs(open + p.filledVolume - s.terrain.volume) < 1e-5, 'concurrent excavation and backfill must match geometry');
    assert.ok(Math.abs(p.materialPlaced + p.pipeVolume + f.reusedVolume - p.filledVolume) < 1e-5, 'imported fill, reused spoil and pipe displacement must close');
    assert.ok(Math.abs(f.bank.reduce((sum, p) => sum + p.volume, 0) - f.spoilVolume) < 1e-5);
    assert.ok(Math.abs(f.bank.reduce((sum, p) => sum + p.mass, 0) - f.spoilMass) < 1e-5);
}
test('one dispatch completes all 18 region/fleet jobs without held input', () => {
    let tripleOverlap = false;
    for (const region of Sim.REGIONS) for (const fleet of Object.keys(Sim.FLEETS)) {
        const s = make(region.id, fleet); Sim.setSpreadRunning(s, true);
        assert.equal(s.primaryHeld, false); let concurrent = false;
        for (let i = 0; i < 15000 && !s.project.complete; i++) {
            Sim.step(s, .1); const f = s.project.flow;
            if (s.phase === 'digging' && (f.pipeWork || f.backfillWork)) concurrent = true;
            if (s.phase === 'digging' && f.pipeWork && f.backfillWork) tripleOverlap = true;
            if (i % 50 === 0) balance(s);
        }
        assert.ok(s.project.complete, region.id + '/' + fleet); assert.ok(concurrent, 'excavation must overlap trailing crew work');
        assert.equal(s.utilities.pipes.length, 6); assert.equal(s.utilities.joints.length, 5); assert.ok(s.utilities.pipes.every(pipe => pipe.buried));
        assert.ok(s.project.flow.reusedVolume > 0); assert.ok(s.hauled > 0); assert.equal(Math.max(...s.terrain.depths), 0);
        balance(s);
    }
    assert.ok(tripleOverlap, 'the scheduler must permit all three work fronts simultaneously');
});
test('excavation runs independently, respects the open-trench limit, and resumes when backfill catches up', () => {
    const s = make(); Sim.setGang(s, 'dig', true); Sim.step(s, 200);
    assert.deepEqual(Sim.flowProgress(s), { excavated: 5, piped: 0, backfilled: 0 });
    assert.equal(s.phase, 'idle'); assert.match(s.project.flow.messages.dig, /backfill must catch up/);
    Sim.setGang(s, 'pipe', true); Sim.step(s, 160);
    assert.deepEqual(Sim.flowProgress(s), { excavated: 5, piped: 4, backfilled: 0 });
    Sim.setGang(s, 'backfill', true); Sim.step(s, 1200); assert.ok(s.project.complete); balance(s);
});
test('pipe and backfill assignments wait without inventing excavation or materials', () => {
    const s = make(); Sim.setGang(s, 'pipe', true); Sim.setGang(s, 'backfill', true); Sim.step(s, 80);
    assert.equal(s.terrain.volume, 0); assert.equal(s.utilities.pipes.length, 0); assert.equal(s.project.filledVolume, 0);
    assert.equal(s.project.flow.pipeWork, null); assert.equal(s.project.flow.backfillWork, null);
});
test('stopping a gang finishes its operation and does not stop the other gangs', () => {
    const s = make(); Sim.setSpreadRunning(s, true); until(s, s => !!s.project.flow.pipeWork && s.phase === 'digging');
    const work = s.project.flow.pipeWork, index = work.index, type = work.type;
    Sim.setGang(s, 'pipe', false); Sim.step(s, 40);
    assert.equal(s.project.flow.pipeWork, null); assert.notEqual(s.project.sections[index].stage, type);
    const dug = Sim.flowProgress(s).excavated; assert.ok(dug >= 2); assert.equal(s.project.flow.running.dig, true);
    Sim.setSpreadRunning(s, false); Sim.step(s, 40); const volume = s.terrain.volume;
    Sim.step(s, 40); assert.equal(s.terrain.volume, volume); assert.equal(s.phase, 'idle'); assert.equal(s.bucket, 0); balance(s);
    Sim.setSpreadRunning(s, true); Sim.step(s, 1200); assert.ok(s.project.complete);
});
test('parallel work survives pause and version 3 reload without duplicated material', () => {
    let s = make(); Sim.setSpreadRunning(s, true);
    until(s, s => s.project.flow.backfillWork?.type === 'fill' && s.project.flow.backfillWork.applied > .1 && s.phase === 'digging');
    const json = Save.encode(s); assert.equal(JSON.parse(json).version, 3); s = Save.decode(json, 'utah', 'utility');
    const before = Save.encode(s, 1); Sim.step(s, 20); assert.equal(Save.encode(s, 1), before);
    assert.deepEqual(s.project.flow.running, { dig: true, pipe: true, backfill: true });
    Sim.pause(s); Sim.step(s, 1200); assert.ok(s.project.complete); balance(s);
});
test('legacy saved jobs migrate without erasing active pipe or partial backfill', () => {
    for (const type of ['bedding', 'pipe', 'fill', 'compact']) {
        let s = Sim.createState(0, true); Sim.startProject(s); Sim.setPrimaryHeld(s, true);
        for (let i = 0; i < 10000; i++) { Sim.step(s, .1); if (s.project.work?.type === type && s.project.work.elapsed > .1) break; }
        s = Save.decode(Save.encode(s), 'utah', 'utility'); const terrain = Array.from(s.terrain.depths), stock = { ...s.project.inventory }, pipes = JSON.stringify(s.utilities.pipes);
        Sim.enableAutonomy(s); assert.deepEqual(Array.from(s.terrain.depths), terrain); assert.deepEqual(s.project.inventory, stock); assert.equal(JSON.stringify(s.utilities.pipes), pipes);
        Sim.pause(s); Sim.setSpreadRunning(s, true); Sim.step(s, 1200); assert.ok(s.project.complete, type); balance(s);
    }
});
test('excavator tracks stay beside the line and crew work stays separated', () => {
    const s = make(); Sim.setSpreadRunning(s, true);
    for (let i = 0; i < 10000 && !s.project.complete; i++) {
        Sim.step(s, .1); const f = s.project.flow;
        assert.ok(s.machine.z - s.project.sections[0].z > 4);
        assert.ok(Sim.groundDepth(s, s.machine.x, s.machine.z) < .01);
        if (f.pipeWork && f.digIndex < 6) assert.ok(f.pipeWork.index + 2 <= f.digIndex);
        if (f.backfillWork) { assert.ok(s.project.sections[f.backfillWork.index].inspected); if (f.pipeWork) assert.ok(f.pipeWork.index >= f.backfillWork.index + 2); }
    }
});
test('invalid autonomous work saves are blocked', () => {
    const s = make(); const saved = JSON.parse(Save.encode(s)); saved.state.project.flow.digIndex = 99;
    assert.throws(() => Save.decode(JSON.stringify(saved), 'utah', 'utility'));
});
