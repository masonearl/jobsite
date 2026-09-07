/* World selection and input orchestration. The simulation stays independent of WebGL. */
(function () {
    'use strict';
    const Sim = window.JobsiteSim, Save = window.JobsiteSave, $ = id => document.getElementById(id);
    const canvas = $('jobsite-canvas'), app = $('jobsite-app');
    let selected = Sim.REGIONS[0], fleetId = selected.fleet;
    let state = null, scene = null, loading = false, sceneReady = false, onMap = true;
    let last = 0, lastStatus = '', lastSoundEvent = 0, inputSource = null, audio = null, sound = false;
    let onGuide = false, guideFocus = null, guideScroll = 0, expandedView = false, displayPending = false;
    const travelKeys = new Set();
    const jobs = new Map();
    let lastSave = 0, lastHud = 0, lastDraw = 0, storage = null;
    try { storage = window.localStorage; } catch (_) { /* The saved-state indicator explains unavailable storage. */ }
    function clearOperate() { inputSource = null; Sim.setOperateHeld(state, false, true); }
    function saveJob() {
        if (!state) return;
        jobs.set(state.region.id + ':' + state.fleetId, state);
        try { if (!storage) throw new Error('Storage unavailable'); Save.write(storage, state); text('save-status', 'Saved on this device'); }
        catch (error) { text('save-status', error.message.startsWith('Site changed') ? error.message : 'Save unavailable; keep this tab open'); }
        lastSave = performance.now();
    }
    function savedJob(region, fleet) {
        const current = jobs.get(region + ':' + fleet);
        if (current) return { state: current };
        return storage ? Save.read(storage, region, fleet) : { state: null, unavailable: true };
    }
    function beginTravel(code) {
        if (!Sim.canTravel(state)) return;
        state.advance = null;
        if (state.alignment && !travelKeys.has(code) && ['ArrowLeft', 'ArrowRight'].includes(code)) Sim.turn(state, code === 'ArrowLeft' ? 1 : -1);
        travelKeys.add(code);
    }
    function stopTravel() { travelKeys.clear(); if (state) { Sim.setDrive(state, 0, 0); state.steer = 0; } }
    let records = {};
    const STORE = 'openmud-jobsite-world-records-v1';
    try { const recent = JSON.parse(storage?.getItem('openmud-jobsite-last-site-v1') || 'null'); if (recent && Sim.REGIONS.some(r => r.id === recent.region) && Sim.FLEETS[recent.fleet]) { selected = Sim.regionById(recent.region); fleetId = recent.fleet; } } catch (_) { /* Keep the world selector usable if a preference cannot load. */ }
    try { const data = JSON.parse(localStorage.getItem(STORE) || '{}'); if (data && typeof data === 'object' && !Array.isArray(data)) records = data; } catch (_) { /* Device records are optional. */ }
    const text = (id, value) => { if ($(id).textContent !== value) $(id).textContent = value; };
    function clock(sec) { sec = Math.max(0, Math.ceil(sec)); return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0'); }
    function recordKey() { return selected.id + ':' + fleetId; }
    function scrollTop() { app.scrollTop = 0; window.scrollTo(0, 0); }
    function showGuide() {
        if (onGuide) return;
        guideFocus = document.activeElement;
        guideScroll = app.classList.contains('is-immersive') ? app.scrollTop : window.scrollY;
        if (state?.status === 'playing') Sim.pause(state);
        stopTravel();
        clearOperate(); saveJob(); onGuide = true;
        $('world-screen').hidden = $('play-screen').hidden = $('world-toggle').hidden = true;
        $('guide-screen').hidden = false; $('pause-toggle').disabled = true; $('equipment-toggle').hidden = true;
        app.classList.add('is-guide');
        $('guide-toggle').setAttribute('aria-expanded', 'true'); text('guide-toggle', 'Back to game');
        text('guide-return', onMap ? 'Choose a jobsite' : 'Back to your shift');
        history.replaceState(null, '', '#how-to-play');
        scrollTop(); $('guide-title').focus({ preventScroll: true });
    }
    function closeGuide() {
        if (!onGuide) return;
        onGuide = false; $('guide-screen').hidden = true; $('equipment-toggle').hidden = onMap;
        app.classList.remove('is-guide');
        $('world-screen').hidden = !onMap; $('play-screen').hidden = onMap; $('world-toggle').hidden = onMap;
        $('guide-toggle').setAttribute('aria-expanded', 'false'); text('guide-toggle', 'How to play');
        history.replaceState(null, '', location.pathname + location.search);
        lastStatus = ''; hud();
        if (sceneReady && !onMap) scene.resize();
        if (app.classList.contains('is-immersive')) app.scrollTop = guideScroll;
        else window.scrollTo(0, guideScroll);
        (guideFocus?.closest('button') || $('guide-toggle')).focus({ preventScroll: true });
    }
    $('guide-toggle').addEventListener('click', () => onGuide ? closeGuide() : showGuide());
    $('guide-return').addEventListener('click', closeGuide);
    $('guide-return-bottom').addEventListener('click', closeGuide);
    window.addEventListener('hashchange', () => location.hash === '#how-to-play' ? showGuide() : closeGuide());

    const fullscreenElement = () => document.fullscreenElement || document.webkitFullscreenElement;
    function syncDisplay() {
        const native = fullscreenElement() === app, active = native || expandedView;
        app.classList.toggle('is-immersive', active);
        app.classList.toggle('is-expanded', expandedView && !native);
        document.body.classList.toggle('jobsite-expanded', expandedView && !native);
        $('fullscreen-toggle').setAttribute('aria-pressed', String(native));
        text('fullscreen-toggle', native ? 'Exit fullscreen' : 'Fullscreen');
        text('expand-toggle', expandedView ? 'Restore view' : 'Expand game');
        $('expand-toggle').setAttribute('aria-pressed', String(expandedView)); $('expand-toggle').hidden = native;
        if (native || !active) $('display-status').hidden = true;
        if (sceneReady && !onMap && !onGuide) requestAnimationFrame(() => scene.resize());
    }
    async function toggleFullscreen() {
        if (displayPending) return;
        displayPending = true;
        try {
            if (fullscreenElement() === app) {
                const exit = document.exitFullscreen || document.webkitExitFullscreen;
                await exit.call(document);
            } else {
                const enter = app.requestFullscreen || app.webkitRequestFullscreen;
                const enabled = document.fullscreenEnabled ?? document.webkitFullscreenEnabled;
                try {
                    if (!enter || enabled === false) throw new Error('Fullscreen unavailable');
                    await enter.call(app); expandedView = false;
                } catch (_) {
                    // Embedded browsers and phones can restrict element fullscreen.
                    expandedView = true;
                    text('display-status', 'Expanded view is on. This browser does not support fullscreen here. Use Restore view or Esc to return.');
                    $('display-status').hidden = false;
                }
            }
        } catch (_) {
            text('display-status', 'Use Esc or your browser controls to leave fullscreen.');
            $('display-status').hidden = false;
        } finally { displayPending = false; syncDisplay(); }
    }
    $('fullscreen-toggle').addEventListener('click', toggleFullscreen);
    $('equipment-toggle').addEventListener('click', () => { const open = app.classList.toggle('show-equipment'); $('equipment-toggle').setAttribute('aria-expanded', String(open)); });
    $('expand-toggle').addEventListener('click', () => { expandedView = !expandedView; $('display-status').hidden = true; syncDisplay(); scrollTop(); if (state?.status === 'playing') canvas.focus({ preventScroll: true }); });
    document.addEventListener('fullscreenchange', syncDisplay);
    document.addEventListener('webkitfullscreenchange', syncDisplay);
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && fullscreenElement() === app) { e.preventDefault(); toggleFullscreen(); }
        else if (e.key === 'Escape' && expandedView) { expandedView = false; syncDisplay(); $('fullscreen-toggle').focus({ preventScroll: true }); }
    });
    function updateRegion() {
        const n = Sim.REGIONS.indexOf(selected) + 1;
        text('region-number', 'SITE ' + String(n).padStart(2, '0'));
        text('region-country', selected.country); text('region-name', selected.name); text('region-description', selected.description);
        $('region-photo').src = '/assets/jobsite/' + selected.biome + '.jpg'; $('region-photo').alt = selected.name + ' landscape';
        text('region-ground', [...new Set(selected.layers.map(key => Sim.SOILS[key].name))].join(' / '));
        text('region-weather', selected.weather); text('region-payout', '$' + selected.payout + ' per full truck');
        $('fleet-select').value = fleetId;
        const f = Sim.FLEETS[fleetId]; text('fleet-description', f.machine + ' / ' + f.truck + ' / ' + f.bucket + ' t bucket');
        const rec = records[recordKey()]; text('region-record', rec && Number.isFinite(rec.completed) ? rec.completed + ' of 3 contracts completed on this device' : 'Three contracts available');
        document.querySelectorAll('[data-region]').forEach(b => { const active = b.dataset.region === selected.id; b.classList.toggle('selected', active); b.setAttribute('aria-pressed', String(active)); });
        const saved = savedJob(selected.id, fleetId);
        text('mobilize', saved.state ? 'Return to saved site' : 'Mobilize to site');
        if (saved.state) text('region-record', saved.state.terrain.volume.toFixed(1) + ' m3 excavated / ' + saved.state.utilities.pipes.length * 2 + ' m pipe saved');
    }
    for (const [id, f] of Object.entries(Sim.FLEETS)) { const option = document.createElement('option'); option.value = id; option.textContent = f.name + ' / ' + f.capacity + ' t trucks'; $('fleet-select').appendChild(option); }
    for (const region of Sim.REGIONS) {
        const choose = () => { selected = region; fleetId = region.fleet; updateRegion(); };
        const pin = document.createElement('button'); pin.className = 'map-pin'; pin.dataset.region = region.id;
        pin.dataset.label = region.id === 'vancouver' ? 'CANADA' : region.id.toUpperCase(); pin.style.left = ((region.lon + 180) / 360 * 100) + '%'; pin.style.top = ((90 - region.lat) / 180 * 100) + '%';
        pin.setAttribute('aria-label', region.name + ', ' + region.country); pin.addEventListener('click', choose); $('map-pins').appendChild(pin);
        const button = document.createElement('button'); button.className = 'region-button'; button.dataset.region = region.id;
        const title = document.createElement('span'), detail = document.createElement('small'); title.textContent = region.name; detail.textContent = region.country;
        button.append(title, detail); button.addEventListener('click', choose); $('region-list').appendChild(button);
    }
    fetch('/assets/jobsite/world-land.geojson').then(r => { if (!r.ok) throw new Error('map'); return r.json(); }).then(data => {
        for (const feature of data.features) {
            const polygons = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
            for (const polygon of polygons) {
                const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                path.setAttribute('d', polygon.map(ring => ring.map(([lon, lat], i) => (i ? 'L' : 'M') + ((lon + 180) / 360 * 1000).toFixed(2) + ',' + ((90 - lat) / 180 * 500).toFixed(2)).join(' ') + 'Z').join(' '));
                $('map-land').appendChild(path);
            }
        }
    }).catch(() => { document.querySelector('.map-footer span').textContent = 'Map outlines unavailable. Choose a region below.'; });
    $('fleet-select').addEventListener('change', e => { fleetId = e.target.value; updateRegion(); });
    function showMap() {
        if (state?.status === 'playing') Sim.pause(state);
        stopTravel();
        clearOperate(); saveJob(); onMap = true; $('world-screen').hidden = false; $('play-screen').hidden = true; $('world-toggle').hidden = true;
        $('pause-toggle').disabled = true; $('equipment-toggle').hidden = true; updateRegion(); scrollTop();
    }
    $('world-toggle').addEventListener('click', showMap);
    function rendererFailure(message) {
        sceneReady = false;
        if (state?.status === 'playing') Sim.pause(state);
        text('renderer-error-copy', message || 'This browser could not start the 3D view. Enable hardware acceleration or try another WebGL-capable browser.');
        $('renderer-error').hidden = false; $('game-overlay').hidden = true; $('operate').disabled = true;
    }
    async function mobilize() {
        if (loading) return;
        const saved = savedJob(selected.id, fleetId);
        if (saved.blocked) { text('region-record', 'This save could not be read. It has been kept intact. Try the version that created it.'); return; }
        onMap = false; $('equipment-toggle').hidden = false; $('world-screen').hidden = true; $('play-screen').hidden = false; $('world-toggle').hidden = false; scrollTop();
        const resume = state && state.region.id === selected.id && state.fleetId === fleetId && state.status === 'paused' && sceneReady;
        if (resume) { lastStatus = ''; hud(); scene.resize(); return; }
        state = saved.state || Sim.createState(0, false, null, selected.id, fleetId); lastStatus = ''; lastSoundEvent = 0;
        text('save-status', saved.recovered ? 'Recovered previous device save' : saved.state ? 'Saved site restored' : 'Saves on this device');
        loading = true; sceneReady = false; $('mobilize').disabled = true; $('renderer-error').hidden = true;
        $('start-shift').disabled = $('practice').disabled = true;
        text('start-shift', 'Preparing site...'); hud();
        try {
            if (!scene) { const module = await import('/assets/js/jobsite-scene.js'); scene = new module.JobsiteScene(canvas, rendererFailure); }
            await scene.configure(state); try { storage?.setItem('openmud-jobsite-last-site-v1', JSON.stringify({ region: selected.id, fleet: fleetId })); } catch (_) { /* Site saves report storage availability separately. */ } sceneReady = true; lastStatus = ''; hud();
        } catch (error) { rendererFailure('The 3D view could not load. Enable hardware acceleration, then retry.'); }
        finally { loading = false; $('mobilize').disabled = false; }
    }
    $('mobilize').addEventListener('click', mobilize);
    $('renderer-retry').addEventListener('click', () => location.reload());
    document.querySelectorAll('[data-camera]').forEach(button => button.addEventListener('click', () => {
        if (!sceneReady) return; scene.setCamera(button.dataset.camera); canvas.focus({ preventScroll: true });
        document.querySelectorAll('[data-camera]').forEach(b => b.classList.toggle('selected', b === button));
    }));
    function saveRecord() {
        if (state.status !== 'won') return;
        const key = state.region.id + ':' + state.fleetId;
        const old = records[key];
        const completed = Math.max(Number.isFinite(old?.completed) ? old.completed : 0, state.level + 1);
        records[key] = { completed, tons: state.hauled };
        try { localStorage.setItem(STORE, JSON.stringify(records)); } catch (_) { /* Play remains available without storage. */ }
    }
    function overlay() {
        if (!sceneReady) { $('game-overlay').hidden = false; text('overlay-title', 'Preparing the site.'); text('overlay-copy', 'Loading equipment and the ' + state.region.name.toLowerCase() + ' environment.'); return; }
        $('game-overlay').hidden = state.status === 'playing';
        if (state.status === 'playing') return;
        $('practice').hidden = state.status === 'paused'; $('practice').disabled = false; $('start-shift').disabled = false;
        const target = state.contract.target;
        if (state.status === 'ready') {
            text('overlay-kicker', state.region.country + ' / contract ' + (state.level + 1)); text('overlay-title', state.contract.name + '.');
            text('overlay-copy', 'Dispatch ' + target + ' tonnes in ' + clock(state.contract.seconds) + '. Hold Space to repeat dig/load cycles. Release in the timing zone for a clean single bite. Trench assist stops at the 0.90 m pipe bed.');
            text('start-shift', 'Start shift');
        } else if (state.status === 'paused') {
            text('overlay-kicker', 'Engine idle'); text('overlay-title', 'Shift paused.'); text('overlay-copy', 'Your clock is stopped. Continue when you are ready.'); text('start-shift', 'Resume shift');
        } else {
            const won = state.status === 'won'; saveRecord();
            text('overlay-kicker', won ? 'Contract complete' : 'Shift report'); text('overlay-title', won ? 'Ground gained.' : 'End of shift.');
            text('overlay-copy', state.hauled + ' tonnes dispatched in ' + clock(state.elapsed) + '. ' + state.perfect + ' clean bites. Best streak: ' + state.bestStreak + '. ' + (won ? state.level < 2 ? 'Take your upgrades to the next contract.' : 'This site is complete. Pick your next region on the world map.' : 'Try a different spread, or fit a larger bucket during the shift.'));
            text('start-shift', won ? state.level < 2 ? 'Next contract' : 'Choose next site' : 'New shift / keep site');
        }
        text('best-score', state.fleet.machine + ' / ' + state.fleet.truck);
    }
    function hud() {
        if (!state || onMap || onGuide) return;
        const soil = Sim.soil(state);
        text('contract-label', state.practice ? state.region.name + ' / free dig' : state.region.name + ' / contract ' + (state.level + 1));
        text('scene-label', state.region.country + ' / ' + state.region.weather);
        text('machine-position', 'Machine ' + state.machine.x.toFixed(1) + ' m / ' + state.machine.z.toFixed(1) + ' m / heading ' + ((Math.round(state.machine.heading * 180 / Math.PI) % 360 + 360) % 360) + ' deg');
        text('cut-count', state.terrain.cuts + (state.terrain.cuts === 1 ? ' cut in the ground' : ' cuts in the ground'));
        text('alignment-toggle', state.alignment ? 'Trench assist on' : 'Assist off');
        $('alignment-toggle').setAttribute('aria-pressed', String(state.alignment));
        $('alignment-toggle').disabled = !Sim.canTravel(state); $('advance-cut').disabled = !Sim.canTravel(state) || state.bucket > 0 || !!state.advance || Math.abs(state.targetHeading - state.machine.heading) > .02;
        const pipeWork = state.utilities.work, pipeReady = Sim.pipeCandidate(state);
        $('install-pipe').disabled = !Sim.canTravel(state) || state.bucket > 0 || !!state.advance || !pipeReady || Math.abs(state.targetHeading - state.machine.heading) > .02;
        $('connect-pipe').disabled = !Sim.canTravel(state) || state.bucket > 0 || !!state.advance || !Sim.connectionCandidate(state) || Math.abs(state.targetHeading - state.machine.heading) > .02;
        const bed = Sim.trenchStatus(state);
        $('plan-panel').hidden = !state.planVisible; $('plan-toggle').setAttribute('aria-pressed', String(state.planVisible)); $('scene-wrap').classList.toggle('is-planning', state.planVisible);
        text('plan-summary', state.plan.sections * 2 + ' m pipe / ' + state.plan.width.toFixed(2) + ' m wide / ' + state.plan.depth.toFixed(2) + ' m deep');
        const planned = Sim.planSections(state);
        text('plan-progress', planned.filter(section => section.installed).length * 2 + ' m pipe installed / ' + planned.filter(section => section.ready && !section.installed).length * 2 + ' m ready');
        $('plan-origin').disabled = !Sim.canTravel(state);
        text('crew-status', pipeWork ? 'Crew working...' : state.bucket > 0 ? 'Load the bucket to clear the crew' : pipeReady ? 'On grade / ready for pipe' : state.utilities.pipes.length * 2 + ' m pipe / ' + state.utilities.joints.length + (state.utilities.joints.length === 1 ? ' joint' : ' joints'));
        text('trench-size', '2.0 x ' + (1.56 * state.fleet.scale).toFixed(2) + ' m / ' + bed.min.toFixed(2) + '-' + bed.max.toFixed(2) + ' m deep');
        text('material-moved', state.terrain.volume.toFixed(2) + ' m3 / ' + state.terrain.mass.toFixed(2) + ' t removed');
        text('foreman-status', bed.message);
        text('safety-status', state.safetyStop ? state.clearingCrew ? 'Crew clearing / equipment stopped' : 'STOP WORK / call Clear crew' : state.haulBlocked ? 'Haul path blocked / relocate loading pad' : 'Keep crew clear of the swing and haul zones');
        $('safety-status').classList.toggle('is-warning', state.safetyStop || state.haulBlocked);
        $('clear-crew').disabled = state.status !== 'playing' || !!state.utilities.work || state.clearingCrew;
        text('density-note', soil.density.toFixed(2) + ' t/m3 bank density preset');
        text('engine-status', Sim.engine(state).rpm + ' RPM / ' + Sim.engine(state).fuel + ' L/h working / ' + state.fuel.toFixed(2) + ' L used');
        text('engine-unlock', state.graded.length >= 3 ? 'Throttle unlocked' : state.graded.length * 2 + ' / 6 m on grade to unlock throttle');
        $('throttle').disabled = state.status !== 'playing' || state.phase !== 'idle' || state.graded.length < 3;
        $('throttle').value = state.throttle;
        text('crew-roster', ['foreman', 'operator', 'laborer', 'joiner'].map(role => role[0].toUpperCase() + role.slice(1) + ' / level ' + Sim.crewLevel(state, role) + ' / ' + state.skills[role] + ' XP').join(' | '));
        text('crew-energy', Math.round(state.energy) + '% energy / spotting level ' + Sim.crewLevel(state, 'spotting') + (state.energy < 20 ? ' / Lunch restores work speed' : ''));
        text('crew-activity', state.crewActivity ? state.crewActivity.type + ' / ' + Math.ceil(state.crewActivity.duration - state.crewActivity.elapsed) + ' s left' : 'Training and lunch park the equipment. Progress saves with this site.');
        for (const type of ['spotting', 'operation', 'lunch']) $('crew-' + type).disabled = state.status !== 'playing' || state.phase !== 'idle' || !!state.utilities.work || !!state.crewActivity;
        if (scene) text('render-stats', 'Graphics: Three.js / 30 fps cap / ' + scene.renderMs.toFixed(1) + ' ms average CPU submission / ' + scene.renderer.info.render.calls + ' draw calls. GPU time and device memory are not measured.');
        document.querySelectorAll('[data-drive]').forEach(button => { button.disabled = !Sim.canTravel(state); });
        text('stat-tons', state.hauled + (state.practice ? ' t' : ' / ' + state.contract.target + ' t'));
        text('time-label', state.practice ? 'Shift time' : 'Shift left'); text('stat-time', clock(state.practice ? state.elapsed : state.contract.seconds - state.elapsed));
        text('stat-cash', '$' + state.credits); text('stat-bucket', state.bucket.toFixed(1) + ' t');
        text('stat-truck', state.truckState === 'waiting' ? state.truck.toFixed(1) + ' / ' + state.fleet.capacity + ' t' : state.truckState === 'hauling' ? state.fleet.capacity + ' / ' + state.fleet.capacity + ' t hauling' : '0 / ' + state.fleet.capacity + ' t inbound');
        text('streak', state.streak + ' clean bites'); text('jobsite-hint', state.message); text('active-soil', soil.name); text('soil-resistance', soil.resistance.toFixed(2) + 'x resistance');
        const soilKey = state.region.id + ':' + soil.name;
        if ($('soil-layers').dataset.key !== soilKey) {
            $('soil-layers').dataset.key = soilKey; $('soil-layers').replaceChildren();
            const index = Math.min(2, Math.floor(state.excavated / state.contract.target * 3));
            state.region.layers.forEach((key, i) => { const layer = document.createElement('span'); layer.style.background = Sim.SOILS[key].color; layer.title = Sim.SOILS[key].name; if (i === index) layer.className = 'active'; $('soil-layers').appendChild(layer); });
        }
        text('machine-label', state.fleet.machine); text('equipment-label', state.fleet.truck + ' / ' + soil.tooth);
        $('job-progress').style.width = (state.practice ? (state.hauled % 100) : Math.min(100, state.hauled / state.contract.target * 100)) + '%';
        $('sweet-spot').style.left = soil.window[0] * 100 + '%'; $('sweet-spot').style.width = (soil.window[1] - soil.window[0]) * 100 + '%';
        const m = state.phase === 'charging' ? Sim.meter(state) : 0;
        $('meter-needle').style.left = m * 100 + '%'; $('bite-meter').setAttribute('aria-valuenow', Math.round(m * 100));
        text('bite-quality', state.phase === 'charging' ? 'Release in zone: skill bonus' : state.lastQuality || 'Hold: steady / release in zone: full');
        text('action-label', Math.abs(state.targetHeading - state.machine.heading) > .02 ? 'Turning...' : state.utilities.work ? 'Pipe crew working' : state.phase === 'charging' ? 'Release to dig' : state.phase !== 'idle' ? 'Cycling...' : state.bucket > 0 ? 'Load truck' : 'Hold to dig');
        text('action-help', state.operateHeld ? 'Repeating / release Space to stop' : state.bucket > 0 ? 'Press to load / hold Space to repeat' : 'Hold Space to repeat / button for timing');
        $('operate').disabled = !sceneReady || state.status !== 'playing' || state.safetyStop || !!state.utilities.work || !!state.crewActivity || Math.abs(state.targetHeading - state.machine.heading) > .02;
        $('pause-toggle').disabled = !sceneReady || !['playing', 'paused'].includes(state.status); text('pause-toggle', state.status === 'paused' ? 'Resume' : 'Pause');
        ['bucket', 'dispatch'].forEach(key => {
            const button = $('upgrade-' + key); button.disabled = !sceneReady || state.status !== 'playing' || state.phase !== 'idle' || state.upgrades[key] || state.credits < (key === 'bucket' ? 200 : 150);
            const label = state.upgrades[key] ? 'Installed' : key === 'bucket' ? '$200 / 60% larger bites' : '$150 / shorter waits';
            if (button.querySelector('small').textContent !== label) button.querySelector('small').textContent = label;
        });
        if (lastStatus !== state.status) { lastStatus = state.status; overlay(); }
    }
    function startShift() {
        if (!sceneReady) return;
        stopTravel();
        if (state.status === 'won' && state.level === 2) { showMap(); return; }
        if (state.status === 'paused') Sim.pause(state);
        else if (state.status === 'won') { state = Sim.createState(state.level + 1, false, state); Sim.start(state); }
        else if (state.status === 'lost') { state = Sim.createState(state.level, false, state); Sim.start(state); }
        else Sim.start(state);
        lastStatus = ''; hud(); saveJob(); $('operate').focus({ preventScroll: true });
    }
    $('start-shift').addEventListener('click', startShift);
    $('practice').addEventListener('click', () => { clearOperate(); state = Sim.createState(state.level, true, state); Sim.start(state); lastStatus = ''; hud(); saveJob(); $('operate').focus({ preventScroll: true }); });
    function pause() { if (!state || onMap || onGuide) return; clearOperate(); stopTravel(); Sim.pause(state); hud(); saveJob(); }
    $('pause-toggle').addEventListener('click', pause);
    $('restart-job').addEventListener('click', () => { clearOperate(); state = Sim.createState(state.level, state.practice, state); lastStatus = ''; hud(); saveJob(); });
    $('throttle').addEventListener('change', e => { Sim.setThrottle(state, e.target.value); hud(); saveJob(); canvas.focus({ preventScroll: true }); });
    $('clear-crew').addEventListener('click', () => { clearOperate(); stopTravel(); Sim.clearCrew(state); hud(); canvas.focus({ preventScroll: true }); });
    $('plan-toggle').addEventListener('click', () => { if (!sceneReady) return; clearOperate(); stopTravel(); state.planVisible = !state.planVisible; scene.dirty = true; const view = state.planVisible ? 'overhead' : 'site'; scene.setCamera(view); document.querySelectorAll('[data-camera]').forEach(button => button.classList.toggle('selected', button.dataset.camera === view)); hud(); saveJob(); canvas.focus({ preventScroll: true }); });
    $('plan-origin').addEventListener('click', () => { Sim.setPlan(state); hud(); saveJob(); canvas.focus({ preventScroll: true }); });
    for (const type of ['spotting', 'operation', 'lunch']) $('crew-' + type).addEventListener('click', () => { clearOperate(); stopTravel(); Sim.crewActivity(state, type); hud(); saveJob(); });
    ['bucket', 'dispatch'].forEach(key => $('upgrade-' + key).addEventListener('click', () => { if (Sim.buy(state, key)) tone(250, .18); hud(); }));
    function tone(hz, duration) {
        if (!sound || !audio) return;
        const osc = audio.createOscillator(), gain = audio.createGain(); osc.type = 'triangle';
        osc.frequency.setValueAtTime(hz, audio.currentTime); osc.frequency.exponentialRampToValueAtTime(hz * .45, audio.currentTime + duration);
        gain.gain.setValueAtTime(.07, audio.currentTime); gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + duration);
        osc.connect(gain); gain.connect(audio.destination); osc.start(); osc.stop(audio.currentTime + duration);
    }
    $('sound-toggle').addEventListener('click', async () => {
        try { if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)(); if (audio.state === 'suspended') await audio.resume(); sound = !sound; $('sound-toggle').setAttribute('aria-pressed', String(sound)); text('sound-toggle', sound ? 'Sound on' : 'Sound off'); tone(240, .12); }
        catch (_) { text('sound-toggle', 'Sound unavailable'); }
    });
    for (const name of ['drive', 'crew']) $(name + '-menu').addEventListener('click', e => { const open = e.currentTarget.parentElement.classList.toggle('is-open'); e.currentTarget.setAttribute('aria-expanded', String(open)); stopTravel(); });
    const operate = $('operate');
    operate.addEventListener('pointerdown', e => { if (e.button !== 0 || inputSource || !sceneReady) return; e.preventDefault(); operate.focus({ preventScroll: true }); operate.setPointerCapture(e.pointerId); inputSource = 'pointer'; Sim.press(state); hud(); });
    operate.addEventListener('pointerup', e => { if (inputSource !== 'pointer') return; inputSource = null; Sim.release(state); if (operate.hasPointerCapture(e.pointerId)) operate.releasePointerCapture(e.pointerId); hud(); });
    const cancel = () => { inputSource = null; if (state) Sim.cancelCharge(state); hud(); };
    operate.addEventListener('pointercancel', cancel); operate.addEventListener('lostpointercapture', () => { if (inputSource === 'pointer') cancel(); });
    operate.addEventListener('click', e => { if (e.detail === 0 && !inputSource && state?.phase === 'idle') { Sim.press(state); if (state.phase === 'charging') Sim.release(state); hud(); } });
    canvas.addEventListener('pointerdown', () => canvas.focus({ preventScroll: true }));
    $('advance-cut').addEventListener('click', () => { stopTravel(); Sim.backUp(state); hud(); canvas.focus({ preventScroll: true }); });
    $('alignment-toggle').addEventListener('click', () => { stopTravel(); state.alignment = !state.alignment; state.targetHeading = state.alignment ? Math.round(state.machine.heading / (Math.PI / 2)) * Math.PI / 2 : state.machine.heading; hud(); canvas.focus({ preventScroll: true }); });
    ['install', 'connect'].forEach(type => $(type + '-pipe').addEventListener('click', () => { stopTravel(); Sim.startPipeWork(state, type); hud(); canvas.focus({ preventScroll: true }); }));
    document.querySelectorAll('[data-drive]').forEach(button => {
        button.addEventListener('pointerdown', e => { if (e.button !== 0) return; e.preventDefault(); button.setPointerCapture(e.pointerId); beginTravel(button.dataset.drive); canvas.focus({ preventScroll: true }); });
        const release = () => travelKeys.delete(button.dataset.drive);
        button.addEventListener('pointerup', release); button.addEventListener('pointercancel', release); button.addEventListener('lostpointercapture', release);
    });
    document.addEventListener('keydown', e => {
        if (!onMap && !onGuide && sceneReady && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.code) && !['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
            e.preventDefault(); beginTravel(e.code); canvas.focus({ preventScroll: true }); return;
        }
        if (onMap || onGuide || !sceneReady || ![canvas, operate].includes(document.activeElement)) return;
        if (e.code === 'KeyP') { e.preventDefault(); if (!e.repeat) pause(); return; }
        if (e.code !== 'Space') return; e.preventDefault(); if (e.repeat || inputSource) return;
        inputSource = 'key'; Sim.setOperateHeld(state, true); hud();
    });
    document.addEventListener('keyup', e => { if (e.code !== 'Space' || inputSource !== 'key') return; e.preventDefault(); inputSource = null; Sim.setOperateHeld(state, false); hud(); });
    document.addEventListener('keyup', e => travelKeys.delete(e.code));
    document.addEventListener('focusin', e => { if (inputSource === 'key' && ![canvas, operate].includes(e.target)) clearOperate(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden && state?.status === 'playing') pause(); });
    window.addEventListener('blur', () => { if (state?.status === 'playing') pause(); });
    window.addEventListener('pagehide', () => { clearOperate(); saveJob(); });
    function loop(ts) {
        if (ts - lastDraw < 1000 / 30 - 1) { requestAnimationFrame(loop); return; }
        const dt = last ? Math.min((ts - last) / 1000, .1) : 0; last = ts; lastDraw = ts;
        if (!document.hidden && !onMap && !onGuide && sceneReady) {
            const forward = Number(travelKeys.has('ArrowUp')) - Number(travelKeys.has('ArrowDown'));
            state.steer = state.alignment ? 0 : Number(travelKeys.has('ArrowLeft')) - Number(travelKeys.has('ArrowRight'));
            Sim.setDrive(state, Math.cos(state.machine.heading) * forward, -Math.sin(state.machine.heading) * forward);
            Sim.step(state, dt); scene.render(state, dt);
            if (ts - lastHud > 100 || state.status !== lastStatus) { hud(); lastHud = ts; }
            if (state.status === 'playing' && ts - lastSave > 3000 || state.status !== 'playing' && state.event !== lastSoundEvent) saveJob();
            if (lastSoundEvent !== state.event) { lastSoundEvent = state.event; tone(state.phase === 'idle' ? 140 : 85, .15); }
        }
        requestAnimationFrame(loop);
    }
    updateRegion();
    if (location.hash === '#how-to-play') showGuide();
    requestAnimationFrame(loop);
})();
