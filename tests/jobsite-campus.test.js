const { test } = require('node:test');
const assert = require('node:assert/strict');
const C = require('../web/assets/js/jobsite-campus.js');
function ready(id = 'stratos') { const s = C.create(id); C.dispatch(s, 'all', true); Object.keys(C.MATERIALS).forEach(k => C.order(s, k)); s.running = true; return s; }
function run(s, days = 250, inspections = true, slice = .1) {
    for (let i = 0; i < days / slice && !s.complete; i++) {
        C.advance(s, slice);
        if (inspections) for (const t of C.plan(s.site)) if (t.gate) C.inspect(s, t.id);
    }
    return s;
}
for (const p of C.SITES) test(p.id + ': complete project with dependencies, stock conservation and exclusive resources', () => {
    const s = ready(p.id), tasks = C.plan(p.id);
    assert.equal(tasks.length, 44);
    assert.equal(new Set(tasks.map(t => t.id)).size, tasks.length);
    for (let i = 0; i < 1500 && !s.complete; i++) {
        const a = C.allocation(s);
        for (const group of ['labor', 'equipment']) assert.ok(Object.values(a[group]).every(n => n >= 0));
        for (const t of a.active) assert.ok(t.deps.every(id => C.done(s, id)), t.name);
        C.advance(s, .1);
        for (const t of tasks) if (t.gate) C.inspect(s, t.id);
    }
    assert.ok(s.complete, JSON.stringify(C.allocation(s).reasons)); assert.equal(C.progress(s), 1); assert.equal(s.running, false);
    assert.ok(s.spent > 20000000 && s.spent < 50000000); assert.ok(s.day > 40 && s.day < 130);
    for (const [k, m] of Object.entries(C.MATERIALS)) assert.equal(s.orders[k].used, m.quantity);
    for (const t of tasks) assert.ok(t.deps.every(id => s.tasks[id].finish <= s.tasks[t.id].start + .051));
});
test('unreleased inspections block construction and handover', () => {
    const s = run(ready(), 50, false); assert.equal(s.tasks.formation.progress, 1); assert.equal(s.tasks['a-slab'].progress, 0); assert.equal(s.complete, false);
    assert.equal(C.inspect(s, 'handover'), false); assert.equal(C.inspect(s, 'formation'), true);
    run(s, 40, false); assert.equal(s.tasks['a-strength'].progress,1);assert.equal(s.tasks['a-frame'].progress,0);
    for(const id of ['utility-test','a-strength','b-strength'])C.inspect(s,id);
    run(s, 80, false); assert.equal(s.tasks.release.progress, 1); assert.equal(s.tasks.test.progress, 0);
    C.inspect(s, 'release'); run(s, 80, false); assert.equal(s.tasks.handover.progress, 1); assert.equal(s.complete, false);
    C.inspect(s, 'handover'); assert.equal(s.complete, true);
});
test('pause stops work, deliveries and payroll; hold preserves partial progress', () => {
    const s = ready(); C.advance(s, 1); s.running = false; const before = JSON.stringify(s); C.advance(s, 10); assert.equal(JSON.stringify(s), before);
    s.running = true; C.dispatch(s, 'survey', false); const progress = s.tasks.survey.progress; C.advance(s, 1); assert.equal(s.tasks.survey.progress, progress);
    C.dispatch(s, 'survey', true); C.advance(s, 1); assert.ok(s.tasks.survey.progress > progress);
});
test('long-lead orders are required; expediting charges once and preserves package counts', () => {
    const s = C.create('abilene'); C.dispatch(s, 'all', true); s.running = true; run(s, 30);
    assert.equal(s.tasks['a-frame'].progress, 0); assert.match(C.allocation(s).reasons['a-frame'], /Order fabricated steel/);
    const before = s.spent; assert.equal(C.order(s, 'steel'), true); assert.equal(C.order(s, 'steel'), false);
    assert.equal(s.spent - before, C.MATERIALS.steel.cost * 2);
    const due = s.orders.steel.arrival; assert.equal(C.expedite(s, 'steel'), true); assert.ok(s.orders.steel.arrival < due); assert.equal(C.expedite(s, 'steel'), false);
});
test('extra matched resources improve completion; resource changes have bounds and mobilization cost', () => {
    const baseline = run(ready()), extra = ready(); const before = extra.spent;
    for (const key of ['concrete', 'steel', 'electrical', 'mechanical', 'fitout']) C.capacity(extra, 'crews', key, 1);
    for (const key of ['pump', 'crane', 'lift']) C.capacity(extra, 'equipment', key, 1);
    assert.ok(extra.spent > before); run(extra); assert.ok(extra.day < baseline.day, extra.day + ' vs ' + baseline.day);
    assert.equal(C.capacity(extra, 'equipment', 'crane', 1), false, 'Completed projects are immutable');
    const s = ready(); assert.equal(C.capacity(s, 'crews', 'steel', -1), true); assert.equal(C.capacity(s, 'crews', 'steel', -1), false); assert.equal(C.capacity(s, 'equipment', 'invalid', 1), false);
});
test('demobilizing a crew parks its assignment, lowers payroll and permits later remobilization', () => {
    const s = ready(); C.advance(s, .5); const progress = s.tasks.survey.progress;
    assert.ok(C.capacity(s, 'crews', 'survey', -1)); const before = s.spent; C.advance(s, 1);
    assert.equal(s.tasks.survey.progress, progress); assert.ok(C.decode(JSON.stringify(s)));
    const control = ready(); C.advance(control, .5); C.dispatch(control, 'all', false); const cost = control.spent; C.advance(control, 1);
    assert.ok(control.spent - cost > s.spent - before);
    C.capacity(s, 'crews', 'survey', 1); C.advance(s, 1); assert.ok(s.tasks.survey.progress > progress);
});
test('priority redirects a scarce crane; weather holds cranes without stopping indoor trades', () => {
    const s = ready();let candidates=[];for(let i=0;i<1500&&candidates.length<2;i++){run(s,.1);candidates=C.plan(s.site).filter(t=>t.equipment==='crane'&&C.readiness(s,t)==='Ready');}s.running=false;
    // Reach the shared structure front through normal construction, then compare allocation.
    candidates = C.plan(s.site).filter(t => t.equipment === 'crane' && C.readiness(s, t) === 'Ready');
    assert.ok(candidates.length >= 2);
    const pick = candidates[candidates.length - 1]; s.tasks[pick.id].priority = 1;
    assert.ok(C.allocation(s).active.some(t => t.id === pick.id));
    s.day = 31; assert.equal(C.weather(s).crane, true); assert.ok(C.allocation(s).active.every(t => t.equipment !== 'crane'));
});
test('save round-trip is paused, preserves partial work and rejects corrupted/future data', () => {
    const s = ready('terafab'); run(s, 24); const copy = C.decode(JSON.stringify(s)); assert.ok(copy); assert.equal(copy.running, false); assert.deepEqual(copy.tasks, s.tasks); assert.deepEqual(copy.orders, s.orders);
    copy.running = true; run(copy); assert.ok(copy.complete);
    assert.equal(C.decode('{bad'), null); assert.equal(C.decode(JSON.stringify({ ...s, version: 3 })), null);
    const invalid = JSON.parse(JSON.stringify(s)); invalid.tasks.handover.progress = 1; invalid.tasks.handover.accepted = true; assert.equal(C.decode(JSON.stringify(invalid)), null);
    const badStock = JSON.parse(JSON.stringify(s)); badStock.orders.steel.used = 99; assert.equal(C.decode(JSON.stringify(badStock)), null);
});
test('time slicing produces consistent schedules and costs', () => {
    const fine = run(ready('indiana'), 160, true, .05), coarse = run(ready('indiana'), 160, true, .5);
    assert.ok(fine.complete && coarse.complete); assert.ok(Math.abs(fine.day - coarse.day) < 2); assert.ok(Math.abs(fine.spent - coarse.spent) / fine.spent < .02);
});
