/* Pure arcade simulation. Regional presets are game scenarios, not geotechnical data. */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.JobsiteSim = factory();
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';
    const FLEETS = {
        utility: { name: 'Utility spread', machine: '30 t crawler excavator', truck: '20 t highway tipper', bucket: 2.5, capacity: 20, speed: 1, color: '#d5a02b', width: 1, scale: .95, truckType: 'highway' },
        earthmover: { name: 'Earthmoving spread', machine: '40 t wide-track excavator', truck: '25 t articulated hauler', bucket: 4, capacity: 25, speed: 1.15, color: '#dab03b', width: 1.25, scale: 1.07, truckType: 'articulated' },
        quarry: { name: 'Quarry spread', machine: '50 t reinforced excavator', truck: '30 t rigid off-road truck', bucket: 5, capacity: 30, speed: 1.35, color: '#df862e', width: 1.15, scale: 1.16, truckType: 'quarry' }
    };
    const SOILS = {
        earth: { name: 'Common earth', resistance: 1, window: [.65, .88], color: '#897151', density: 1.8, tooth: 'General-purpose bucket' },
        clay: { name: 'Wet clay', resistance: 1.25, window: [.64, .84], color: '#675546', density: 1.7, tooth: 'Heavy-duty bucket' },
        sand: { name: 'Loose sand', resistance: .8, window: [.56, .91], color: '#bfa377', density: 1.6, tooth: 'Wide grading bucket' },
        gravel: { name: 'Dense gravel', resistance: 1.15, window: [.66, .86], color: '#817866', density: 1.9, tooth: 'General-purpose bucket' },
        basalt: { name: 'Fractured basalt', resistance: 1.55, window: [.71, .85], color: '#4a4b47', density: 2.2, tooth: 'Reinforced rock bucket' }
    };
    const REGIONS = [
        { id: 'utah', name: 'Wasatch foothills', country: 'Utah, United States', lat: 40.65, lon: -111.9, biome: 'mountain', fleet: 'utility', layers: ['earth', 'gravel', 'clay'], weather: 'Dry / late afternoon', haul: 3.6, payout: 100, time: 1, description: 'Open a utility corridor at the foot of the Wasatch. Easy access, then denser material beneath the surface.' },
        { id: 'vancouver', name: 'Coastal access road', country: 'British Columbia, Canada', lat: 49.7, lon: -123.15, biome: 'forest', fleet: 'earthmover', layers: ['earth', 'clay', 'gravel'], weather: 'Overcast / wet ground', haul: 5.2, payout: 135, time: 1.25, description: 'Cut an access road through a damp forest clearing. Wide tracks and articulated hauling suit the soft pad.' },
        { id: 'dubai', name: 'Desert expansion', country: 'Dubai, United Arab Emirates', lat: 24.95, lon: 55.4, biome: 'desert', fleet: 'earthmover', layers: ['sand', 'sand', 'gravel'], weather: 'Clear / dry heat', haul: 4.4, payout: 115, time: 1, description: 'Strip sand for a new development. Full buckets come easily; long haul routes reward a second truck.' },
        { id: 'iceland', name: 'Volcanic road cut', country: 'Reykjanes, Iceland', lat: 63.95, lon: -22.3, biome: 'volcanic', fleet: 'quarry', layers: ['gravel', 'basalt', 'basalt'], weather: 'Cool / coastal overcast', haul: 4.8, payout: 165, time: 1.5, description: 'Work through fractured volcanic material. A reinforced bucket and slower, deliberate bites keep production moving.' },
        { id: 'pilbara', name: 'Outback haul road', country: 'Western Australia', lat: -22.3, lon: 118.5, biome: 'desert', fleet: 'quarry', layers: ['sand', 'gravel', 'basalt'], weather: 'Hot / exposed ground', haul: 5.8, payout: 155, time: 1.3, description: 'Build a remote haul-road cut. Large iron moves volume, but harder layers and distance challenge the spread.' },
        { id: 'andes', name: 'Andean foothill cut', country: 'Central Chile', lat: -33.45, lon: -70.5, biome: 'mountain', fleet: 'earthmover', layers: ['gravel', 'earth', 'basalt'], weather: 'Clear / mountain light', haul: 4.5, payout: 145, time: 1.3, description: 'Develop a mountain access bench. Changing layers call for different timing as the excavation deepens.' }
    ];
    const CONTRACTS = [
        { name: 'First cut', target: 40, seconds: 100 },
        { name: 'Bulk excavation', target: 80, seconds: 185 },
        { name: 'Final formation', target: 120, seconds: 275 }
    ];
    const regionById = id => REGIONS.find(r => r.id === id) || REGIONS[0];
    const TERRAIN = { size: 56, segments: 224, maxDepth: 2.8 };
    const PIPE = { depth: .9, tolerance: .15, length: 2 };
    function createTerrain() { return { depths: new Float32Array((TERRAIN.segments + 1) ** 2), revision: 0, cuts: 0, volume: 0, mass: 0, dispatched: 0 }; }
    function groundDepth(s, x, z) {
        const n = TERRAIN.segments, step = TERRAIN.size / n;
        const gx = Math.max(0, Math.min(n, (x + TERRAIN.size / 2) / step));
        const gz = Math.max(0, Math.min(n, (z + TERRAIN.size / 2) / step));
        const ix = Math.min(n - 1, Math.floor(gx)), iz = Math.min(n - 1, Math.floor(gz)), u = gx - ix, w = gz - iz;
        const d = s.terrain.depths, i = iz * (n + 1) + ix;
        return (d[i] * (1 - u) + d[i + 1] * u) * (1 - w) + (d[i + n + 1] * (1 - u) + d[i + n + 2] * u) * w;
    }
    function bucketPosition(s) {
        const c = Math.cos(s.machine.heading), sn = Math.sin(s.machine.heading), scale = s.fleet.scale;
        return { x: s.machine.x + (5 * c - .38 * sn) * scale, z: s.machine.z + (-5 * sn - .38 * c) * scale };
    }
    function setDrive(s, x, z) {
        if (!Number.isFinite(x) || !Number.isFinite(z)) return;
        const length = Math.max(1, Math.hypot(x, z));
        s.drive.x = x / length; s.drive.z = z / length;
    }
    function canTravel(s) { return s.status === 'playing' && s.phase === 'idle' && !s.utilities.work && !s.safetyStop && !s.crewActivity; }
    function crewLevel(s, role) { return Math.min(10, 1 + Math.floor((s.skills[role] || 0) / 50)); }
    function crewActivity(s, type) {
        if (s.status !== 'playing' || s.phase !== 'idle' || s.utilities.work || s.crewActivity || !['spotting', 'operation', 'lunch'].includes(type)) return false;
        clearCrew(s); s.crewActivity = { type, elapsed: 0, duration: type === 'lunch' ? 10 : 8 };
        s.message = type === 'lunch' ? 'Foreman: Park the iron. Crew taking lunch on the safe pad.' : 'Foreman: Equipment parked for a crew training drill.';
        return true;
    }
    function crewHome(s, index) {
        const x = -4.5 - index * .8, z = 8, c = Math.cos(s.machine.heading), sn = Math.sin(s.machine.heading);
        return { x: s.machine.x + x * c + z * sn, z: s.machine.z - x * sn + z * c };
    }
    function truckPosition(s, time = s.truckTime) {
        const ease = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
        const offset = s.truckState === 'hauling' ? ease(time / 1.6) * 38 : s.truckState === 'returning' ? (1 - ease(time / haulDuration(s))) * 38 : 0;
        const x = .25 + offset, z = -6, c = Math.cos(s.machine.heading), sn = Math.sin(s.machine.heading);
        return { x: s.machine.x + x * c + z * sn, z: s.machine.z - x * sn + z * c };
    }
    function truckPathClear(s, from, to) {
        const distance = Math.hypot(to.x - from.x, to.z - from.z), steps = Math.max(1, Math.ceil(distance / .4));
        for (let step = 0; step <= steps; step++) {
            const x = from.x + (to.x - from.x) * step / steps, z = from.z + (to.z - from.z) * step / steps;
            for (const [dx, dz] of [[0, 0], [-2, -1.1], [-2, 1.1], [2, -1.1], [2, 1.1], [0, -1.1], [0, 1.1]]) {
                const c = Math.cos(s.machine.heading), sn = Math.sin(s.machine.heading);
                if (groundDepth(s, x + dx * c + dz * sn, z - dx * sn + dz * c) > .25) return false;
            }
            for (const pipe of s.utilities.pipes) {
                const dx = x - pipe.x, dz = z - pipe.z, c = Math.cos(pipe.heading), sn = Math.sin(pipe.heading);
                const along = Math.max(-1, Math.min(1, dx * c - dz * sn));
                if (Math.hypot(dx - along * c, dz + along * sn) < 2.3) return false;
            }
        }
        return true;
    }
    function moveTruck(s, target, dt) {
        const from = s.truckPose, dx = target.x - from.x, dz = target.z - from.z, distance = Math.hypot(dx, dz);
        const travel = Math.min(distance, dt * 32), next = { x: from.x + dx / (distance || 1) * travel, z: from.z + dz / (distance || 1) * travel };
        if (s.crew.some(person => Math.hypot(person.x - next.x, person.z - next.z) < 2.3)) { stopForCrew(s); return false; }
        if (!truckPathClear(s, from, next)) { s.haulBlocked = true; s.message = 'Haul path blocked by open trench or pipe. Move the excavator to a clear loading pad.'; return false; }
        s.haulBlocked = false; s.truckPose = next; return true;
    }
    function stopForCrew(s) {
        s.safetyStop = true; s.operateHeld = false; cancelCharge(s); setDrive(s, 0, 0); s.advance = null; s.steer = 0;
        s.targetHeading = s.machine.heading;
        s.message = 'STOP WORK: crew in the equipment zone. Call Clear crew and wait for acknowledgment.';
    }
    function clearCrew(s) {
        if (s.status !== 'playing' || s.utilities.work) return false;
        s.clearingCrew = true; s.safetyStop = true; s.operateHeld = false; cancelCharge(s); setDrive(s, 0, 0); s.advance = null;
        s.message = 'Operator: Clear the swing area. Crew moving to the safe pad.'; return true;
    }
    function updateCrew(s, dt) {
        const work = s.utilities.work;
        if (!work && !s.clearingCrew) return true;
        let arrived = true;
        s.crew.forEach((person, i) => {
            let target = crewHome(s, i);
            if (work) {
                const p = work.target, along = (i - 1) * .65, side = i === 2 ? 1.4 : .58;
                target = { x: p.x + Math.cos(p.heading) * along + Math.sin(p.heading) * side, z: p.z - Math.sin(p.heading) * along + Math.cos(p.heading) * side };
            }
            let dx = target.x - person.x, dz = target.z - person.z, distance = Math.hypot(dx, dz);
            // Route around the tracks rather than through the undercarriage.
            const rx = person.x - s.machine.x, rz = person.z - s.machine.z, radius = Math.hypot(rx, rz);
            if (radius < 3.6 * s.fleet.scale && dx * rx + dz * rz < 0) {
                const side = Math.sign(rx * (target.z - s.machine.z) - rz * (target.x - s.machine.x)) || 1;
                dx = -rz * side; dz = rx * side;
            }
            const length = Math.hypot(dx, dz) || 1, travel = Math.min(distance, dt * 3.2 * (1 + (crewLevel(s, 'spotting') - 1) * .02));
            person.x += dx / length * travel; person.z += dz / length * travel;
            if (distance > .12) arrived = false;
        });
        if (s.clearingCrew && arrived) { s.clearingCrew = false; s.safetyStop = false; s.skills.spotting += 1; s.message = 'Crew: All clear. On the safe pad. Resume when ready.'; }
        return arrived;
    }
    function turn(s, direction) {
        if (!canTravel(s)) return false;
        s.advance = null;
        s.targetHeading += Math.sign(direction) * Math.PI / 2;
        return true;
    }
    function backUp(s) {
        if (!canTravel(s) || Math.abs(s.targetHeading - s.machine.heading) > .02) return false;
        const x = s.machine.x - Math.cos(s.machine.heading) * 2, z = s.machine.z + Math.sin(s.machine.heading) * 2;
        if (Math.abs(x) > 18 || Math.abs(z) > 16) { s.message = 'Work area boundary. Turn to continue on the pad.'; return false; }
        s.advance = { x, z }; s.message = 'Backing up one pipe length. The trench heading stays aligned.'; return true;
    }
    function stableGround(s, x, z) {
        const c = Math.cos(s.machine.heading), sn = Math.sin(s.machine.heading);
        for (const front of [-1.8, 0, 1.8]) for (const side of [-1.2, 0, 1.2]) {
            if (groundDepth(s, x + (front * c + side * sn) * s.fleet.scale, z + (-front * sn + side * c) * s.fleet.scale) > .32) return false;
        }
        return true;
    }
    function trenchStatus(s) {
        const candidate = { ...bucketPosition(s), heading: s.machine.heading, length: PIPE.length };
        const c = Math.cos(candidate.heading), sn = Math.sin(candidate.heading);
        const depths = [-.9, 0, .9].map(offset => groundDepth(s, candidate.x + c * offset, candidate.z - sn * offset));
        const min = Math.min(...depths), max = Math.max(...depths);
        const installed = s.utilities.pipes.some(p => Math.hypot(p.x - candidate.x, p.z - candidate.z) < 1.5);
        let message = min < PIPE.depth - PIPE.tolerance ? 'Too shallow. Dig another bite toward the 0.90 m bed.' : max > PIPE.depth + PIPE.tolerance ? 'Too deep for this pipe run. Move to fresh ground with trench assist on.' : max - min > .18 ? 'Bed uneven. Keep the machine aligned and finish the high spot.' : 'On grade. Empty the bucket, then install pipe.';
        if (installed) message = 'Pipe set. Back up 2 m to extend the run; connect adjoining sections.';
        return { ...candidate, min, max, installed, ready: !installed && min >= PIPE.depth - PIPE.tolerance && max <= PIPE.depth + PIPE.tolerance && max - min <= .18, message };
    }
    function pipeCandidate(s) {
        const bed = trenchStatus(s);
        return bed.ready ? { x: bed.x, z: bed.z, heading: bed.heading, length: PIPE.length, y: -bed.min + .19 } : null;
    }
    function connectionCandidate(s) {
        const pipes = s.utilities.pipes;
        for (let i = 0; i < pipes.length; i++) for (let j = i + 1; j < pipes.length; j++) {
            const key = i + ':' + j;
            if (s.utilities.joints.some(joint => joint.key === key)) continue;
            const a = pipes[i], b = pipes[j];
            if (Math.abs(Math.cos(a.heading - b.heading)) < .95 || Math.abs(a.y - b.y) > .35) continue;
            for (const endA of [-1, 1]) for (const endB of [-1, 1]) {
                const x1 = a.x + Math.cos(a.heading) * endA, z1 = a.z - Math.sin(a.heading) * endA;
                const x2 = b.x + Math.cos(b.heading) * endB, z2 = b.z - Math.sin(b.heading) * endB;
                if (Math.hypot(x1 - x2, z1 - z2) < .55) return { key, x: (x1 + x2) / 2, z: (z1 + z2) / 2, y: (a.y + b.y) / 2, heading: a.heading };
            }
        }
        return null;
    }
    function startPipeWork(s, type) {
        if (!canTravel(s) || s.bucket > 0 || s.advance || Math.abs(s.targetHeading - s.machine.heading) > .02) return false;
        const target = type === 'install' ? pipeCandidate(s) : type === 'connect' ? connectionCandidate(s) : null;
        if (!target) return false;
        setDrive(s, 0, 0); s.steer = 0;
        s.utilities.work = { type, target, elapsed: 0, duration: type === 'install' ? 3 : 2 };
        s.message = type === 'install' ? 'Pipe crew setting a 2 m section in the cut.' : 'Pipe crew joining the adjacent sections.';
        return true;
    }
    function planCut(s, cut, payload) {
        const n = TERRAIN.segments, step = TERRAIN.size / n, half = TERRAIN.size / 2;
        const c = Math.cos(cut.heading), sn = Math.sin(cut.heading), scale = s.fleet.scale;
        const radius = 2 * scale, length = 1.3 * scale, width = .78 * scale;
        const limit = s.alignment ? PIPE.depth : TERRAIN.maxDepth, cells = [];
        const x0 = Math.max(0, Math.floor((cut.x - radius + half) / step)), x1 = Math.min(n, Math.ceil((cut.x + radius + half) / step));
        const z0 = Math.max(0, Math.floor((cut.z - radius + half) / step)), z1 = Math.min(n, Math.ceil((cut.z + radius + half) / step));
        for (let iz = z0; iz <= z1; iz++) for (let ix = x0; ix <= x1; ix++) {
            const dx = ix * step - half - cut.x, dz = iz * step - half - cut.z;
            const along = Math.abs(dx * c - dz * sn), across = Math.abs(dx * sn + dz * c);
            const edge = Math.max(0, Math.min(1, (length - along) / .28, (width - across) / .18));
            if (!edge) continue;
            const index = iz * (n + 1) + ix;
            const depth = s.terrain.depths[index], available = Math.max(0, limit * edge - depth);
            if (available > 1e-6) cells.push({ index, depth, available, edge });
        }
        // Interior vertex areas integrate the triangular height field exactly. Cuts stay inside the grid boundary.
        const density = soil(s).density, requested = payload / density;
        const volumeAt = height => cells.reduce((total, cell) => total + Math.min(cell.available, height * cell.edge) * step * step, 0);
        let low = 0, high = TERRAIN.maxDepth;
        for (let i = 0; i < 28; i++) { const mid = (low + high) / 2; if (volumeAt(mid) > requested) high = mid; else low = mid; }
        const volume = Math.min(requested, volumeAt(TERRAIN.maxDepth)), correction = volumeAt(low) ? volume / volumeAt(low) : 1;
        cut.cells = cells.map(cell => ({ ...cell, delta: Math.min(cell.available, low * cell.edge) * correction }));
        cut.volume = volume; cut.density = density;
        return cut.volume * density;
    }
    function excavate(s, progress) {
        const cut = s.cut;
        if (!cut || progress <= cut.applied) return;
        const fraction = progress - cut.applied;
        for (const cell of cut.cells) s.terrain.depths[cell.index] = cell.depth + cell.delta * progress;
        cut.applied = progress;
        s.terrain.volume += cut.volume * fraction; s.terrain.mass += s.pendingPayload * fraction;
        s.terrain.revision++;
    }
    function createState(level = 0, practice = false, previous = null, regionId, fleetId) {
        const region = regionById(regionId || previous?.region.id || 'utah');
        const fleetKey = FLEETS[fleetId] ? fleetId : previous?.region.id === region.id ? previous.fleetId : region.fleet;
        const fleet = FLEETS[fleetKey];
        level = Math.min(CONTRACTS.length - 1, Math.max(0, Number.isInteger(level) ? level : 0));
        const base = CONTRACTS[level];
        const contract = { ...base, target: base.target / 20 * fleet.capacity, seconds: Math.round(base.seconds * region.time) };
        return {
            region, fleet, fleetId: fleetKey, level, practice, contract,
            _savedAt: previous?._savedAt,
            status: 'ready', phase: 'idle', phaseTime: 0, elapsed: 0, charge: 0,
            bucket: (previous?.bucket || 0) + (previous?.phase === 'digging' ? previous.pendingPayload * previous.cut.applied : 0), truck: previous?.truck || 0, truckState: previous?.truckState || 'waiting', truckTime: previous?.truckTime || 0,
            hauled: 0, excavated: 0, digs: 0, perfect: 0, streak: 0, bestStreak: 0,
            machine: previous ? { ...previous.machine } : { x: 0, z: 0, heading: 0 },
            drive: { x: 0, z: 0 }, terrain: previous?.terrain || createTerrain(), cut: null,
            targetHeading: previous?.machine.heading || 0, steer: 0, alignment: true, advance: null, operateHeld: false,
            utilities: previous?.utilities || { pipes: [], joints: [], work: null },
            crew: previous?.crew || Array.from({ length: 3 }, (_, i) => ({ x: -4.5 - i * .8, z: 8 })), safetyStop: previous?.safetyStop || false, clearingCrew: previous?.clearingCrew || false,
            truckPose: previous?.truckPose ? { ...previous.truckPose } : { x: .25, z: -6 }, haulBlocked: previous?.haulBlocked || false,
            skills: previous?.skills ? { ...previous.skills } : { foreman: 0, operator: 0, laborer: 0, joiner: 0, spotting: 0 }, energy: previous?.energy ?? 100, crewActivity: previous?.crewActivity || null,
            graded: previous?.graded || [], throttle: previous?.throttle || 'work', fuel: previous?.fuel || 0, history: previous?.history || [],
            credits: previous ? previous.credits : 0,
            upgrades: previous ? { ...previous.upgrades } : { bucket: false, dispatch: false },
            lastQuality: '', lastPayload: 0, pendingPayload: 0, biteSoil: 'earth',
            event: 0, message: 'Hold Space for repeated dig/load cycles. Trench assist stops at the pipe bed.'
        };
    }
    function soil(s) { return SOILS[s.region.layers[Math.min(2, Math.floor(s.excavated / s.contract.target * 3))]]; }
    function bucketCapacity(s) { return s.fleet.bucket * (s.upgrades.bucket ? 1.6 : 1); }
    const THROTTLES = { eco: { rpm: 1200, speed: .82, fuel: 12 }, work: { rpm: 1600, speed: 1, fuel: 19 }, boost: { rpm: 2000, speed: 1.18, fuel: 30 } };
    function engine(s) { return THROTTLES[s.throttle] || THROTTLES.work; }
    function setThrottle(s, value) { if (s.graded.length < 3 || !THROTTLES[value] || s.phase !== 'idle') return false; s.throttle = value; return true; }
    function digDuration(s) { return .7 * s.fleet.speed * SOILS[s.biteSoil].resistance / engine(s).speed / (1 + (crewLevel(s, 'operator') - 1) * .015) * (s.energy < 20 ? 1.12 : 1); }
    function haulDuration(s) { return s.region.haul * (s.upgrades.dispatch ? .4 : 1); }
    function timingPeriod(s) { return 1.6 * (soil(s).resistance > 1.4 ? 1.2 : 1); }
    function start(s) { if (s.status === 'ready') s.status = 'playing'; }
    function meter(s) { const n = (s.charge % timingPeriod(s)) / timingPeriod(s); return n <= .5 ? n * 2 : 2 - n * 2; }
    function press(s) {
        if (s.status !== 'playing' || s.phase !== 'idle' || s.utilities.work || s.crewActivity || s.advance || s.drive.x || s.drive.z || s.steer || Math.abs(s.targetHeading - s.machine.heading) > .02) return false;
        if (s.safetyStop) return false;
        if (s.crew.some(person => Math.hypot(person.x - s.machine.x, person.z - s.machine.z) < 6.8 * s.fleet.scale)) { stopForCrew(s); return false; }
        const point = bucketPosition(s);
        if (!s.bucket && s.utilities.pipes.some(p => Math.hypot(p.x - point.x, p.z - point.z) < 1.4)) { s.message = 'Pipe is installed here. Back up 2 m to extend the trench.'; return false; }
        if (s.bucket > 0) {
            if (s.truckState !== 'waiting') { s.message = 'Truck inbound. Prep the next bite while the haul unit returns.'; return false; }
            const pad = truckPosition(s);
            if (s.haulBlocked || Math.hypot(s.truckPose.x - pad.x, s.truckPose.z - pad.z) > .4) { s.message = 'Wait for a truck on the loading pad. Keep its path clear of pipe and open cuts.'; return false; }
            s.phase = 'swinging'; s.phaseTime = 0; s.message = 'Swinging to the haul unit. Keep the load inside the bed.';
        } else {
            if (s.alignment && trenchStatus(s).min >= PIPE.depth - .02) { s.message = 'At pipe grade. Install pipe or back up 2 m for fresh material.'; return false; }
            s.phase = 'charging'; s.charge = 0; s.message = 'Hold Space to keep cycling, or release for a single bite.';
        }
        setDrive(s, 0, 0);
        return true;
    }
    function release(s, automatic = false) {
        if (s.status !== 'playing' || s.phase !== 'charging') return false;
        const m = meter(s), material = soil(s);
        const perfect = !automatic && m >= material.window[0] && m <= material.window[1];
        const position = bucketPosition(s);
        const cut = { ...position, heading: s.machine.heading, applied: 0, depth: groundDepth(s, position.x, position.z) };
        s.pendingPayload = planCut(s, cut, bucketCapacity(s) * (perfect ? 1 : automatic || m >= .4 && m < .98 ? .8 : .5));
        if (s.pendingPayload < .001) { cancelCharge(s); s.operateHeld = false; s.message = 'No material left in this cut. Back up 2 m for the next section.'; return false; }
        s.lastQuality = perfect ? 'Clean bite' : automatic ? 'Steady bite' : m >= .98 ? 'Overworked' : 'Short bucket';
        s.streak = perfect ? s.streak + 1 : 0; s.bestStreak = Math.max(s.bestStreak, s.streak);
        if (perfect) { s.perfect++; s.credits += 10 + Math.min(s.streak, 5) * 2; }
        s.biteSoil = s.region.layers[Math.min(2, Math.floor(s.excavated / s.contract.target * 3))];
        s.phase = 'digging'; s.phaseTime = 0; s.digs++;
        s.cut = cut;
        s.terrain.cuts++;
        s.message = s.lastQuality + '. Cutting ' + material.name.toLowerCase() + '.';
        return true;
    }
    function cancelCharge(s) { if (s.phase === 'charging') { s.phase = 'idle'; s.charge = 0; } }
    function setOperateHeld(s, held, cancel = false) {
        if (!s) return;
        if (held) {
            if (s.status !== 'playing' || s.operateHeld) return;
            s.operateHeld = true; press(s);
        } else {
            const wasHeld = s.operateHeld; s.operateHeld = false;
            if (cancel) cancelCharge(s); else if (wasHeld) release(s);
        }
    }
    function pause(s) {
        if (s.status === 'playing') { setOperateHeld(s, false, true); cancelCharge(s); setDrive(s, 0, 0); s.advance = null; s.steer = 0; s.targetHeading = s.machine.heading; s.status = 'paused'; }
        else if (s.status === 'paused') s.status = 'playing';
    }
    function buy(s, key) {
        const cost = key === 'bucket' ? 200 : key === 'dispatch' ? 150 : Infinity;
        if (s.status !== 'playing' || s.upgrades[key] || s.credits < cost || s.phase !== 'idle') return false;
        s.credits -= cost; s.upgrades[key] = true;
        s.message = key === 'bucket' ? bucketCapacity(s).toFixed(1) + '-tonne bucket fitted.' : 'Second haul unit dispatched. Shorter turnaround.';
        return true;
    }
    function step(s, dt) {
        if (s.status !== 'playing' || !Number.isFinite(dt) || dt <= 0) return;
        let remaining = dt;
        while (remaining > 0 && s.status === 'playing') {
            const d = Math.min(remaining, .05); remaining -= d; s.elapsed += d;
            const working = s.phase !== 'idle' || s.drive.x || s.drive.z || s.advance;
            s.fuel += d / 3600 * engine(s).fuel * (working ? 1 : .25);
            s.energy = Math.max(0, s.energy - d / (working || s.utilities.work ? 6 : 30));
            const crewReady = updateCrew(s, d);
            const activity = s.crewActivity;
            if (activity && !s.clearingCrew) {
                activity.elapsed += d;
                if (activity.elapsed >= activity.duration) {
                    if (activity.type === 'lunch') s.energy = 100;
                    else if (activity.type === 'operation') s.skills.operator += 15;
                    else { s.skills.spotting += 15; for (const role of ['foreman', 'laborer', 'joiner']) s.skills[role] += 15; }
                    s.crewActivity = null; s.message = activity.type === 'lunch' ? 'Crew: Lunch finished. Rested and ready.' : 'Crew drill complete. Experience saved; resume when ready.';
                }
            }
            if (!s.utilities.work && !s.clearingCrew) {
                const traveling = s.drive.x || s.drive.z || s.advance || Math.abs(s.targetHeading - s.machine.heading) > .02;
                const radius = (s.phase !== 'idle' ? 6.8 : traveling ? 3.8 : 0) * s.fleet.scale;
                if (radius && s.crew.some(person => Math.hypot(person.x - s.machine.x, person.z - s.machine.z) < radius)) stopForCrew(s);
                const now = truckPosition(s), next = truckPosition(s, s.truckTime + d);
                if (s.truckState !== 'waiting' && s.crew.some(person => {
                    const dx = next.x - now.x, dz = next.z - now.z, t = Math.max(0, Math.min(1, ((person.x - now.x) * dx + (person.z - now.z) * dz) / (dx * dx + dz * dz || 1)));
                    return Math.hypot(person.x - now.x - dx * t, person.z - now.z - dz * t) < 2.3;
                })) stopForCrew(s);
            }
            const work = s.utilities.work;
            if (work) {
                if (crewReady) work.elapsed += d * (1 + (crewLevel(s, 'joiner') - 1) * .025);
                if (work.elapsed >= work.duration) {
                    if (work.type === 'install') s.utilities.pipes.push(work.target);
                    else s.utilities.joints.push(work.target);
                    s.skills.foreman += 5; s.skills.laborer += 8; s.skills.joiner += 12;
                    s.utilities.work = null;
                    s.message = work.type === 'install' ? 'Pipe set. Back up 2 m, excavate the next section, then connect the joint.' : 'Joint connected. Continue the trench run.';
                }
            }
            if (canTravel(s)) {
                if (!s.alignment) s.targetHeading += s.steer * Math.PI / 2 * d;
                const turn = s.targetHeading - s.machine.heading;
                s.machine.heading += Math.sign(turn) * Math.min(Math.abs(turn), Math.PI * d);
            }
            if (canTravel(s) && Math.abs(s.targetHeading - s.machine.heading) < .02 && (s.drive.x || s.drive.z || s.advance)) {
                const speed = 2 / s.fleet.speed;
                const dx = s.advance ? s.advance.x - s.machine.x : s.drive.x, dz = s.advance ? s.advance.z - s.machine.z : s.drive.z;
                const length = Math.hypot(dx, dz), distance = s.advance ? Math.min(length, speed * d) : speed * d;
                const nx = Math.max(-18, Math.min(18, s.machine.x + dx / (s.advance ? length || 1 : 1) * distance));
                const nz = Math.max(-16, Math.min(16, s.machine.z + dz / (s.advance ? length || 1 : 1) * distance));
                if (stableGround(s, nx, nz)) { s.machine.x = nx; s.machine.z = nz; }
                else { s.advance = null; setDrive(s, 0, 0); s.message = 'Trench ahead. Reverse to keep the tracks on firm ground.'; }
                if (s.advance && length <= speed * d) { s.advance = null; s.message = 'Aligned for the next section. Hold Space to dig.'; }
            }
            const truckCanMove = !s.safetyStop && moveTruck(s, truckPosition(s, s.truckTime + d), d);
            if (truckCanMove && s.truckState !== 'waiting') {
                s.truckTime += d;
                if (s.truckState === 'hauling' && s.truckTime >= 1.6) {
                    s.truckState = 'returning'; s.truckTime = 0; s.truck = 0;
                } else if (s.truckState === 'returning' && s.truckTime >= haulDuration(s)) {
                    s.truckState = 'waiting'; s.truckTime = 0;
                    s.message = s.bucket > 0 ? 'Truck on the pad. Press LOAD.' : 'Truck on the pad. Take your next bite.';
                }
            }
            if (s.operateHeld && s.phase === 'idle') press(s);
            if (!s.safetyStop && s.phase === 'charging') {
                s.charge += d;
                if (s.operateHeld && s.charge >= (soil(s).window[0] + soil(s).window[1]) / 4 * timingPeriod(s)) release(s, true);
            }
            else if (!s.safetyStop && s.phase !== 'idle') {
                s.phaseTime += d * (s.phase === 'digging' ? 1 : engine(s).speed);
                if (s.phase === 'digging') excavate(s, Math.min(1, s.phaseTime / digDuration(s)));
                if (s.phase === 'digging' && s.phaseTime >= digDuration(s)) {
                    s.bucket = s.pendingPayload; s.excavated += s.bucket; s.lastPayload = s.bucket; s.event++;
                    s.skills.operator += s.lastQuality === 'Clean bite' ? 3 : 1;
                    s.phase = 'idle'; s.phaseTime = 0;
                    const bed = trenchStatus(s);
                    if (bed.ready && !s.graded.some(p => Math.hypot(p.x - bed.x, p.z - bed.z) < 1.8)) s.graded.push({ x: bed.x, z: bed.z });
                    s.message = s.lastQuality + ': ' + s.bucket.toFixed(1) + ' t. Press LOAD to swing to the truck.';
                } else if (s.phase === 'swinging' && s.phaseTime >= .8) {
                    s.phase = 'dumping'; s.phaseTime = 0;
                } else if (s.phase === 'dumping' && s.phaseTime >= .45) {
                    const payload = Math.min(s.bucket, s.fleet.capacity - s.truck);
                    s.truck += payload; s.bucket = Math.max(0, s.bucket - payload);
                    s.event++; s.phase = 'returning'; s.phaseTime = 0;
                    if (s.truck >= s.fleet.capacity - .00001) {
                        s.truck = s.fleet.capacity; s.hauled += s.fleet.capacity; s.terrain.dispatched += s.fleet.capacity; s.credits += s.region.payout;
                        s.truckState = 'hauling'; s.truckTime = 0;
                        s.message = s.fleet.capacity + ' tonnes dispatched. +$' + s.region.payout + '. Next truck inbound.';
                    } else s.message = 'Load placed. ' + s.truck.toFixed(1) + ' / ' + s.fleet.capacity + ' t.';
                } else if (s.phase === 'returning' && s.phaseTime >= .65) {
                    s.phase = 'idle'; s.phaseTime = 0;
                }
            }
            if (!s.practice && s.hauled >= s.contract.target) { s.status = 'won'; s.event++; }
            else if (!s.practice && s.elapsed >= s.contract.seconds) { s.elapsed = s.contract.seconds; s.status = 'lost'; cancelCharge(s); s.event++; }
            if (s.status !== 'playing') { s.operateHeld = false; s.history.push({ level: s.level, result: s.status, hauled: s.hauled, elapsed: s.elapsed }); }
        }
    }
    return { REGIONS, FLEETS, SOILS, CONTRACTS, TERRAIN, PIPE, THROTTLES, engine, setThrottle, crewLevel, crewActivity, crewHome, truckPosition, truckPathClear, clearCrew, regionById, soil, bucketCapacity, bucketPosition, groundDepth, setDrive, canTravel, turn, backUp, trenchStatus, pipeCandidate, connectionCandidate, startPipeWork, digDuration, haulDuration, timingPeriod, createState, start, press, release, cancelCharge, setOperateHeld, pause, buy, step, meter };
});
