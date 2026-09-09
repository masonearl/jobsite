const C = window.JobsiteCampus;
const $ = id => document.getElementById(id);
const money = value => '$' + (value >= 1000000 ? (value / 1000000).toFixed(2) + 'm' : Math.round(value).toLocaleString('en-US'));
const text = (id, value) => { $(id).textContent = value; };
let selected = C.site(new URLSearchParams(location.search).get('site')), state = null, scene = null, onMap = true, world = null, dirty = false, last = 0, hudTime = 0, saveTime = 0, renderTime = 0;
let nextAction = () => {}, storageBlocked = false;
const prefix = 'openmud-jobsite-campus-v1:', knownSaves = new Map();
function notice(message) { text('notice', message); $('notice').hidden = !message; }
function readSave(id) {
    try {
        const raw = localStorage.getItem(prefix + id); knownSaves.set(id, raw);
        const saved = raw ? C.decode(raw) : null;
        return { raw, state: saved?.site === id ? saved : null };
    } catch (_) { return { raw: null, state: null, unavailable: true }; }
}
function save() {
    if (!state || storageBlocked || !dirty) return;
    try {
        const key = prefix + state.site, existing = localStorage.getItem(key);
        if (existing !== knownSaves.get(state.site)) {
            state.running = false; storageBlocked = true;
            notice('Another tab changed this project save. This tab is paused to preserve both attempts. Download your project record before reloading.'); return;
        }
        const raw = JSON.stringify(state); localStorage.setItem(key, raw); knownSaves.set(state.site, raw); dirty = false;
        text('storage-status', 'Saved on this device. Reload returns paused.');
    } catch (_) { text('storage-status', 'Device storage is unavailable. Download a project record before leaving.'); }
}
function pause() { if (state) { state.running = false; dirty = true; save(); if (!onMap) hud(); } }
function makeButton(label, click, className = '') { const b = document.createElement('button'); b.textContent = label; b.className = className; b.addEventListener('click', click); return b; }
function setTab(name) {
    if (!onMap) openOperations(true, false);
    document.querySelectorAll('[data-tab]').forEach(b => { const active = b.dataset.tab === name; b.setAttribute('aria-selected', active); b.tabIndex = active ? 0 : -1; $('panel-' + b.dataset.tab).hidden = !active; });
}
document.querySelectorAll('[data-tab]').forEach((b, i, tabs) => {
    b.addEventListener('click', () => setTab(b.dataset.tab));
    b.addEventListener('keydown', e => {
        const direction = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (direction) { e.preventDefault(); const next = tabs[(i + direction + tabs.length) % tabs.length]; setTab(next.dataset.tab); next.focus(); }
    });
});
function choose(id) {
    selected = C.site(id);
    document.querySelectorAll('[data-destination]').forEach(b => b.setAttribute('aria-pressed', b.dataset.destination === id));
    text('destination-name', selected.name); text('destination-place', selected.place); text('destination-status', selected.status); text('destination-fact', selected.fact);
    text('destination-source', selected.source); $('destination-source').href = selected.url; text('destination-date', selected.date);
    text('destination-type', { data: 'Data-center construction', fab: 'Semiconductor fabrication campus', space: 'Launch-site civil works' }[selected.type]);
    $('destination-image').style.backgroundImage = 'linear-gradient(0deg, #15120f55, transparent), url(/assets/jobsite/' + (selected.biome === 'coast' ? 'desert' : selected.biome) + '.jpg)';
    text('destination-scope', selected.type === 'space' ? 'Pad, tower, integration building + support yards' : selected.type === 'fab' ? 'Process fab, packaging hall + central plant' : 'Two data halls + power and cooling yards');
    text('destination-challenge', selected.climate + '. Target: ' + selected.target + ' scenario days.');
    const saved = readSave(id);
    text('mobilize-campus', saved.state ? saved.state.complete ? 'Visit completed project' : 'Resume project' : 'Mobilize project');
    text('save-label', saved.state ? Math.round(C.progress(saved.state) * 100) + '% built / day ' + Math.floor(saved.state.day) + ' saved on this device' : 'Start with a released scenario design and bare ground.');
    world?.setSelected(selected.id);
}
for (const [i, p] of C.SITES.entries()) {
    const b = makeButton('', () => { choose(p.id); world?.focusSite(p); if (matchMedia('(max-width: 760px)').matches) toggleProjects(false); }, 'destination'); b.dataset.destination = p.id;
    b.innerHTML = '<span>' + String(i + 1).padStart(2, '0') + '</span><div><strong>' + p.name + '</strong><small>' + p.place + '</small></div>'; $('destinations').append(b);
}
function toggleProjects(open) {
    $('destinations').hidden = !open; $('projects-toggle').setAttribute('aria-expanded', open);
}
$('projects-toggle').addEventListener('click', () => toggleProjects($('destinations').hidden));
toggleProjects(!matchMedia('(max-width: 760px)').matches);
function worldFailure() {
    $('world-loading').hidden = true; $('world-error').hidden = false; $('atlas-pins').hidden = true;
    ['world-home','map-zoom','world-zoom-in','world-zoom-out'].forEach(id => $(id).disabled = true);
    toggleProjects(true); world = null;
}
async function loadWorld() {
    try {
        const { WorldScene } = await import('./jobsite-world-scene.js');
        world = new WorldScene($('world-canvas'), $('atlas-pins'), C.SITES, choose, worldFailure);
        world.setSelected(selected.id); await world.ready;
        $('world-loading').hidden = true; document.body.dataset.worldReady = 'true';
        if ($('world-canvas').dataset.surface !== 'blue-marble') document.querySelector('.map-credit').textContent = 'Natural Earth / regional markers';
    } catch (_) { worldFailure(); }
}
$('world-home').addEventListener('click', () => world?.home());
$('map-zoom').addEventListener('click', () => world?.focusUS());
$('world-zoom-in').addEventListener('click', () => world?.zoom(-.2));
$('world-zoom-out').addEventListener('click', () => world?.zoom(.2));
function openOperations(open, focus = true) {
    $('operations').hidden = !open; $('operations-toggle').setAttribute('aria-expanded', open);
    if (focus) $(open ? 'operations-close' : 'operations-toggle').focus();
}
$('operations-toggle').addEventListener('click', () => openOperations($('operations').hidden));
$('operations-close').addEventListener('click', () => openOperations(false));

const taskRows = new Map(), resourceRows = new Map(), deliveryRows = new Map();
function buildBoard() {
    taskRows.clear(); resourceRows.clear(); deliveryRows.clear(); $('work-packages').replaceChildren();
    const tasks = C.plan(state.site), groups = [ ['Civil works', tasks.filter(t => !/^[ab]-/.test(t.id) && ['survey', 'clear', 'grade', 'drain', 'duct', 'formation'].includes(t.id))], ['Building work fronts', tasks.filter(t => /^[ab]-/.test(t.id))], ['Infrastructure + turnover', tasks.filter(t => !/^[ab]-/.test(t.id) && !['survey', 'clear', 'grade', 'drain', 'duct', 'formation'].includes(t.id))] ];
    for (const [label, members] of groups) {
        const group = document.createElement('section'); group.className = 'work-group'; const h = document.createElement('h3'); h.textContent = label; group.append(h);
        for (const t of members) {
            const row = document.createElement('article'); row.className = 'work-row'; row.dataset.task = t.id;
            row.innerHTML = '<div class="work-title"><strong>' + t.name + '</strong><small>' + t.quantity + '</small><details class="package-details"><summary>Sequence + scope</summary><p>' + t.lesson + '</p><p>Needs: ' + (t.deps.map(id => tasks.find(x => x.id === id).name).join('; ') || 'Released scenario design') + '.</p><p>' + C.TRADES[t.trade].name + (t.equipment ? ' / ' + C.EQUIPMENT[t.equipment].name : '') + '. ' + t.days.toFixed(1) + ' base scenario days.</p></details></div><div class="work-state"><span></span><small></small></div><div class="work-amount"><span>0%</span><div class="progress"><i></i></div></div><div class="work-actions"></div>';
            const action = makeButton('Dispatch', () => {
                const ts = state.tasks[t.id];
                if (ts.progress >= 1 && t.gate) C.inspect(state, t.id); else C.dispatch(state, t.id, !ts.enabled);
                dirty = true; hud();
            }); action.setAttribute('aria-label', 'Dispatch ' + t.name);
            const priority = makeButton('Priority', () => { state.tasks[t.id].priority = state.tasks[t.id].priority ? 0 : 1; dirty = true; hud(); }); priority.setAttribute('aria-label', 'Prioritize ' + t.name);
            row.querySelector('.work-actions').append(action, priority); group.append(row); taskRows.set(t.id, { row, action, priority });
        }
        $('work-packages').append(group);
    }
    for (const [group, catalog, target] of [['crews', C.TRADES, 'labor-roster'], ['equipment', C.EQUIPMENT, 'equipment-roster']]) {
        $(target).replaceChildren();
        for (const [key, item] of Object.entries(catalog)) {
            const card = document.createElement('article'); card.className = 'resource-card';
            card.innerHTML = '<h4>' + item.name + '</h4><p>' + item.detail + '</p><p class="resource-stats"></p><div class="resource-buttons"></div>';
            const minus = makeButton('Remove', () => { C.capacity(state, group, key, -1); dirty = true; hud(); }); minus.setAttribute('aria-label', 'Remove one ' + item.name);
            const plus = makeButton('Add', () => { C.capacity(state, group, key, 1); dirty = true; hud(); }); plus.setAttribute('aria-label', 'Add one ' + item.name);
            const amount = document.createElement('span'); card.querySelector('.resource-buttons').append(minus, amount, plus); $(target).append(card);
            resourceRows.set(group + ':' + key, { card, minus, plus, amount, group, key, item });
        }
    }
    $('delivery-roster').replaceChildren();
    for (const [key, m] of Object.entries(C.MATERIALS)) {
        const card = document.createElement('article'); card.className = 'resource-card';
        card.innerHTML = '<h4>' + m.name + '</h4><p>' + m.quantity + ' package' + (m.quantity > 1 ? 's' : '') + ' / ' + m.lead + ' scenario days / ' + money(m.cost * m.quantity) + '</p><p class="resource-stats"></p><div class="resource-buttons"></div>';
        const order = makeButton('Order', () => { C.order(state, key); dirty = true; hud(); }); order.setAttribute('aria-label', 'Order ' + m.name);
        const expedite = makeButton('Expedite +20%', () => { C.expedite(state, key); dirty = true; hud(); }); expedite.setAttribute('aria-label', 'Expedite ' + m.name);
        card.querySelector('.resource-buttons').append(order, expedite); $('delivery-roster').append(card); deliveryRows.set(key, { card, order, expedite });
    }
    const p = C.site(state.site); text('record-fact', p.fact); text('record-source', p.source); $('record-source').href = p.url; text('record-date', p.date);
    $('speed').value = state.speed; setTab('work');
}
async function mobilize() {
    const saved = readSave(selected.id); state = saved.state || C.create(selected.id); storageBlocked = !!saved.raw && !saved.state;
    notice(storageBlocked ? 'The existing save uses an unreadable format. It is preserved; this attempt will not overwrite it. Use Start a new attempt in Project record to explicitly replace it.' : saved.unavailable ? 'Device storage is unavailable. Download a project record before leaving.' : '');
    onMap = false; document.body.classList.remove('world-view'); $('operations-toggle').hidden = false; $('explorer').hidden = true; $('construction').hidden = false; $('map-return').hidden = false;
    text('project-name', selected.name); text('project-location', selected.place + ' / ' + (selected.type === 'space' ? 'Civil expansion' : 'Representative construction phase'));
    buildBoard(); openOperations(false, false); hud(); window.scrollTo({ top: 0 }); $('run-project').focus();
    try {
        if (!scene) { const { CampusScene } = await import('./jobsite-campus-scene.js'); scene = new CampusScene($('campus-canvas'), () => { pause(); $('scene-error').hidden = false; }); }
        scene.configure(state); scene.setCamera('work'); document.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-pressed', b.dataset.view === 'work')); $('scene-error').hidden = true;
    } catch (_) { $('scene-error').hidden = false; }
    dirty = true; save();
}
function showMap() { pause(); onMap = true; document.body.classList.add('world-view'); $('operations-toggle').hidden = true; openOperations(false, false); $('explorer').hidden = false; $('construction').hidden = true; $('map-return').hidden = true; choose(selected.id); world?.resize(); window.scrollTo({ top: 0 }); $('mobilize-campus').focus(); }
$('mobilize-campus').addEventListener('click', mobilize); $('map-return').addEventListener('click', showMap); $('choose-next').addEventListener('click', showMap);
function toggleRun() { if (!state || state.complete || onMap || $('field-guide').open) return; state.running = !state.running; dirty = true; hud(); }
$('run-project').addEventListener('click', toggleRun);
$('speed').addEventListener('change', e => { state.speed = Number(e.target.value); dirty = true; });
$('dispatch-all').addEventListener('click', () => { C.dispatch(state, 'all', true); dirty = true; hud(); });
$('hold-all').addEventListener('click', () => { C.dispatch(state, 'all', false); dirty = true; hud(); });
$('order-all').addEventListener('click', () => { Object.keys(C.MATERIALS).forEach(key => C.order(state, key)); dirty = true; hud(); });
$('next-action').addEventListener('click', () => { nextAction(); dirty = true; hud(); });
function desk(allocation) {
    const tasks = C.plan(state.site), gates = tasks.find(t => t.gate && state.tasks[t.id].progress === 1 && !state.tasks[t.id].accepted);
    let title, copy, button, action;
    if (state.complete) { title = 'Ready for the owner.'; copy = 'Every work package is accepted. Review the final score or mobilize another project.'; button = 'Choose next project'; action = showMap; }
    else if (gates) { title = 'Inspection hold.'; copy = gates.name + ' is ready. Release it to open the next work front.'; button = 'Accept inspection'; action = () => C.inspect(state, gates.id); }
    else if (!tasks.some(t => state.tasks[t.id].enabled && !state.tasks[t.id].accepted)) { title = 'Mobilize the crews.'; copy = 'Dispatch the work packages once. The crews will take each assignment when its prerequisites are ready.'; button = 'Dispatch all crews'; action = () => C.dispatch(state, 'all', true); }
    else if (Object.values(state.orders).some(o => !o.ordered)) { title = 'Buy ahead of the build.'; copy = 'Steel, switchgear, cooling and fit-out packages have delivery lead times. Order early while the sitework advances.'; button = 'Order all packages / ' + money(Object.entries(C.MATERIALS).reduce((n, [k, m]) => n + (state.orders[k].ordered ? 0 : m.quantity * m.cost), 0)); action = () => Object.keys(C.MATERIALS).forEach(k => C.order(state, k)); }
    else if (!state.running) { title = 'Project paused.'; copy = 'Assignments and deliveries are saved. Resume the clock when you are ready to continue.'; button = 'Run project'; action = () => { state.running = true; }; }
    else if (!allocation.active.length) { title = 'The next handoff is waiting.'; copy = Object.values(allocation.reasons).find(r => !['Complete', 'Not dispatched'].includes(r)) || 'Dispatch unfinished work to continue.'; button = 'Review work packages'; action = () => { setTab('work'); $('tab-work').scrollIntoView({ behavior: 'smooth', block: 'start' }); }; }
    else { title = allocation.active.length + ' work fronts moving.'; copy = allocation.active.map(t => t.name).join('. ') + '. Open Operations to review waiting reasons before adding resources.'; button = 'Manage labor + equipment'; action = () => { setTab('resources'); $('tab-resources').scrollIntoView({ behavior: 'smooth', block: 'start' }); }; }
    text('next-title', title); text('next-copy', copy); text('next-action', button); nextAction = action;
}
function hud() {
    if (!state || onMap) return;
    const a = C.allocation(state), p = C.site(state.site), progress = C.progress(state), workers = a.active.reduce((n, t) => n + C.TRADES[t.trade].people, 0), payroll = Object.entries(state.crews).reduce((n, [k, count]) => n + count * C.TRADES[k].people, 0);
    text('run-project', state.complete ? 'Handed over' : state.running ? 'Pause project' : 'Run project'); $('run-project').disabled = state.complete;
    text('metric-progress', Math.floor(progress * 100) + '%'); $('overall-progress').style.width = progress * 100 + '%';
    text('metric-day', Math.floor(state.day)); text('metric-target', 'Target ' + p.target + ' days' + (state.day > p.target ? ' / over target' : ''));
    text('metric-cost', money(state.spent)); text('metric-budget', money(state.budget) + ' allowance' + (state.spent > state.budget ? ' / over allowance' : ''));
    text('metric-workers', (state.running ? workers : 0) + ' / ' + payroll); text('metric-active', a.active.length + (state.running ? ' active work fronts' : ' ready work fronts'));
    const w = C.weather(state); text('weather-label', w.name); text('weather-next', 'Scenario weather changes in ' + w.ends.toFixed(1) + ' days.');
    for (const t of C.plan(state.site)) {
        const ts = state.tasks[t.id], r = taskRows.get(t.id), status = a.reasons[t.id]; r.row.dataset.status = status;
        r.row.querySelector('.work-state span').textContent = status === 'Working' && !state.running ? 'Ready / project paused' : status;
        r.row.querySelector('.work-state small').textContent = ts.start !== null ? 'Started day ' + Math.floor(ts.start) + (ts.finish !== null ? ' / accepted day ' + Math.ceil(ts.finish) : '') : C.TRADES[t.trade].people + ' people / ' + (t.equipment ? C.EQUIPMENT[t.equipment].name : 'Field team');
        r.row.querySelector('.work-amount span').textContent = Math.floor(ts.progress * 100) + '%'; r.row.querySelector('.progress i').style.width = ts.progress * 100 + '%';
        const label = ts.accepted ? 'Accepted' : ts.progress === 1 && t.gate ? 'Accept' : ts.enabled ? 'Hold' : 'Dispatch'; r.action.textContent = label; r.action.setAttribute('aria-label', label + ' ' + t.name); r.action.disabled = ts.accepted;
        r.priority.setAttribute('aria-pressed', !!ts.priority); r.priority.disabled = ts.progress === 1;
    }
    for (const r of resourceRows.values()) {
        const count = state[r.group][r.key], active = count - (r.group === 'crews' ? a.labor[r.key] : a.equipment[r.key]); r.amount.textContent = count + (r.group === 'crews' ? ' crew' + (count > 1 ? 's' : '') : ' spread' + (count > 1 ? 's' : ''));
        r.card.querySelector('.resource-stats').textContent = active + '/' + count + ' assigned / ' + money(count * r.item.rate) + ' per day' + (r.item.people ? ' / ' + count * r.item.people + ' people' : '');
        r.minus.disabled = count <= 0 || state.complete; r.plus.disabled = count >= 3 || state.complete;
    }
    for (const [key, r] of deliveryRows) {
        const o = state.orders[key]; r.card.querySelector('.resource-stats').textContent = !o.ordered ? 'Not ordered' : o.arrival > state.day ? 'Due day ' + Math.ceil(o.arrival) + ' / ' + (o.arrival - state.day).toFixed(1) + ' days remaining' : 'Delivered / ' + o.used + ' of ' + C.MATERIALS[key].quantity + ' packages installed or in work';
        r.order.disabled = o.ordered || state.complete; r.order.textContent = o.ordered ? 'Ordered' : 'Order'; r.expedite.disabled = !o.ordered || o.expedited || o.arrival <= state.day || state.complete;
    }
    $('order-all').disabled = Object.values(state.orders).every(o => o.ordered) || state.complete;
    const milestones = [['Site released', ['survey']], ['Formation accepted', ['formation']], ['Structures erected', ['a-frame', 'b-frame']], ['Buildings + plant complete', ['a-fitout', 'b-fitout', 'power', 'cooling']], ['Systems commissioned', ['test']], ['Owner handover', ['handover']]];
    $('milestones').replaceChildren(); let current = false;
    for (const [name, ids] of milestones) { const li = document.createElement('li'), complete = ids.every(id => C.done(state, id)); li.textContent = name; li.className = complete ? 'done' : current ? '' : 'current'; if (!complete) current = true; $('milestones').append(li); }
    if (scene?.activity) { text('scene-activity', state.running ? scene.activity.title + ' / ' + scene.activity.detail : 'Project paused / equipment and crews stopped'); text('site-attendance', scene.activity.workerCount + ' people on site / ' + scene.activity.parkedCount + ' vehicles parked'); }
    desk(a); $('completion').hidden = !state.complete;
    const report = C.report(state);
    text('completion-report', 'Score ' + report.score + '/100. ' + report.days + ' scenario days / ' + money(report.cost) + ' / ' + report.laborHours.toLocaleString() + ' productive labor hours. ' + (report.onTime ? 'Within schedule target.' : 'Beyond schedule target.') + ' ' + (report.onBudget ? 'Within cost allowance.' : 'Beyond cost allowance.'));
    text('project-record-metrics', Math.round(state.laborHours).toLocaleString() + ' productive labor hours / ' + state.peakWorkers + ' peak working people / ' + state.idleDays.toFixed(1) + ' days with no productive work.');
    $('project-log').replaceChildren(); for (const entry of state.log) { const li = document.createElement('li'); li.textContent = 'Day ' + Math.floor(entry.day) + ': ' + entry.message; $('project-log').append(li); }
    $('dispatch-all').disabled = $('hold-all').disabled = state.complete;
}
document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => { scene?.setCamera(b.dataset.view); document.querySelectorAll('[data-view]').forEach(x => x.setAttribute('aria-pressed', x === b)); }));
$('next-crew').addEventListener('click', () => { if (!scene?.activity) return; scene.activity.workIndex++; scene.setCamera('work'); document.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-pressed', b.dataset.view === 'work')); });
$('campus-canvas').addEventListener('campuscamera', () => document.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-pressed', 'false')));
$('cutaway').addEventListener('click', () => { if (!scene) return; scene.cutaway = !scene.cutaway; $('cutaway').setAttribute('aria-pressed', scene.cutaway); text('cutaway', scene.cutaway ? 'Roof on' : 'Roof off'); });
$('guide-open').addEventListener('click', () => { pause(); $('field-guide').showModal(); }); $('guide-close').addEventListener('click', () => $('field-guide').close());
$('fullscreen').addEventListener('click', async () => {
    try {
        if (document.fullscreenElement || document.webkitFullscreenElement) await (document.exitFullscreen?.() || document.webkitExitFullscreen?.());
        else { const app = $('campus-app'), enter = app.requestFullscreen || app.webkitRequestFullscreen; if (!enter) throw Error(); await enter.call(app); }
    } catch (_) { notice('Fullscreen is unavailable in this browser. The game already fills the window.'); }
});
for (const event of ['fullscreenchange', 'webkitfullscreenchange']) document.addEventListener(event, () => text('fullscreen', document.fullscreenElement || document.webkitFullscreenElement ? 'Exit fullscreen' : 'Fullscreen'));
document.addEventListener('keydown', e => {
    if (e.key.toLowerCase() === 'p' && !e.repeat && !e.metaKey && !e.ctrlKey && !e.altKey && !['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) { e.preventDefault(); toggleRun(); }
    if (e.key === 'Escape' && !$('field-guide').open && !$('operations').hidden) openOperations(false);
});
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); }); window.addEventListener('pagehide', pause);
$('reset-campus').addEventListener('click', () => {
    if (!state) return; state = C.create(state.site); storageBlocked = false; readSave(state.site); notice(''); dirty = true; buildBoard(); scene?.configure(state); hud(); save();
});
$('export-record').addEventListener('click', () => {
    const data = { notice: 'Illustrative game scenario, not a project estimate or engineering record.', project: C.site(state.site), report: C.report(state), workPackages: C.plan(state.site).map(t => ({ ...t, ...state.tasks[t.id] })), state };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = 'jobsite-' + state.site + '-record.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
});
function loop(now) {
    const dt = Math.min(.1, (now - (last || now)) / 1000); last = now;
    if (onMap && !document.hidden && !$('field-guide').open && now - renderTime > 33) { world?.render(Math.min(.1, (now - renderTime) / 1000)); renderTime = now; }
    if (!onMap && state) {
        if (state.running && !$('field-guide').open) { C.advance(state, dt / 12 * state.speed); dirty = true; }
        if (now - hudTime > 250) { hud(); hudTime = now; }
        if (!document.hidden && !$('field-guide').open && now - renderTime > 33) { scene?.render(state, Math.min(.1, (now - renderTime) / 1000)); renderTime = now; }
        if (now - saveTime > 2000) { save(); saveTime = now; }
    }
    requestAnimationFrame(loop);
}
choose(selected.id); document.body.dataset.campusReady = 'true'; loadWorld();
if (location.hash === '#how-to-play') $('field-guide').showModal();
requestAnimationFrame(loop);
