const test = require('node:test');
const assert = require('node:assert/strict');
const Sim = require('../web/assets/js/jobsite-sim.js');
const Save = require('../web/assets/js/jobsite-save.js');
const project = (region = 'utah', fleet) => { const s = Sim.createState(0, true, null, region, fleet); assert.ok(Sim.startProject(s)); return s; };
function until(s, check, limit = 1200) { for (let t = 0; t < limit; t += .1) { if (check(s)) return; Sim.step(s, .1); } assert.fail('Stalled: ' + s.message); }
function assertBalance(s) {
    const carried = s.terrain.dispatched + (s.truckState === 'waiting' ? s.truck : 0) + s.bucket + (s.phase === 'digging' ? s.pendingPayload * s.cut.applied : 0);
    assert.ok(Math.abs(carried - s.terrain.mass) < 1e-5, 'Excavated spoil was lost or duplicated');
    const open = s.terrain.depths.reduce((sum, depth) => sum + depth, 0) * (Sim.TERRAIN.size / Sim.TERRAIN.segments) ** 2;
    assert.ok(Math.abs(open + s.project.filledVolume - s.terrain.volume) < 1e-5, 'Backfill did not match the surface geometry');
    assert.ok(Math.abs(s.project.materialPlaced + s.project.pipeVolume - s.project.filledVolume) < 1e-5, 'Pipe displacement or imported fill double counted');
}
test('every region and fleet completes the inspected, connected, backfilled utility line', () => {
    for (const region of Sim.REGIONS) for (const fleet of Object.keys(Sim.FLEETS)) {
        const s = project(region.id, fleet); Sim.setPrimaryHeld(s, true); Sim.step(s, 1600);
        assert.ok(s.project.complete, region.id + '/' + fleet + ': ' + s.message);
        assert.equal(s.status, 'won'); assert.equal(s.utilities.pipes.length, 6); assert.equal(s.utilities.joints.length, 5);
        assert.ok(s.project.sections.every(p => p.accepted && p.inspected && p.bedded && p.lift === 4));
        assert.ok(s.utilities.pipes.every(p => p.buried)); assert.ok(s.project.delivered >= 2);
        assert.equal(s.project.earned, 3600); assert.equal(s.project.inventory.pipe, 2 + s.project.delivered * 6 - 6);
        assertBalance(s); assert.equal(Math.max(...s.terrain.depths), 0);
        const costs = Sim.projectCost(s), time = s.project.elapsed; Sim.step(s, 60);
        assert.equal(Sim.projectCost(s), costs); assert.equal(s.project.elapsed, time);
    }
});
test('work cannot bypass formation, bedding, inspection or compaction prerequisites', () => {
    const s = project(); assert.equal(Sim.press(s), false); assert.equal(Sim.startProjectWork(s, 'pipe'), false); assert.equal(Sim.startPipeWork(s, 'install'), false);
    Sim.setPrimaryHeld(s, true); until(s, s => s.project.work?.type === 'bedding'); Sim.setPrimaryHeld(s, false);
    assert.equal(Sim.press(s), false); assert.equal(Sim.startProjectWork(s, 'fill'), false); Sim.step(s, 15);
    assert.equal(Sim.projectSection(s).stage, 'pipe'); assert.equal(Sim.startProjectWork(s, 'inspect'), false);
    Sim.setPrimaryHeld(s, true); until(s, s => s.project.sections[0].stage === 'compact'); Sim.setPrimaryHeld(s, false, true);
    assert.equal(Sim.startProjectWork(s, 'fill'), false); assert.equal(s.project.sections[0].accepted, false);
    assertBalance(s);
});
test('material shortages request one delivery, reserve once, and preserve remaining inventory', () => {
    const s = project(); s.project.inventory.bedding = 0; Sim.setPrimaryHeld(s, true);
    until(s, s => !!s.project.delivery); const charged = s.project.costs.materials;
    for (let i = 0; i < 10; i++) assert.equal(Sim.orderMaterials(s), false);
    Sim.step(s, 1); assert.equal(s.project.costs.materials, charged); assert.equal(s.project.ordered, 1);
    Sim.setPrimaryHeld(s, false, true); Sim.step(s, 20);
    assert.equal(s.project.inventory.bedding, 2); assert.equal(s.project.inventory.fill, 10); assert.equal(s.project.inventory.pipe, 8);
});
test('wet sites require pumping before formation and keep the pump cost running', () => {
    const s = project('vancouver'); Sim.setPrimaryHeld(s, true); until(s, s => s.project.work?.type === 'pump');
    assert.ok(Sim.projectSection(s).water > 0); assert.equal(Sim.startProjectWork(s, 'bedding'), false);
    Sim.setPrimaryHeld(s, false); Sim.step(s, 10); assert.equal(Sim.projectSection(s).water, 0); assert.equal(s.project.pumping, true);
});
test('careful and fast methods trade cycle time for compaction passes without skipping lifts', () => {
    const results = [];
    for (const method of ['careful', 'steady', 'fast']) {
        const s = project(); assert.ok(Sim.setProjectMethod(s, method)); Sim.setPrimaryHeld(s, true);
        until(s, s => s.project.work?.type === 'compact'); Sim.setPrimaryHeld(s, false, true); Sim.step(s, 15);
        assert.equal(Sim.setProjectMethod(s, method === 'fast' ? 'careful' : 'fast'), false);
        Sim.setPrimaryHeld(s, true); Sim.step(s, 1400); assert.ok(s.project.complete); results.push(s.project.elapsed);
        assert.equal(s.project.sections[0].passes, Sim.PROJECT_METHODS[method].passes);
    }
    assert.notEqual(results[0], results[2]);
});
test('active fill saves resume exactly once and leave held input cleared', () => {
    const s = project(); Sim.setPrimaryHeld(s, true); until(s, s => s.project.work?.type === 'fill' && s.project.work.applied > .15);
    const saved = Save.encode(s); assert.equal(JSON.parse(saved).version, 2);
    const restored = Save.decode(saved, 'utah', 'utility'); assert.equal(restored.status, 'paused'); assert.equal(restored.primaryHeld, false);
    const stock = { ...restored.project.inventory }; const time = restored.project.elapsed; Sim.step(restored, 30); assert.equal(restored.project.elapsed, time);
    Sim.pause(restored); Sim.step(restored, 20); assert.deepEqual(restored.project.inventory, stock); assert.equal(restored.project.sections[0].stage, 'compact'); assertBalance(restored);
    Sim.setPrimaryHeld(restored, true); Sim.step(restored, 1200); assert.ok(restored.project.complete); assertBalance(restored);
});
test('reload at every project stage can complete without replaying a material charge or inspection', () => {
    let s = project(); Sim.setPrimaryHeld(s, true); const visited = new Set();
    for (let tick = 0; tick < 12000 && !s.project.complete; tick++) {
        Sim.step(s, .1); const type = s.project.work?.type;
        if (type && !visited.has(type) && s.project.work.elapsed > .1) {
            visited.add(type); const bill = s.project.costs.materials; s = Save.decode(Save.encode(s), 'utah', 'utility');
            assert.equal(s.project.costs.materials, bill); Sim.setPrimaryHeld(s, true);
        }
    }
    assert.ok(s.project.complete); assert.equal(s.utilities.joints.length, 5); assert.ok(visited.has('compact')); assertBalance(s);
});
test('starting a project leaves previous excavation, pipe and carried spoil intact', () => {
    const s = Sim.createState(0, true); Sim.start(s); Sim.setOperateHeld(s, true); Sim.step(s, 20); Sim.setOperateHeld(s, false);
    Sim.startPipeWork(s, 'install'); Sim.step(s, 15); const previous = Array.from(s.terrain.depths), pipe = JSON.stringify(s.utilities.pipes[0]), mass = s.terrain.mass;
    assert.ok(Sim.startProject(s)); assert.deepEqual(Array.from(s.terrain.depths), previous); assert.equal(JSON.stringify(s.utilities.pipes[0]), pipe);
    Sim.setPrimaryHeld(s, true); Sim.step(s, 1200); assert.ok(s.project.complete); assert.equal(s.utilities.pipes.length, 7); assert.ok(s.terrain.mass >= mass);
    assert.equal(JSON.stringify(s.utilities.pipes[0]), pipe); assertBalance(s);
});
test('unknown future saves remain protected even when a previous-good backup exists', () => {
    const s = project(), old = Save.encode(s), values = new Map(), key = Save.key('utah', 'utility');
    const db = { getItem: k => values.get(k), setItem: (k, v) => values.set(k, v) };
    values.set(key, '{"version":99}'); values.set(key + ':backup', old);
    assert.equal(Save.read(db, 'utah', 'utility').blocked, true); assert.throws(() => Save.write(db, s)); assert.equal(values.get(key), '{"version":99}');
});
test('pausing and reloading between stations returns to the planned cut before excavating', () => {
    let s = project(); Sim.setPrimaryHeld(s, true); until(s, s => s.project.active === 1 && !!s.advance && Math.abs(s.machine.x - 8) > .1);
    Sim.step(s, .2); const target = { ...s.project.sections[1] }; Sim.pause(s);
    s = Save.decode(Save.encode(s), 'utah', 'utility'); Sim.setPrimaryHeld(s, true);
    until(s, s => s.phase === 'digging'); assert.ok(Math.abs(s.machine.x - target.machine.x) < .05); assert.ok(Math.abs(s.cut.x - target.x) < .05);
    Sim.step(s, 1200); assert.ok(s.project.complete); assertBalance(s);
});
