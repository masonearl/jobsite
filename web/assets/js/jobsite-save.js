/* Versioned device saves. Each region/fleet has an independent job and a previous-good backup. */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory(require('./jobsite-sim.js'));
    else root.JobsiteSave = factory(root.JobsiteSim);
})(typeof self !== 'undefined' ? self : this, function (Sim) {
    'use strict';
    const prefix = 'openmud-jobsite-save-v1:';
    function key(region, fleet) { return prefix + region + ':' + fleet; }
    function encode(state, savedAt = Date.now()) {
        const cells = [];
        state.terrain.depths.forEach((depth, index) => { if (depth > 0) cells.push(index, depth); });
        const copy = { ...state, region: state.region.id, fleet: state.fleetId, contract: undefined, _savedAt: undefined,
            terrain: { ...state.terrain, depths: cells }, operateHeld: false, primaryHeld: false, operationQueued: false, operationWait: 0, recovery: null, drive: { x: 0, z: 0 }, steer: 0, advance: null,
            targetHeading: state.machine.heading, status: state.status === 'playing' ? 'paused' : state.status };
        if (copy.phase === 'charging') { copy.phase = 'idle'; copy.charge = 0; }
        return JSON.stringify({ version: state.project ? 2 : 1, savedAt, state: copy });
    }
    function decode(raw, region, fleet) {
        const envelope = JSON.parse(raw);
        if (![1, 2].includes(envelope.version)) throw new Error('Unsupported save version');
        const data = envelope.state;
        if (!data || data.region !== region || data.fleet !== fleet || !Sim.FLEETS[fleet] || !Sim.REGIONS.some(r => r.id === region)) throw new Error('Different job');
        const state = Sim.createState(data.level, data.practice, null, region, fleet);
        const terrain = { ...state.terrain, ...data.terrain, depths: state.terrain.depths };
        const cells = data.terrain?.depths;
        if (!Array.isArray(cells) || cells.length % 2) throw new Error('Invalid terrain');
        for (let i = 0; i < cells.length; i += 2) {
            const index = cells[i], depth = cells[i + 1];
            if (!Number.isInteger(index) || index < 0 || index >= terrain.depths.length || !Number.isFinite(depth) || depth < 0 || depth > Sim.TERRAIN.maxDepth + .001) throw new Error('Invalid cut');
            terrain.depths[index] = depth;
        }
        for (const name of ['bucket', 'truck', 'hauled', 'excavated', 'credits', 'elapsed']) if (!Number.isFinite(data[name]) || data[name] < 0) throw new Error('Invalid totals');
        if (!data.machine || !['x', 'z', 'heading'].every(name => Number.isFinite(data.machine[name]))) throw new Error('Invalid position');
        if (!['ready', 'playing', 'paused', 'won', 'lost'].includes(data.status) || !['idle', 'charging', 'digging', 'swinging', 'dumping', 'returning'].includes(data.phase)) throw new Error('Invalid cycle');
        if (!data.utilities || !Array.isArray(data.utilities.pipes) || !Array.isArray(data.utilities.joints)) throw new Error('Invalid pipe run');
        const restored = { ...state, ...data, _savedAt: envelope.savedAt, region: state.region, fleet: state.fleet, contract: state.contract, terrain, operateHeld: false, primaryHeld: false, operationQueued: false, operationWait: 0, recovery: null, drive: { x: 0, z: 0 }, steer: 0, advance: null, targetHeading: data.machine.heading };
        if (restored.status === 'playing') restored.status = 'paused';
        if (restored.phase === 'charging') { restored.phase = 'idle'; restored.charge = 0; }
        if (restored.phase === 'digging' && (!restored.cut || !Array.isArray(restored.cut.cells))) throw new Error('Invalid active cut');
        if (restored.project) {
            const p = restored.project;
            if (!Array.isArray(p.sections) || p.sections.length !== 6 || !Number.isInteger(p.active) || p.active < 0 || p.active > 5 || !Sim.PROJECT_METHODS[p.method]) throw new Error('Invalid project');
            for (const section of p.sections) {
                if (!['excavate', 'bedding', 'pipe', 'joint', 'inspect', 'fill', 'compact', 'accepted'].includes(section.stage) || !Number.isInteger(section.lift) || section.lift < 0 || section.lift > 4 || ![section.x, section.z, section.machine?.x, section.machine?.z].every(Number.isFinite)) throw new Error('Invalid section');
            }
            for (const value of [...Object.values(p.inventory || {}), ...Object.values(p.costs || {})]) if (!Number.isFinite(value) || value < -1e-5) throw new Error('Invalid project quantities');
            if (!p.inventory || !['pipe', 'bedding', 'fill'].every(key => Number.isFinite(p.inventory[key])) || !p.costs || !['materials', 'plant', 'haul'].every(key => Number.isFinite(p.costs[key])) || !Array.isArray(p.log)) throw new Error('Invalid project records');
            if (p.work && (!Array.isArray(p.work.cells) || p.work.cells.some(cell => !Number.isInteger(cell.index) || cell.index < 0 || cell.index >= terrain.depths.length || !Number.isFinite(cell.depth) || !Number.isFinite(cell.delta)))) throw new Error('Invalid active backfill');
        }
        return restored;
    }
    function read(storage, region, fleet) {
        const id = key(region, fleet);
        let raw;
        try {
            raw = storage.getItem(id);
            if (!raw) return { state: null };
            try { if (JSON.parse(raw).version > 2) return { state: null, blocked: true }; } catch (_) { /* Try the previous-good copy below. */ }
            try { return { state: decode(raw, region, fleet) }; }
            catch (_) {
                const backup = storage.getItem(id + ':backup');
                if (backup) return { state: decode(backup, region, fleet), recovered: true };
                return { state: null, blocked: true };
            }
        } catch (_) { return { state: null, blocked: !!raw, unavailable: true }; }
    }
    function write(storage, state) {
        const id = key(state.region.id, state.fleetId), savedAt = Math.max(Date.now(), (state._savedAt || 0) + 1), value = encode(state, savedAt), old = storage.getItem(id);
        if (old) {
            // Never replace a newer/unreadable save or poison the recovery copy.
            try {
                const current = decode(old, state.region.id, state.fleetId);
                if (current._savedAt !== state._savedAt) throw new Error('Site changed in another tab; reload to resume its save');
                storage.setItem(id + ':backup', old);
            }
            catch (error) {
                if (error.message.startsWith('Site changed')) throw error;
                try { if (JSON.parse(old).version > 2) throw error; } catch (parseError) { if (!(parseError instanceof SyntaxError)) throw parseError; }
                const backup = storage.getItem(id + ':backup');
                if (!backup || storage.getItem(id + ':unreadable')) throw error;
                decode(backup, state.region.id, state.fleetId);
                storage.setItem(id + ':unreadable', old);
            }
        }
        storage.setItem(id, value);
        state._savedAt = savedAt;
    }
    return { key, encode, decode, read, write };
});
