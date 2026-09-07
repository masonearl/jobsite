const test = require('node:test');
const assert = require('node:assert/strict');
const Sim = require('../web/assets/js/jobsite-sim.js');
function playing(level = 0, practice = false) { const s = Sim.createState(level, practice); Sim.start(s); return s; }
function dig(s, time = null) {
    if (time === null) { const window = Sim.soil(s).window; time = (window[0] + window[1]) / 2 * Sim.timingPeriod(s) / 2; }
    assert.equal(Sim.press(s), true); Sim.step(s, time); Sim.release(s); Sim.step(s, Sim.digDuration(s) + .05);
}
function dump(s) { assert.equal(Sim.press(s), true); Sim.step(s, 2); }
function waitTruck(s) { if (s.truckState !== 'waiting') Sim.step(s, 1.65 + Sim.haulDuration(s)); }
function freshDig(s) {
    // Production checks use separate cuts, with time allowed for repositioning. Navigation is checked independently.
    s.machine.x = 15 - (s.digs % 11) * 3; s.machine.z = 15 - Math.floor(s.digs / 11) * 6;
    s.crew = s.crew.map((_, i) => Sim.crewHome(s, i)); s.truckPose = Sim.truckPosition(s);
    Sim.step(s, 1.1); if (s.status === 'playing') dig(s);
}

test('timer waits for start and a tap gives a short bucket', () => {
    const s=Sim.createState(); Sim.step(s,10); assert.equal(s.elapsed,0);
    assert.equal(Sim.press(s),false); Sim.start(s); dig(s,0);
    assert.equal(s.bucket,1.25); assert.equal(s.lastQuality,'Short bucket');
});
test('timed bite fills bucket and credits clean streaks', () => {
    const s=playing();dig(s);assert.equal(s.bucket,2.5);assert.equal(s.perfect,1);assert.equal(s.credits,12);
    dump(s);assert.equal(s.truck,2.5);assert.equal(s.bucket,0);assert.equal(s.hauled,0);
    dig(s);assert.equal(s.streak,2);assert.equal(s.credits,26);
});
test('repeated inputs cannot bypass the hydraulic cycle', () => {
    const s=playing();Sim.press(s);Sim.step(s,.6);Sim.release(s);
    assert.equal(Sim.press(s),false);assert.equal(Sim.release(s),false);assert.equal(s.digs,1);
    Sim.step(s,.75);Sim.press(s);assert.equal(Sim.press(s),false);assert.equal(s.truck,0);
});
test('full trucks dispatch once, pay cash and a new truck arrives', () => {
    const s=playing();for(let i=0;i<8;i++){freshDig(s);dump(s);}
    assert.equal(s.hauled,20);assert.equal(s.truckState,'hauling');assert.ok(s.credits>=196);
    waitTruck(s);assert.equal(s.truckState,'waiting');assert.equal(s.truck,0);assert.equal(s.hauled,20);
});
test('partial truck capacity preserves leftover bucket material', () => {
    const s=playing();s.truck=19;s.bucket=2.5;dump(s);
    assert.equal(s.hauled,20);assert.equal(s.bucket,1.5);
    assert.equal(Sim.press(s),false);waitTruck(s);dump(s);assert.equal(s.truck,1.5);assert.equal(s.bucket,0);
});
test('pause freezes truck and shift time and cancels held input', () => {
    const s=playing();Sim.press(s);Sim.step(s,.3);Sim.pause(s);const time=s.elapsed;
    assert.equal(s.phase,'idle');Sim.step(s,30);assert.equal(s.elapsed,time);assert.equal(Sim.release(s),false);
    Sim.pause(s);dig(s);assert.equal(s.bucket,2.5);
});
test('upgrades cost cash, cannot be bought twice, and carry to next contract', () => {
    const s=playing();assert.equal(Sim.buy(s,'bucket'),false);s.credits=400;
    assert.equal(Sim.buy(s,'bucket'),true);assert.equal(s.credits,200);assert.equal(Sim.buy(s,'bucket'),false);
    dig(s);assert.equal(s.bucket,4);assert.equal(Sim.buy(s,'dispatch'),true);
    const next=Sim.createState(1,false,s);assert.equal(next.upgrades.bucket,true);assert.equal(next.credits,s.credits);
    next.upgrades.bucket=false;assert.equal(s.upgrades.bucket,true);
});
test('all contracts are winnable using the full production loop', () => {
    for(let level=0;level<3;level++){
        const s=playing(level);let cycles=0;
        while(s.status==='playing'&&cycles++<100){waitTruck(s);if(s.status!=='playing')break;if(!s.bucket)freshDig(s);if(s.status==='playing')dump(s);}
        assert.equal(s.status,'won',`contract ${level+1}`);assert.equal(s.hauled,s.contract.target);assert.ok(s.elapsed<s.contract.seconds);
        const elapsed=s.elapsed;Sim.step(s,10);assert.equal(s.elapsed,elapsed);
    }
});
test('deadline ends shift; practice keeps running', () => {
    const s=playing();Sim.step(s,110);assert.equal(s.status,'lost');assert.equal(s.elapsed,100);assert.equal(Sim.press(s),false);
    const free=playing(0,true);Sim.step(free,200);assert.equal(free.status,'playing');
});
test('frame sizes do not change payload or haul totals', () => {
    const a=playing(),b=playing();for(const s of [a,b]){s.bucket=2.5;Sim.press(s);}
    Sim.step(a,2);for(let i=0;i<120;i++)Sim.step(b,1/60);
    assert.equal(a.truck,b.truck);assert.equal(a.bucket,b.bucket);assert.equal(a.phase,b.phase);
});
test('dispatch upgrade reduces truck turnaround', () => {
    const a=playing(),b=playing();b.upgrades.dispatch=true;
    for(const s of [a,b]){s.truckState='hauling';s.truck=20;Sim.step(s,3.2);}
    assert.equal(a.truckState,'returning');assert.equal(b.truckState,'waiting');
});

for (const region of Sim.REGIONS) {
    test(`regional contracts are completable: ${region.name}`, () => {
        for (let level = 0; level < 3; level++) {
            const s = Sim.createState(level, false, null, region.id); Sim.start(s);
            let cycles = 0;
            while (s.status === 'playing' && cycles++ < 150) {
                waitTruck(s); if (s.status !== 'playing') break;
                if (!s.bucket) freshDig(s); if (s.status !== 'playing') break;
                dump(s);
            }
            assert.equal(s.status, 'won', `${region.id} contract ${level + 1}`);
            assert.equal(s.hauled, s.contract.target);
        }
    });
}
test('regional selection changes material, hauling, machine and truck capacity', () => {
    const desert = Sim.createState(0, false, null, 'dubai');
    const rock = Sim.createState(0, false, null, 'iceland');
    assert.equal(Sim.soil(desert).name, 'Loose sand');
    assert.equal(desert.fleetId, 'earthmover'); assert.equal(rock.fleetId, 'quarry');
    assert.notEqual(desert.fleet.capacity, rock.fleet.capacity);
    assert.notEqual(Sim.haulDuration(desert), Sim.haulDuration(rock));
    assert.notDeepEqual(desert.region.layers, rock.region.layers);
});
test('deeper layers affect timing windows and cutting duration', () => {
    const s = playing(); const surface = Sim.soil(s); s.excavated = s.contract.target * .8;
    assert.equal(Sim.soil(s).name, 'Wet clay'); assert.notDeepEqual(Sim.soil(s).window, surface.window);
    Sim.press(s); Sim.step(s, .6); Sim.release(s);
    assert.ok(Sim.digDuration(s) > .7);
});
test('invalid selectors safely fall back and fleet override is respected', () => {
    const s = Sim.createState(-10, false, null, 'missing', 'missing');
    assert.equal(s.region.id, 'utah'); assert.equal(s.level, 0); assert.equal(s.fleetId, 'utility');
    const custom = Sim.createState(0, false, null, 'dubai', 'utility'); assert.equal(custom.fleet.capacity, 20);
});
test('material mass is conserved with differing bucket and truck sizes', () => {
    const s = Sim.createState(0, true, null, 'dubai'); Sim.start(s);
    for (let i = 0; i < 23; i++) { waitTruck(s); if (!s.bucket) freshDig(s); dump(s); }
    const truckMaterial = s.truckState === 'waiting' ? s.truck : 0;
    assert.ok(Math.abs(s.excavated - s.hauled - s.bucket - truckMaterial) < .00001);
});

test('travel moves the machine at a bounded frame-independent speed', () => {
    const a = playing(0, true), b = playing(0, true);
    Sim.setDrive(a, 1, 1); Sim.setDrive(b, 1, 1);
    Sim.step(a, 1); for (let i = 0; i < 60; i++) Sim.step(b, 1 / 60);
    assert.ok(Math.abs(Math.hypot(a.machine.x, a.machine.z) - 2) < 1e-8);
    assert.ok(Math.abs(a.machine.x - b.machine.x) < 1e-8);
    assert.ok(Math.abs(a.machine.z - b.machine.z) < 1e-8);
    Sim.setDrive(a, 0, 0); const stopped = { ...a.machine }; Sim.step(a, 2);
    assert.deepEqual(a.machine, stopped);
});
test('pause and the hydraulic cycle prevent machine travel', () => {
    const s = playing(); Sim.setDrive(s, 1, 0); Sim.pause(s); Sim.step(s, 10);
    assert.equal(s.machine.x, 0); assert.deepEqual(s.drive, { x: 0, z: 0 });
    Sim.pause(s); Sim.press(s); Sim.setDrive(s, 1, 0); Sim.step(s, .3);
    assert.equal(s.machine.x, 0); Sim.release(s); Sim.step(s, .2); assert.equal(s.machine.x, 0);
});
test('travel is bounded to the work area and ignores invalid inputs', () => {
    const s = playing(0, true); Sim.setDrive(s, 1, 1); Sim.step(s, 100);
    assert.equal(s.machine.x, 18); assert.equal(s.machine.z, 16);
    Sim.setDrive(s, NaN, Infinity); assert.ok(Number.isFinite(s.drive.x));
});
test('cuts follow the current bucket and remain after traveling away', () => {
    const s = playing(0, true), first = Sim.bucketPosition(s);
    dig(s); const depth = Sim.groundDepth(s, first.x, first.z);
    assert.ok(depth > .25); assert.equal(Sim.groundDepth(s, -15, -15), 0);
    dump(s); Sim.setDrive(s, 0, 1); Sim.step(s, 3); Sim.setDrive(s, 0, 0);
    const second = Sim.bucketPosition(s); assert.ok(Math.hypot(second.x - first.x, second.z - first.z) > 5);
    assert.equal(Sim.groundDepth(s, first.x, first.z), depth);
    Sim.clearCrew(s); Sim.step(s, 5); dig(s); assert.ok(Sim.groundDepth(s, second.x, second.z) > .25);
    assert.equal(Sim.groundDepth(s, first.x, first.z), depth); assert.equal(s.terrain.cuts, 2);
});
test('digging progressively changes ground and preserves it for the next contract', () => {
    const s = playing(), point = Sim.bucketPosition(s);
    Sim.press(s); Sim.step(s, .6); Sim.release(s); Sim.step(s, .2);
    const partial = Sim.groundDepth(s, point.x, point.z); assert.ok(partial > 0);
    Sim.step(s, 1); assert.ok(Sim.groundDepth(s, point.x, point.z) > partial);
    const next = Sim.createState(1, false, s); assert.equal(next.terrain, s.terrain);
    assert.deepEqual(next.machine, s.machine); assert.notEqual(next.machine, s.machine);
    const restarted = Sim.createState(0); assert.equal(Sim.groundDepth(restarted, point.x, point.z), 0);
});
test('terrain depth is independent of the simulation frame size', () => {
    const a = playing(), b = playing();
    for (const s of [a, b]) { Sim.press(s); Sim.step(s, .6); Sim.release(s); }
    Sim.step(a, .7); for (let i = 0; i < 42; i++) Sim.step(b, 1 / 60);
    const point = Sim.bucketPosition(a);
    assert.ok(Math.abs(Sim.groundDepth(a, point.x, point.z) - Sim.groundDepth(b, point.x, point.z)) < 1e-6);
});

test('aligned forward and reverse keep a stable heading and stop on release', () => {
    const s = playing(0, true);
    Sim.setDrive(s, 1, 0); Sim.step(s, 2); assert.ok(Math.abs(s.machine.x - 4) < 1e-8);
    Sim.setDrive(s, -1, 0); Sim.step(s, 2); assert.ok(Math.abs(s.machine.x) < 1e-8);
    assert.equal(s.machine.z, 0); assert.equal(s.machine.heading, 0);
    Sim.setDrive(s, 0, 0); const stopped = { ...s.machine }; Sim.step(s, 3); assert.deepEqual(s.machine, stopped);
});
test('trench assist makes stable quarter turns and a two-meter reverse step', () => {
    const s = playing(0, true); assert.equal(Sim.turn(s, 1), true); Sim.step(s, .6);
    assert.equal(s.machine.heading, Math.PI / 2); assert.equal(s.machine.x, 0);
    assert.equal(Sim.backUp(s), true); Sim.step(s, 1.2); assert.equal(s.advance, null);
    assert.ok(Math.abs(s.machine.z - 2) < 1e-8); assert.equal(s.machine.heading, Math.PI / 2);
    Sim.turn(s, -1); Sim.step(s, .6); assert.equal(s.machine.heading, 0);
});
test('pipe crew installs and connects a continuous excavated run', () => {
    const s = playing(0, true);
    assert.equal(Sim.startPipeWork(s, 'install'), false);
    function prepareBed() { for (let i = 0; i < 4; i++) { dig(s, 0); dump(s); } }
    prepareBed(); assert.ok(Sim.pipeCandidate(s)); assert.equal(Sim.startPipeWork(s, 'install'), true);
    Sim.setDrive(s, 1, 0); const position = { ...s.machine }; Sim.step(s, .5);
    assert.deepEqual(s.machine, position); assert.equal(Sim.press(s), false);
    Sim.setDrive(s, 0, 0); Sim.step(s, 10); assert.equal(s.utilities.pipes.length, 1);
    assert.equal(Sim.startPipeWork(s, 'install'), false); assert.equal(Sim.press(s), false);
    Sim.clearCrew(s); Sim.step(s, 5); Sim.backUp(s); Sim.step(s, 1.2); assert.ok(Math.abs(s.machine.x + 2) < 1e-8);
    prepareBed(); assert.equal(Sim.startPipeWork(s, 'install'), true); Sim.step(s, 10);
    assert.equal(s.utilities.pipes.length, 2); assert.ok(Sim.connectionCandidate(s));
    assert.equal(Sim.startPipeWork(s, 'connect'), true); Sim.step(s, 10);
    assert.equal(s.utilities.joints.length, 1); assert.equal(Sim.connectionCandidate(s), null);
    const next = Sim.createState(1, false, s); assert.equal(next.utilities.pipes.length, 2);
});
test('pause freezes the pipe crew and travel cannot cross a deep trench', () => {
    const s = playing(0, true);
    for (let i = 0; i < 4; i++) { dig(s, 0); dump(s); }
    Sim.startPipeWork(s, 'install'); Sim.step(s, .3); Sim.pause(s);
    const elapsed = s.utilities.work.elapsed; Sim.step(s, 10); assert.equal(s.utilities.work.elapsed, elapsed);
    Sim.pause(s); Sim.step(s, 10); Sim.clearCrew(s); Sim.step(s, 5); Sim.setDrive(s, 1, 0); Sim.step(s, 10);
    assert.ok(s.machine.x < 4); assert.match(s.message, /Trench ahead/);
});

test('held operation repeats dig/load, rejects repeat resets and stops after release', () => {
    const s = playing(0, true); Sim.setOperateHeld(s, true);
    Sim.step(s, .2); Sim.setOperateHeld(s, true); assert.ok(s.charge > .19);
    Sim.step(s, 6.6); assert.ok(s.digs >= 2); assert.ok(s.truck > 0);
    Sim.setOperateHeld(s, false); const digs = s.digs;
    Sim.step(s, 10); assert.equal(s.digs, digs); assert.equal(s.operateHeld, false);
});
test('focus cancellation and pause clear repeating input without restarting on resume', () => {
    const s = playing(0, true); Sim.setOperateHeld(s, true); Sim.step(s, .2);
    Sim.setOperateHeld(s, false, true); assert.equal(s.phase, 'idle'); assert.equal(s.digs, 0);
    Sim.setOperateHeld(s, true); Sim.step(s, 1); Sim.pause(s);
    const digs = s.digs; Sim.step(s, 10); Sim.pause(s); Sim.step(s, 10);
    assert.equal(s.operateHeld, false); assert.equal(s.digs, digs);
});
test('held cycles honor movement, truck wait, pipe crew and grade limits', () => {
    const s = playing(0, true); Sim.setDrive(s, 0, 1); Sim.setOperateHeld(s, true); Sim.step(s, 1);
    assert.equal(s.digs, 0); Sim.setDrive(s, 0, 0); Sim.step(s, 20);
    assert.ok(Sim.pipeCandidate(s)); assert.ok(Sim.groundDepth(s, Sim.bucketPosition(s).x, Sim.bucketPosition(s).z) <= .90001);
    Sim.setOperateHeld(s, false); assert.equal(Sim.startPipeWork(s, 'install'), true);
    Sim.setOperateHeld(s, true); const digs = s.digs; Sim.step(s, 10); assert.equal(s.digs, digs);
    Sim.setOperateHeld(s, false); Sim.clearCrew(s); Sim.step(s, 5); s.bucket = 2; s.truckState = 'returning';
    Sim.setOperateHeld(s, true); Sim.step(s, .5); assert.equal(s.bucket, 2); assert.equal(s.phase, 'idle');
    Sim.step(s, 6); assert.equal(s.bucket, 0);
});
test('payload equals measured terrain volume times the material density throughout a cut', () => {
    for (const region of Sim.REGIONS) {
        const s = Sim.createState(0, true, null, region.id); Sim.start(s);
        Sim.press(s); Sim.step(s, .6); Sim.release(s);
        for (let i = 0; i < 25; i++) {
            Sim.step(s, .07);
            const volume = s.terrain.depths.reduce((sum, depth) => sum + depth, 0) * (Sim.TERRAIN.size / Sim.TERRAIN.segments) ** 2;
            assert.ok(Math.abs(volume - s.terrain.volume) < 1e-6);
            assert.ok(Math.abs(volume * s.cut.density - s.terrain.mass) < 1e-6);
            const inCut = s.phase === 'digging' ? s.pendingPayload * s.cut.applied : 0;
            assert.ok(Math.abs(s.terrain.mass - s.bucket - inCut) < 1e-6);
        }
    }
});
test('empty ground cannot create material, and skill timing beats steady auto bites', () => {
    const timed = playing(0, true), auto = playing(0, true); dig(timed);
    Sim.setOperateHeld(auto, true); Sim.step(auto, .7); Sim.setOperateHeld(auto, false); Sim.step(auto, 1);
    assert.equal(auto.bucket, 2); assert.equal(timed.bucket, 2.5); assert.equal(auto.perfect, 0); assert.equal(timed.perfect, 1);
    auto.alignment = false; Sim.setOperateHeld(auto, true); Sim.step(auto, 120);
    const mass = auto.terrain.mass; Sim.step(auto, 30); assert.equal(auto.terrain.mass, mass);
    assert.ok(Math.max(...auto.terrain.depths) <= Sim.TERRAIN.maxDepth + 1e-6);
});
test('foreman rejects shallow and overdeep beds; connected runs stay at the target', () => {
    const s = playing(0, true); assert.match(Sim.trenchStatus(s).message, /shallow/);
    Sim.setOperateHeld(s, true); Sim.step(s, 20); Sim.setOperateHeld(s, false);
    assert.equal(Sim.trenchStatus(s).ready, true); assert.match(Sim.trenchStatus(s).message, /On grade/);
    s.alignment = false; Sim.setOperateHeld(s, true); Sim.step(s, 10); Sim.setOperateHeld(s, false);
    assert.match(Sim.trenchStatus(s).message, /Too deep/); assert.equal(Sim.pipeCandidate(s), null);
});
test('throttle unlocks through distinct on-grade sections and trades speed for fuel', () => {
    const s = playing(0, true); assert.equal(Sim.setThrottle(s, 'boost'), false);
    for (let i = 0; i < 3; i++) {
        Sim.setOperateHeld(s, true); Sim.step(s, 20); Sim.setOperateHeld(s, false);
        if (i < 2) { assert.equal(Sim.backUp(s), true); Sim.step(s, 1.1); }
    }
    assert.equal(s.graded.length, 3); assert.equal(Sim.setThrottle(s, 'boost'), true);
    const eco = playing(0, true), boost = playing(0, true);
    eco.graded = boost.graded = s.graded; Sim.setThrottle(eco, 'eco'); Sim.setThrottle(boost, 'boost');
    assert.ok(Sim.digDuration(boost) < Sim.digDuration(eco));
    for (const job of [eco, boost]) { Sim.press(job); Sim.step(job, .4); }
    assert.ok(boost.fuel > eco.fuel); const fuel = boost.fuel; Sim.pause(boost); Sim.step(boost, 10); assert.equal(boost.fuel, fuel);
});

test('workers inside the swing zone stop cycles until the clear-crew acknowledgment', () => {
    const s = playing(0, true); s.crew[0] = { x: 4.5, z: 0 };
    Sim.setOperateHeld(s, true); Sim.step(s, .5);
    assert.equal(s.safetyStop, true); assert.equal(s.operateHeld, false); assert.equal(s.digs, 0);
    assert.match(s.message, /STOP WORK/); assert.equal(Sim.clearCrew(s), true);
    Sim.step(s, 10); assert.equal(s.safetyStop, false); assert.match(s.message, /All clear/);
    assert.equal(s.operateHeld, false); assert.equal(Sim.press(s), true);
});
test('machine travel stops before reaching a worker', () => {
    const s = playing(0, true); s.crew[0] = { x: 5, z: 0 };
    Sim.setDrive(s, 1, 0); Sim.step(s, 5);
    assert.equal(s.safetyStop, true); assert.ok(s.machine.x < 2);
    assert.ok(Math.hypot(s.crew[0].x - s.machine.x, s.crew[0].z - s.machine.z) > 3.4);
});
test('truck stops before crossing a worker and resumes only after the crew clears', () => {
    const s = playing(0, true); s.truck = 20; s.truckState = 'hauling'; s.crew[0] = { x: 8, z: -6 };
    Sim.step(s, 1); assert.equal(s.safetyStop, true); assert.ok(s.truckPose.x < 6);
    const position = { ...s.truckPose }; Sim.step(s, 2); assert.deepEqual(s.truckPose, position);
    Sim.clearCrew(s); Sim.step(s, 15); assert.equal(s.safetyStop, false); assert.equal(s.truckState, 'waiting');
});
test('exposed pipe and open cuts block hauling; a clear lane remains usable', () => {
    const s = playing(0, true), pipe = { x: 8, z: -6, y: -.7, heading: 0, length: 2 };
    s.utilities.pipes.push(pipe); s.truck = 20; s.truckState = 'hauling'; Sim.step(s, 2);
    assert.equal(s.haulBlocked, true); assert.ok(s.truckPose.x < 5); assert.deepEqual(s.utilities.pipes[0], pipe);
    assert.equal(Sim.truckPathClear(s, {x:0,z:-12}, {x:20,z:-12}), true);
    const cut = playing(0, true); dig(cut);
    const point = Sim.bucketPosition(cut);
    assert.equal(Sim.truckPathClear(cut, {x:point.x-5,z:point.z}, {x:point.x+5,z:point.z}), false);
});
test('pipe installation waits for crew arrival and forbids equipment operation', () => {
    const s = playing(0, true); Sim.setOperateHeld(s, true); Sim.step(s, 20); Sim.setOperateHeld(s, false);
    assert.equal(Sim.startPipeWork(s, 'install'), true); Sim.step(s, 1);
    assert.equal(s.utilities.pipes.length, 0); assert.equal(s.utilities.work.elapsed, 0); assert.equal(Sim.press(s), false);
    Sim.step(s, 12); assert.equal(s.utilities.pipes.length, 1);
});

test('crew drills and field work level the crew from 1 to 10 with real production effects', () => {
    const s = playing(0, true); const oldDuration = Sim.digDuration(s);
    for(let i=0;i<4;i++) { assert.equal(Sim.crewActivity(s, 'operation'), true); assert.equal(Sim.press(s), false); Sim.step(s, 9); }
    assert.equal(Sim.crewLevel(s,'operator'),2); assert.ok(Sim.digDuration(s)<oldDuration);
    Sim.crewActivity(s,'spotting');Sim.step(s,9);assert.ok(s.skills.foreman>0);assert.ok(s.skills.laborer>0);assert.ok(s.skills.joiner>0);
    s.skills.operator=10000;assert.equal(Sim.crewLevel(s,'operator'),10);
});
test('lunch restores energy, pauses with the shift and preserves construction', () => {
    const s=playing(0,true);dig(s);const volume=s.terrain.volume;s.energy=10;
    assert.equal(Sim.crewActivity(s,'lunch'),true);Sim.step(s,2);Sim.pause(s);const elapsed=s.crewActivity.elapsed;
    Sim.step(s,50);assert.equal(s.crewActivity.elapsed,elapsed);Sim.pause(s);Sim.step(s,10);
    assert.equal(s.crewActivity,null);assert.ok(s.energy>99);assert.equal(s.terrain.volume,volume);assert.equal(s.bucket,2.5);
});
