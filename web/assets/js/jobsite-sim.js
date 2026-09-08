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
    function canTravel(s) { return s.status === 'playing' && s.phase === 'idle' && !s.utilities.work && !s.safetyStop && !s.crewActivity && !s.truckRoute.length && !s.recovery && !s.project?.work; }
    function crewLevel(s, role) { return Math.min(10, 1 + Math.floor((s.skills[role] || 0) / 50)); }
    function crewTag(s, role) { return ({ foreman: 'F', operator: 'Operator ', laborer: 'L', joiner: 'PJ' }[role] || role) + crewLevel(s, role); }
    function setPlan(s) {
        const origin = bucketPosition(s), c = Math.cos(s.machine.heading), sn = Math.sin(s.machine.heading);
        let sections = 1;
        while (sections < 6 && Math.abs(s.machine.x - sections * 2 * c) <= 18 && Math.abs(s.machine.z + sections * 2 * sn) <= 16) sections++;
        s.plan = { ...origin, heading: s.machine.heading, sections, depth: PIPE.depth, width: 1.56 * s.fleet.scale };
    }
    function planSections(s) {
        const plan = s.plan, c = Math.cos(plan.heading), sn = Math.sin(plan.heading);
        return Array.from({ length: plan.sections }, (_, i) => {
            const x = plan.x - i * 2 * c, z = plan.z + i * 2 * sn;
            const depths = [-.9, 0, .9].map(offset => groundDepth(s, x + offset * c, z - offset * sn)), depth = Math.min(...depths), max = Math.max(...depths);
            const installed = s.utilities.pipes.some(p => Math.hypot(p.x - x, p.z - z) < .6 && Math.abs(Math.cos(p.heading - plan.heading)) > .95);
            return { x, z, station: i * 2, depth, installed, ready: depth >= PIPE.depth - PIPE.tolerance && max <= PIPE.depth + PIPE.tolerance && max - depth <= .18 };
        });
    }
    function crewActivity(s, type) {
        if (s.status !== 'playing' || s.phase !== 'idle' || s.utilities.work || s.project?.work || s.crewActivity || !['spotting', 'operation', 'lunch'].includes(type)) return false;
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
        const x = .25 + offset, z = s.haulSide * 6, c = Math.cos(s.machine.heading), sn = Math.sin(s.machine.heading);
        return { x: s.machine.x + x * c + z * sn, z: s.machine.z - x * sn + z * c };
    }
    function switchTruckSide(s) {
        if (s.status === 'playing' && s.truckRoute.length) {
            s.truckRoute = []; s.truckParked = true; s.message = 'Truck parked. Reposition the spread, then call Switch truck side again.'; return true;
        }
        if (!canTravel(s) || s.truckState !== 'waiting') return false;
        s.haulSide *= -1; s.truckParked = false;
        const c = Math.cos(s.machine.heading), sn = Math.sin(s.machine.heading);
        const approach = (s.truckPose.x - s.machine.x) * sn + (s.truckPose.z - s.machine.z) * c;
        let end = 14;
        const project = (x, z) => (x - s.machine.x) * c - (z - s.machine.z) * sn;
        for (const pipe of [...s.utilities.pipes, ...s.stockpiles]) end = Math.max(end, project(pipe.x, pipe.z) + pipe.length / 2 + 8);
        const stride = TERRAIN.segments + 1, spacing = TERRAIN.size / TERRAIN.segments;
        s.terrain.depths.forEach((depth, index) => {
            if (depth > .25) end = Math.max(end, project(index % stride * spacing - TERRAIN.size / 2, Math.floor(index / stride) * spacing - TERRAIN.size / 2) + 8);
        });
        s.truckRoute = [[end, approach], [end, s.haulSide * 6], [.25, s.haulSide * 6]].map(([x, z]) => ({ x: s.machine.x + x * c + z * sn, z: s.machine.z - x * sn + z * c }));
        setDrive(s, 0, 0); s.advance = null; s.operateHeld = false;
        s.message = 'Truck changing loading sides via the clear end of the pad. Keep the crew clear.';
        return true;
    }
    function truckPathClear(s, from, to) {
        const distance = Math.hypot(to.x - from.x, to.z - from.z), steps = Math.max(1, Math.ceil(distance / .4));
        const heading = s.truckRoute.length > 1 ? s.truckHeading : s.machine.heading, c = Math.cos(heading), sn = Math.sin(heading);
        const pipes = [...s.utilities.pipes.filter(p => !p.buried), ...s.stockpiles];
        const overlap = pipes.map(pipe => truckPipeOverlap(from.x, from.z, heading, pipe));
        for (let step = 0; step <= steps; step++) {
            const x = from.x + (to.x - from.x) * step / steps, z = from.z + (to.z - from.z) * step / steps;
            for (const dx of [-3, -1, 1, 3, 4.4]) for (const dz of [-1.35, 0, 1.35]) {
                const px = x + dx * c + dz * sn, pz = z - dx * sn + dz * c;
                if (groundDepth(s, px, pz) > .25) return false;
            }
            for (let i = 0; i < pipes.length; i++) {
                const depth = truckPipeOverlap(x, z, heading, pipes[i]);
                // Older saves may have a truck inside formerly decorative stock. Allow only a steadily receding exit.
                if (step && depth > 0 && (overlap[i] === 0 || depth >= overlap[i] - 1e-6)) return false;
                overlap[i] = depth;
            }
        }
        return true;
    }
    function truckPipeOverlap(x, z, heading, pipe) {
        const a = { x: Math.cos(heading), z: -Math.sin(heading) }, b = { x: -a.z, z: a.x };
        const p = { x: Math.cos(pipe.heading), z: -Math.sin(pipe.heading) }, q = { x: -p.z, z: p.x };
        const dx = x + .7 * a.x - pipe.x, dz = z + .7 * a.z - pipe.z;
        const dot = (u, v) => Math.abs(u.x * v.x + u.z * v.z);
        let overlap = Infinity;
        for (const axis of [a, b, p, q]) {
            const truckExtent = 3.7 * dot(axis, a) + 1.35 * dot(axis, b);
            const pipeExtent = pipe.length / 2 * dot(axis, p) + (pipe.radius || .18) * dot(axis, q) + .55;
            overlap = Math.min(overlap, truckExtent + pipeExtent - Math.abs(dx * axis.x + dz * axis.z));
        }
        return Math.max(0, overlap);
    }
    function pipeObstacleAt(s, x, z, clearance) {
        for (const list of [s.utilities.pipes.filter(p => !p.buried), s.stockpiles]) for (const pipe of list) {
            const dx = x - pipe.x, dz = z - pipe.z, c = Math.cos(pipe.heading), sn = Math.sin(pipe.heading), half = pipe.length / 2;
            const along = Math.max(-half, Math.min(half, dx * c - dz * sn));
            if (Math.hypot(dx - along * c, dz + along * sn) < clearance + (pipe.radius || .18)) return true;
        }
        return false;
    }
    function moveTruck(s, target, dt) {
        const from = s.truckPose, dx = target.x - from.x, dz = target.z - from.z, distance = Math.hypot(dx, dz);
        s.truckHeading = s.truckRoute.length > 1 && distance > .01 ? Math.atan2(-dz, dx) : s.machine.heading;
        const travel = Math.min(distance, dt * 32), next = { x: from.x + dx / (distance || 1) * travel, z: from.z + dz / (distance || 1) * travel };
        for (const px of [-3, -1, 1, 3, 4.4]) for (const pz of [-1.35, 0, 1.35]) {
            const c = Math.cos(s.truckHeading), sn = Math.sin(s.truckHeading);
            if (s.crew.some(person => Math.hypot(person.x - next.x - px * c - pz * sn, person.z - next.z + px * sn - pz * c) < 1.2)) { stopForCrew(s); return false; }
        }
        if (!truckPathClear(s, from, next)) { s.haulBlocked = true; s.message = 'Haul path blocked by trench or pipe. Switch truck side or move to a clear loading pad.'; return false; }
        s.haulBlocked = false; s.truckPose = next; return true;
    }
    function stopForCrew(s) {
        s.safetyStop = true; s.operateHeld = false; cancelCharge(s); setDrive(s, 0, 0); s.advance = null; s.steer = 0;
        s.targetHeading = s.machine.heading;
        s.message = 'STOP WORK: crew in the equipment zone. Call Clear crew and wait for acknowledgment.';
    }
    function clearCrew(s) {
        if (s.status !== 'playing' || s.utilities.work || s.project?.work) return false;
        s.clearingCrew = true; s.safetyStop = true; s.operateHeld = false; cancelCharge(s); setDrive(s, 0, 0); s.advance = null;
        s.message = 'Operator: Clear the swing area. Crew moving to the safe pad.'; return true;
    }
    function updateCrew(s, dt) {
        const work = s.utilities.work || s.project?.work;
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
            const px = x + (front * c + side * sn) * s.fleet.scale, pz = z + (-front * sn + side * c) * s.fleet.scale;
            if (groundDepth(s, px, pz) > .32 || pipeObstacleAt(s, px, pz, .6)) return false;
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
        if (s.project && !s.project.complete) return false;
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
        const radius = 2 * scale, length = s.project ? Math.max(1.42, 1.3 * scale) : 1.3 * scale, width = .78 * scale;
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
    const PROJECT_STAGES = ['Set out', 'Excavate', 'Formation', 'Bedding', 'Pipe', 'Inspect', 'Backfill', 'Compact', 'Accepted'];
    const PROJECT_METHODS = { careful: { name: 'Careful', duration: 1.25, passes: 2 }, steady: { name: 'Steady', duration: 1, passes: 3 }, fast: { name: 'Fast', duration: .7, passes: 5 } };
    function projectSection(s) { return s.project?.sections[s.project.active] || null; }
    function startProject(s) {
        if (s.project) { if (s.status === 'paused') pause(s); return true; }
        if (s.phase !== 'idle' || s.utilities.work || s.crewActivity) return false;
        let sections = null;
        // Find an intact corridor without deleting a player's previous excavation.
        for (const z of [4, -4, 10, -10, 16, -16]) {
            const candidate = Array.from({ length: 6 }, (_, i) => {
                const machine = { x: 10 - i * 2, z, heading: 0 }, point = bucketPosition({ ...s, machine });
                return { ...point, heading: 0, machine, stage: 'excavate', lift: 0, passes: 0, accepted: false, filled: 0, water: s.region.biome === 'forest' ? .12 : 0 };
            });
            if (candidate.every(p => [-1, 0, 1].every(dx => groundDepth(s, p.x + dx, p.z) < .01) && !cutObstructed(s, p) && stableGround(s, p.machine.x, p.machine.z))) { sections = candidate; break; }
        }
        if (!sections) { s.message = 'No intact 12 m corridor here. Choose another region to start a utility project.'; return false; }
        s.project = { sections, active: 0, checked: false, work: null, delivery: null, method: 'steady', complete: false, elapsed: 0,
            inventory: { pipe: 2, bedding: .8, fill: 2 }, ordered: 0, delivered: 0, materialPlaced: 0, pipeVolume: 0, filledVolume: 0,
            costs: { materials: 360, plant: 0, haul: 0 }, earned: 0, log: [], pumping: false };
        s.practice = true; s.status = 'playing'; s.alignment = true; setOperateHeld(s, false, true); setPrimaryHeld(s, false, true);
        s.machine = { ...sections[0].machine }; s.targetHeading = 0; s.drive = { x: 0, z: 0 }; s.advance = null; s.steer = 0;
        s.haulSide = -1; s.truckRoute = []; s.truckParked = false; s.truckTime = 0; s.truckPose = truckPosition(s); s.truckHeading = 0;
        s.crew = s.crew.map((_, i) => crewHome(s, i)); s.safetyStop = s.clearingCrew = s.haulBlocked = false; s.recovery = null;
        setPlan(s); s.planVisible = false; s.message = 'Utility project: 12 m of pipe, four backfill lifts per section. Space begins the site briefing.';
        return true;
    }
    function setProjectMethod(s, method) {
        const p = s.project, section = projectSection(s);
        if (!p || p.complete || p.work || !PROJECT_METHODS[method] || section?.stage === 'compact' && section.passes > 0) return false;
        p.method = method; return true;
    }
    function projectCost(s) { return s.project ? Object.values(s.project.costs).reduce((a, b) => a + b, 0) : 0; }
    function projectLog(s, message) {
        s.project.log.unshift({ time: s.project.elapsed, station: s.project.active * 2, message });
        s.project.log.length = Math.min(24, s.project.log.length); s.message = message;
    }
    function orderMaterials(s) {
        const p = s.project;
        if (!p || p.complete || p.delivery || s.status !== 'playing') return false;
        p.delivery = { elapsed: 0, duration: s.region.biome === 'forest' ? 16 : s.region.id === 'pilbara' ? 20 : 12 };
        p.costs.materials += 720 * s.region.payout / 100; p.ordered++;
        projectLog(s, 'Materials ordered: six pipe lengths, 2 m3 bedding, 8 m3 selected fill.'); return true;
    }
    function fillCells(s, section, targetDepth) {
        const cells = [], stride = TERRAIN.segments + 1, spacing = TERRAIN.size / TERRAIN.segments, half = TERRAIN.size / 2;
        const length = Math.max(1.42, 1.3 * s.fleet.scale), width = .78 * s.fleet.scale;
        const x0 = Math.max(0, Math.floor((section.x - length + half) / spacing)), x1 = Math.min(TERRAIN.segments, Math.ceil((section.x + length + half) / spacing));
        const z0 = Math.max(0, Math.floor((section.z - width + half) / spacing)), z1 = Math.min(TERRAIN.segments, Math.ceil((section.z + width + half) / spacing));
        for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
            const index = z * stride + x, depth = s.terrain.depths[index];
            if (depth > targetDepth) cells.push({ index, depth, delta: depth - targetDepth });
        }
        return cells;
    }
    function pipeDisplacement(before, after) {
        const r = .18, center = -.62;
        const below = depth => { const y = Math.max(-r, Math.min(r, -depth - center)); return (r * r * (Math.asin(y / r) + Math.PI / 2) + y * Math.sqrt(Math.max(0, r * r - y * y))) * 2; };
        return below(after) - below(before);
    }
    function projectTask(s) {
        const p = s.project, section = projectSection(s);
        if (!p || p.complete) return null;
        if (!p.checked) return 'survey';
        if (!section) return 'handover';
        if (Math.hypot(s.machine.x - section.machine.x, s.machine.z - section.machine.z) > .05) return 'align';
        if (section.accepted) return p.active === p.sections.length - 1 ? 'handover' : 'advance';
        if (s.bucket) return 'load';
        if (section.stage === 'excavate') return !trenchStatus(s).ready && trenchStatus(s).min < PIPE.depth - .02 ? 'excavate' : section.water > .03 ? 'pump' : 'formation';
        return section.stage;
    }
    function projectAction(s) {
        const p = s.project, section = projectSection(s), task = projectTask(s);
        const labels = { survey: 'Set out and check site', excavate: 'Excavate to formation', load: 'Load spoil truck', pump: 'Pump standing water', formation: 'Inspect formation', bedding: 'Place bedding', pipe: 'Set 2 m pipe', joint: 'Connect pipe joint', inspect: 'Inspect pipe before cover', fill: 'Place backfill lift', compact: 'Compact current lift', align: 'Return to set-out station', advance: 'Move to next station', handover: 'Hand over completed line' };
        if (p?.work) return p.work.type === 'compact' ? 'Compacting lift ' + (section.lift + 1) : labels[p.work.type] + '...';
        return labels[task] || 'Project complete';
    }
    function startProjectWork(s, type) {
        const p = s.project, section = projectSection(s);
        if (!p || p.work || type !== projectTask(s) || !['survey', 'pump', 'formation', 'bedding', 'pipe', 'joint', 'inspect', 'fill', 'compact', 'handover'].includes(type)) return false;
        if (s.phase !== 'idle' || s.bucket && type !== 'survey' || s.utilities.work || s.crewActivity || s.recovery || s.advance || s.truckRoute.length) return false;
        let cells = [], volume = 0, displacement = 0, material = null;
        if (type === 'bedding' || type === 'fill') {
            const depth = type === 'bedding' ? .8 : Math.max(0, .8 - (section.lift + 1) * .2);
            cells = fillCells(s, section, depth);
            volume = cells.reduce((total, cell) => total + cell.delta, 0) * (TERRAIN.size / TERRAIN.segments) ** 2;
            displacement = type === 'fill' ? pipeDisplacement(.8 - section.lift * .2, depth) : 0;
            material = type === 'bedding' ? 'bedding' : 'fill';
        } else if (type === 'pipe') { material = 'pipe'; volume = 1; }
        const needed = Math.max(0, volume - displacement);
        if (material && p.inventory[material] + 1e-6 < needed) {
            if (!p.delivery) orderMaterials(s);
            s.message = 'Waiting for ' + material + '. Delivery in ' + Math.ceil(p.delivery.duration - p.delivery.elapsed) + ' s. Your action is queued.';
            return false;
        }
        if (material) p.inventory[material] -= needed;
        const duration = ({ survey: 4, pump: 5, formation: 3, bedding: 4, pipe: 4, joint: 3, inspect: 3, fill: 4, compact: 2.5, handover: 4 })[type] * PROJECT_METHODS[p.method].duration;
        p.work = { type, target: { ...section, y: -.62, length: 2 }, elapsed: 0, duration, cells, volume: type === 'pipe' ? 0 : volume, displacement, applied: 0, materialVolume: material && type !== 'pipe' ? needed : 0 };
        s.cut = null; setDrive(s, 0, 0); s.steer = 0; s.safetyStop = s.clearingCrew = false; s.operationQueued = false; s.operateHeld = false;
        projectLog(s, projectAction(s)); return true;
    }
    function stepProject(s, dt, crewReady) {
        const p = s.project; if (!p || p.complete) return;
        p.elapsed += dt; p.costs.plant += dt / 60 * (28 + s.fleet.scale * 9 + (p.pumping ? 4 : 0));
        if (p.delivery) {
            p.delivery.elapsed += dt;
            if (p.delivery.elapsed >= p.delivery.duration) { p.inventory.pipe += 6; p.inventory.bedding += 2; p.inventory.fill += 8; p.delivered++; p.delivery = null; projectLog(s, 'Delivery received. Pipe, bedding and selected fill available.'); }
        }
        const work = p.work, section = projectSection(s); if (!work) return;
        if (crewReady || ['survey', 'pump', 'handover'].includes(work.type)) work.elapsed += dt;
        const progress = Math.min(1, work.elapsed / work.duration), delta = progress - work.applied;
        if (delta > 0 && work.cells.length) {
            for (const cell of work.cells) s.terrain.depths[cell.index] = cell.depth - cell.delta * progress;
            p.filledVolume += work.volume * delta; p.materialPlaced += work.materialVolume * delta; p.pipeVolume += work.displacement * delta;
            s.terrain.revision++; work.applied = progress;
        }
        if (progress < 1) return;
        const type = work.type;
        if (type === 'survey') { p.checked = true; projectLog(s, 'Scenario briefing complete: line set out, utility conflicts reviewed, access and ground controls planned.'); }
        if (type === 'pump') { section.water = 0; p.pumping = true; projectLog(s, 'Standing water removed. Pump remains running for this wet-ground scenario.'); }
        if (type === 'formation') { section.stage = 'bedding'; section.formation = trenchStatus(s).min; projectLog(s, 'Formation checked before bedding.'); }
        if (type === 'bedding') { section.stage = 'pipe'; section.bedded = true; projectLog(s, 'Bedding placed. Pipe stock is ready for the next operation.'); }
        if (type === 'pipe') {
            section.pipeIndex = s.utilities.pipes.length; s.utilities.pipes.push({ x: section.x, z: section.z, y: -.62, heading: 0, length: 2, buried: false });
            section.stage = p.active ? 'joint' : 'inspect'; projectLog(s, '2 m pipe set on the prepared bedding.');
        }
        if (type === 'joint') {
            const a = p.sections[p.active - 1], b = section;
            s.utilities.joints.push({ key: a.pipeIndex + ':' + b.pipeIndex, x: (a.x + b.x) / 2, z: b.z, y: -.62, heading: 0 });
            section.stage = 'inspect'; projectLog(s, 'Joint connected. Inspection required before covering.');
        }
        if (type === 'inspect') { section.inspected = true; section.stage = 'fill'; projectLog(s, 'Pre-cover check recorded: bedding, pipe alignment and connection.'); }
        if (type === 'fill') { section.stage = 'compact'; section.passes = 0; section.filled = .2 * (section.lift + 1); projectLog(s, 'Lift ' + (section.lift + 1) + ' placed. Compact before adding another lift.'); }
        if (type === 'compact') {
            section.passes++;
            const required = PROJECT_METHODS[p.method].passes + (s.region.biome === 'forest' ? 1 : 0);
            if (section.passes >= required) {
                section.lift++; section.stage = section.lift === 4 ? 'accepted' : 'fill';
                if (section.lift === 4) { section.accepted = true; s.utilities.pipes[section.pipeIndex].buried = true; p.earned += 600; s.skills.joiner += 12; projectLog(s, 'Station ' + p.active * 2 + '-' + (p.active * 2 + 2) + ' m accepted. Four lifts completed.'); }
                else projectLog(s, 'Lift compacted. Ready for the next layer.');
            } else projectLog(s, 'Compaction pass ' + section.passes + ' / ' + required + ' on lift ' + (section.lift + 1) + '.');
        }
        if (type === 'handover') { p.complete = true; s.status = 'won'; s.event++; projectLog(s, '12 m line handed over. Six inspections and 24 compacted lifts recorded.'); }
        p.work = null; s.cut = null;
    }
    function serviceProject(s) {
        const p = s.project, section = projectSection(s), task = projectTask(s);
        if (!p || p.complete) return false;
        if (p.work) return true;
        if (task === 'align') { if (s.phase === 'idle' && !s.recovery) s.advance = { ...section.machine }; return true; }
        if (task === 'advance') {
            if (s.phase !== 'idle' || s.advance || s.recovery) return true;
            p.active++; s.advance = { ...projectSection(s).machine }; s.message = 'Moving one pipe length along the set-out line.'; return true;
        }
        if (task === 'excavate' || task === 'load') return false;
        startProjectWork(s, task); return true;
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
            _savedAt: previous?._savedAt, project: previous?.project || null,
            status: 'ready', phase: 'idle', phaseTime: 0, elapsed: 0, charge: 0,
            bucket: (previous?.bucket || 0) + (previous?.phase === 'digging' ? previous.pendingPayload * previous.cut.applied : 0), truck: previous?.truck || 0, truckState: previous?.truckState || 'waiting', truckTime: previous?.truckTime || 0,
            hauled: 0, excavated: 0, digs: 0, perfect: 0, streak: 0, bestStreak: 0,
            machine: previous ? { ...previous.machine } : { x: 0, z: 0, heading: 0 },
            drive: { x: 0, z: 0 }, terrain: previous?.terrain || createTerrain(), cut: null,
            targetHeading: previous?.machine.heading || 0, steer: 0, alignment: true, advance: null, operateHeld: false,
            primaryHeld: false, operationQueued: false, operationWait: 0, recovery: null,
            utilities: previous?.utilities || { pipes: [], joints: [], work: null },
            crew: previous?.crew || Array.from({ length: 3 }, (_, i) => ({ x: -4.5 - i * .8, z: 8 })), safetyStop: previous?.safetyStop || false, clearingCrew: previous?.clearingCrew || false,
            truckPose: previous?.truckPose ? { ...previous.truckPose } : { x: .25, z: -6 }, haulBlocked: previous?.haulBlocked || false,
            stockpiles: previous?.stockpiles || Array.from({ length: 3 }, (_, i) => ({ x: -7 - i, z: -6, heading: Math.PI / 2, length: 4.5, radius: .42 })),
            haulSide: previous?.haulSide || -1, truckRoute: previous?.truckRoute || [], truckHeading: previous?.truckHeading || 0, truckParked: previous?.truckParked || false,
            skills: previous?.skills ? { ...previous.skills } : { foreman: 0, operator: 0, laborer: 0, joiner: 0, spotting: 0 }, energy: previous?.energy ?? 100, crewActivity: previous?.crewActivity || null,
            plan: previous?.plan || { x: 5 * fleet.scale, z: -.38 * fleet.scale, heading: 0, sections: 6, depth: PIPE.depth, width: 1.56 * fleet.scale }, planVisible: previous?.planVisible || false,
            graded: previous?.graded || [], throttle: previous?.throttle || 'work', fuel: previous?.fuel || 0, history: previous?.history || [],
            credits: previous ? previous.credits : 0,
            upgrades: previous ? { ...previous.upgrades } : { bucket: false, dispatch: false },
            lastQuality: '', lastPayload: 0, pendingPayload: 0, biteSoil: 'earth',
            event: 0, message: 'Space digs, loads, and moves to the next cut. Hold to keep working; release to stop.'
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
        if (s.project && !s.project.complete && !['excavate', 'load'].includes(projectTask(s))) return false;
        if (s.status !== 'playing' || s.phase !== 'idle' || s.utilities.work || s.crewActivity || s.recovery || s.advance || s.drive.x || s.drive.z || s.steer || Math.abs(s.targetHeading - s.machine.heading) > .02) return false;
        if (s.safetyStop) return false;
        if (s.crew.some(person => Math.hypot(person.x - s.machine.x, person.z - s.machine.z) < 6.8 * s.fleet.scale)) { stopForCrew(s); return false; }
        const point = bucketPosition(s);
        if (!s.bucket && s.stockpiles.some(pipe => Math.abs(point.x - pipe.x) < 1 && Math.abs(point.z - pipe.z) < 2.8)) { s.message = 'Stored pipe at the bucket. Move the cut clear of the stockpile.'; return false; }
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
    // The primary action keeps player intent across recoverable stops. Low-level
    // press/release remain available for deliberate, manually timed operation.
    function cutObstructed(s, point) {
        return s.utilities.pipes.some(p => Math.hypot(p.x - point.x, p.z - point.z) < 1.4)
            || pipeObstacleAt({ ...s, utilities: { pipes: [] } }, point.x, point.z, .9);
    }
    function availableCut(s) {
        const point = bucketPosition(s);
        if (cutObstructed(s, point)) return false;
        if (s.alignment && trenchStatus(s).min >= PIPE.depth - .02) return false;
        return planCut(s, { ...point, heading: s.machine.heading }, bucketCapacity(s)) >= .001;
    }
    function loadingSide(s) {
        for (const side of [s.haulSide, -s.haulSide]) {
            const probe = { ...s, haulSide: side, truckRoute: [], truckState: 'waiting' }, pad = truckPosition(probe);
            const exit = { x: pad.x + 38 * Math.cos(s.machine.heading), z: pad.z - 38 * Math.sin(s.machine.heading) };
            if ([...s.stockpiles, ...s.utilities.pipes.filter(p => !p.buried)].some(p => truckPipeOverlap(pad.x, pad.z, s.machine.heading, p) > 0)) continue;
            if (truckPathClear(probe, pad, exit)) return side;
        }
        return 0;
    }
    function recoveryPad(s, moveMachine) {
        if (!moveMachine) {
            const side = loadingSide(s);
            if (side) return { machine: { ...s.machine }, side };
        }
        const positions = [];
        for (let x = -18; x <= 18; x += 2) for (let z = -16; z <= 16; z += 2) positions.push({ x, z });
        positions.sort((a, b) => Math.hypot(a.x - s.machine.x, a.z - s.machine.z) - Math.hypot(b.x - s.machine.x, b.z - s.machine.z));
        for (const position of positions) for (const heading of [s.machine.heading, 0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
            const machine = { ...position, heading }, probe = { ...s, machine };
            if (!stableGround(probe, position.x, position.z) || !availableCut(probe)) continue;
            const side = loadingSide(probe);
            if (side) return { machine, side };
        }
        return null;
    }
    function startRecovery(s, moveMachine) {
        const pad = recoveryPad(s, moveMachine);
        if (!pad) { s.operationQueued = false; s.primaryHeld = false; s.message = 'This pad is worked out. Choose another region on the world map.'; return false; }
        // Recovery can interrupt a stuck cycle. Keep only the soil already removed,
        // so resetting equipment neither refills the ground nor duplicates a load.
        if (s.phase === 'digging') { const removed = s.pendingPayload * s.cut.applied; s.bucket += removed; s.excavated += removed; }
        s.phase = 'idle'; s.phaseTime = 0; s.charge = 0; s.pendingPayload = 0; s.cut = null;
        s.recovery = { ...pad, elapsed: 0, duration: 1.5 };
        s.operationWait = 0;
        setDrive(s, 0, 0); s.advance = null; s.steer = 0; s.operateHeld = false;
        s.message = moveMachine ? 'Recovery crew moving the spread to fresh ground. Existing cuts and pipe stay in place.' : 'Recovery crew resetting the haul unit on a clear loading lane. Payload stays on board.';
        return true;
    }
    function nextCut(s) {
        const target = { x: s.machine.x - 2 * Math.cos(s.machine.heading), z: s.machine.z + 2 * Math.sin(s.machine.heading) };
        const probe = { ...s, machine: { ...s.machine, ...target } };
        let clear = Math.abs(target.x) <= 18 && Math.abs(target.z) <= 16;
        for (let i = 1; clear && i <= 10; i++) clear = stableGround(s, s.machine.x + (target.x - s.machine.x) * i / 10, s.machine.z + (target.z - s.machine.z) * i / 10);
        if (clear && availableCut(probe)) {
            // A parked or canceled truck route must not prevent the next cut.
            s.truckRoute = []; s.truckParked = false;
            return backUp(s);
        }
        return startRecovery(s, true);
    }
    function servicePrimary(s, dt = 0) {
        if (s.status !== 'playing' || !(s.primaryHeld || s.operationQueued) || s.recovery) return;
        if (s.project?.work) return;
        if (s.project && !s.utilities.work && !['excavate', 'load', 'advance', 'align'].includes(projectTask(s)) && s.phase === 'idle' && !s.advance && !s.crewActivity) { serviceProject(s); return; }
        if (s.utilities.work || s.crewActivity) { s.operationWait = 0; s.message = 'Next action queued. Waiting for the crew to finish.'; return; }
        // A crew/truck overlap can repeatedly trigger the same stop even after
        // everyone reaches their waiting spot. Bound that wait with arcade recovery.
        s.operationWait = s.safetyStop || s.phase === 'idle' && !s.advance ? s.operationWait + dt : 0;
        if (s.operationWait >= 8) { startRecovery(s, false); return; }
        if (s.safetyStop || s.crew.some(p => Math.hypot(p.x - s.machine.x, p.z - s.machine.z) < 6.8 * s.fleet.scale)) {
            if (!s.clearingCrew) clearCrew(s);
            s.message = 'Next action queued. Crew clearing the equipment zone.';
            return;
        }
        if (s.phase !== 'idle' || s.advance || Math.abs(s.targetHeading - s.machine.heading) > .02) return;
        if (s.haulBlocked || s.truckParked) { startRecovery(s, false); return; }
        if (s.truckRoute.length) { s.message = 'Next action queued. Truck moving to the loading side.'; return; }
        if (serviceProject(s)) return;
        if (!s.bucket && !availableCut(s)) { nextCut(s); return; }
        if (s.bucket && s.truckState !== 'waiting') { s.message = 'Load queued. Waiting for the haul unit to return.'; return; }
        if (press(s)) {
            s.operationQueued = false; s.operationWait = 0;
            s.operateHeld = s.primaryHeld;
            // A tap made during a cycle is one queued action, never a latched hold.
            if (!s.primaryHeld && s.phase === 'charging') release(s, true);
        }
    }
    function setPrimaryHeld(s, held, cancel = false) {
        if (!s) return;
        if (held) {
            if (s.status === 'ready') start(s);
            if (s.status === 'paused') pause(s);
            if (s.status !== 'playing' || s.primaryHeld) return;
            s.primaryHeld = true; s.operationQueued = true;
            setDrive(s, 0, 0); s.steer = 0;
            servicePrimary(s);
            if (s.operationQueued && !s.recovery && s.phase !== 'idle') s.message = 'Next action queued. The current cycle will finish first.';
        } else {
            const wasHeld = s.primaryHeld;
            s.primaryHeld = false; s.operateHeld = false;
            if (cancel) { s.operationQueued = false; s.operationWait = 0; cancelCharge(s); }
            else if (wasHeld && s.phase === 'charging') release(s);
        }
    }
    function primaryAction(s) {
        if (s.status === 'paused') return 'Resume shift';
        if (s.status === 'ready') return 'Start shift';
        if (s.status === 'lost') return 'New shift / keep site';
        if (s.status === 'won') return s.level === 2 ? 'Choose next site' : 'Next contract';
        if (s.recovery) return 'Recovering spread...';
        if (s.project?.work) return projectAction(s);
        if (s.safetyStop) return s.clearingCrew ? 'Crew clearing...' : 'Clear crew and continue';
        if (s.utilities.work || s.crewActivity) return s.operationQueued ? 'Next action queued' : 'Queue next action';
        if (s.phase === 'charging') return 'Release to dig';
        if (s.phase !== 'idle') return s.operationQueued ? 'Next action queued' : 'Cycling...';
        if (s.advance) return 'Moving to next cut...';
        if (Math.abs(s.targetHeading - s.machine.heading) > .02) return 'Turning...';
        if (s.haulBlocked || s.truckParked) return 'Recover truck and continue';
        if (s.truckRoute.length) return 'Queue next action';
        if (s.bucket) return s.truckState === 'waiting' ? 'Load truck' : 'Queue load';
        if (s.project && !s.project.complete) return projectAction(s);
        const point = bucketPosition(s);
        if (cutObstructed(s, point) || s.alignment && trenchStatus(s).min >= PIPE.depth - .02 || groundDepth(s, point.x, point.z) >= TERRAIN.maxDepth - .02) return 'Continue to next cut';
        return 'Hold to dig';
    }
    function pause(s) {
        if (s.status === 'playing') { setPrimaryHeld(s, false, true); setOperateHeld(s, false, true); cancelCharge(s); setDrive(s, 0, 0); s.advance = null; s.steer = 0; s.targetHeading = s.machine.heading; s.status = 'paused'; }
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
            stepProject(s, d, crewReady);
            if (s.recovery) {
                s.recovery.elapsed += d;
                if (s.recovery.elapsed >= s.recovery.duration) {
                    s.machine = { ...s.recovery.machine }; s.targetHeading = s.machine.heading; s.haulSide = s.recovery.side;
                    s.truckTime = 0; s.truckRoute = []; s.truckParked = false; s.truckHeading = s.machine.heading; s.truckPose = truckPosition(s);
                    s.crew = s.crew.map((_, i) => crewHome(s, i)); s.safetyStop = false; s.clearingCrew = false; s.haulBlocked = false;
                    s.recovery = null; s.message = 'Recovery complete. Spread ready; site progress preserved.';
                }
            }
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
            if (!s.utilities.work && !s.project?.work && !s.clearingCrew) {
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
                else { s.advance = null; setDrive(s, 0, 0); s.message = 'Trench or pipe ahead. Reverse to keep the tracks on clear, firm ground.'; }
                if (s.advance && length <= speed * d) { s.advance = null; s.message = 'Aligned for the next section. Hold Space to dig.'; }
            }
            const target = s.truckRoute[0] || (s.truckParked ? s.truckPose : truckPosition(s, s.truckTime + d));
            const truckCanMove = !s.safetyStop && !s.recovery && !s.project?.work && moveTruck(s, target, d);
            if (s.truckRoute.length && Math.hypot(s.truckPose.x - target.x, s.truckPose.z - target.z) < .05) s.truckRoute.shift();
            if (truckCanMove && !s.truckRoute.length && s.truckState !== 'waiting') {
                s.truckTime += d;
                if (s.truckState === 'hauling' && s.truckTime >= 1.6) {
                    s.truckState = 'returning'; s.truckTime = 0; s.truck = 0;
                } else if (s.truckState === 'returning' && s.truckTime >= haulDuration(s)) {
                    s.truckState = 'waiting'; s.truckTime = 0;
                    s.message = s.bucket > 0 ? 'Truck on the pad. Press LOAD.' : 'Truck on the pad. Take your next bite.';
                }
            }
            servicePrimary(s, d);
            if (s.operateHeld && !s.primaryHeld && s.phase === 'idle') press(s);
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
                        if (s.project) s.project.costs.haul += 35 * s.region.payout / 100;
                        s.truckState = 'hauling'; s.truckTime = 0;
                        s.message = s.fleet.capacity + ' tonnes dispatched. +$' + s.region.payout + '. Next truck inbound.';
                    } else s.message = 'Load placed. ' + s.truck.toFixed(1) + ' / ' + s.fleet.capacity + ' t.';
                } else if (s.phase === 'returning' && s.phaseTime >= .65) {
                    s.phase = 'idle'; s.phaseTime = 0;
                }
            }
            if (!s.practice && s.hauled >= s.contract.target) { s.status = 'won'; s.event++; }
            else if (!s.practice && s.elapsed >= s.contract.seconds) { s.elapsed = s.contract.seconds; s.status = 'lost'; cancelCharge(s); s.event++; }
            if (s.status !== 'playing') { s.operateHeld = false; s.primaryHeld = false; s.operationQueued = false; s.history.push({ level: s.level, result: s.status, hauled: s.hauled, elapsed: s.elapsed }); }
        }
    }
    return { PROJECT_STAGES, PROJECT_METHODS, projectSection, startProject, projectCost, setProjectMethod, orderMaterials, projectTask, projectAction, startProjectWork, REGIONS, FLEETS, SOILS, CONTRACTS, TERRAIN, PIPE, THROTTLES, engine, setThrottle, crewLevel, crewTag, crewActivity, crewHome, truckPosition, truckPathClear, switchTruckSide, clearCrew, setPlan, planSections, regionById, soil, bucketCapacity, bucketPosition, groundDepth, setDrive, canTravel, turn, backUp, trenchStatus, pipeCandidate, connectionCandidate, startPipeWork, digDuration, haulDuration, timingPeriod, createState, start, press, release, cancelCharge, setOperateHeld, setPrimaryHeld, primaryAction, pause, buy, step, meter };
});
