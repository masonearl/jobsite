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
        if(state.migratedFrom===1 && existing && JSON.parse(existing).version===1){localStorage.setItem(key+':before-process-update',existing);}
        const raw = JSON.stringify(state); localStorage.setItem(key, raw); knownSaves.set(state.site, raw); dirty = false;
        text('storage-status', 'Saved on this device. Reload returns paused.');
    } catch (_) { text('storage-status', 'Device storage is unavailable. Download a project record before leaving.'); }
}
function pause() { if (state) { state.running = false; dirty = true; save(); if (!onMap) hud(); } }
function newProject(id) {
    const s = C.create(id);
    for (const group of ['crews', 'equipment']) for (const key of Object.keys(s[group])) s[group][key] = 0;
    return s;
}
function makeButton(label, click, className = '') { const b = document.createElement('button'); b.textContent = label; b.className = className; b.addEventListener('click', click); return b; }
function setTab(name) {
    if (!onMap) openOperations(true, false);
    $('operations').scrollTop = 0;
    document.querySelectorAll('[data-tab]').forEach(b => { const active = b.dataset.tab === name; b.setAttribute('aria-selected', active); b.tabIndex = active ? 0 : -1; $('panel-' + b.dataset.tab).hidden = !active; });
}
document.querySelectorAll('[data-tab]').forEach((b, i, tabs) => {
    b.addEventListener('click', () => setTab(b.dataset.tab));
    b.addEventListener('keydown', e => {
        const direction = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (direction) { e.preventDefault(); const next = tabs[(i + direction + tabs.length) % tabs.length]; setTab(next.dataset.tab); next.focus(); }
    });
});
function renderEvidence(id,model) {
    const box=$(id);box.replaceChildren();
    for(const [label,value] of [['Layout basis',model.basis],['Published evidence',model.observed],['Reconstruction',model.inferred]]){const p=document.createElement('p'),strong=document.createElement('strong');strong.textContent=label+': ';p.append(strong,document.createTextNode(value));box.append(p);}
    for(const source of model.sources){const p=document.createElement('p'),a=document.createElement('a');a.href=source.url;a.textContent=source.title+' / '+source.date;a.target='_blank';a.rel='noopener';p.append(a);box.append(p);}
}
function choose(id) {
    selected = C.site(id);
    document.querySelectorAll('[data-destination]').forEach(b => b.setAttribute('aria-pressed', b.dataset.destination === id));
    text('destination-name', selected.name); text('destination-place', selected.place); text('destination-status', selected.status); text('destination-fact', selected.fact);
    text('destination-source', selected.source); $('destination-source').href = selected.url; text('destination-date', selected.date);
    text('destination-type', { data: 'Data-center construction', fab: 'Semiconductor fabrication campus', space: 'Launch-site civil works' }[selected.type]);
    $('destination-image').style.backgroundImage = 'linear-gradient(0deg, #15120f55, transparent), url(/assets/jobsite/' + (selected.biome === 'coast' ? 'desert' : selected.biome) + '.jpg)';
    text('destination-scope',C.model(selected.id).program);
    renderEvidence('destination-model',C.model(selected.id));
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
    const tasks = C.plan(state), civil=['survey','controls','clear','grade','drain','duct','utility-test','formation'], groups = [ ['Civil works',tasks.filter(t=>civil.includes(t.id))], ['Building work fronts',tasks.filter(t=>/^[ab]-/.test(t.id))], ['Infrastructure + turnover',tasks.filter(t=>!civil.includes(t.id)&&!/^[ab]-/.test(t.id))] ];
    for (const [label, members] of groups) {
        const group = document.createElement('section'); group.className = 'work-group'; const h = document.createElement('h3'); h.textContent = label; group.append(h);
        for (const t of members) {
            const row = document.createElement('article'); row.className = 'work-row'; row.dataset.task = t.id;
            row.innerHTML = '<div class="work-title"><strong>' + t.name + '</strong><small>' + t.quantity + '</small><details class="package-details"><summary>Sequence + scope</summary><p>' + t.lesson + '</p><p>Needs: ' + (t.deps.map(id => tasks.find(x => x.id === id).name).join('; ') || 'Released scenario design') + '.</p><p>' + (t.elapsed ? 'Elapsed time / no crew assigned' : C.TRADES[t.trade].name) + (t.equipment ? ' / ' + C.EQUIPMENT[t.equipment].name : '') + '. ' + t.days.toFixed(1) + ' base scenario days.</p></details></div><div class="work-state"><span></span><small></small></div><div class="work-amount"><span>0%</span><div class="progress"><i></i></div></div>';
            for(const key of t.sources||[]){const source=C.PROCESS_SOURCES[key],link=document.createElement('a');link.href=source.url;link.textContent=source.title;link.target='_blank';link.rel='noopener';link.className='process-source';row.querySelector('.package-details').append(link);}
            group.append(row); taskRows.set(t.id, { row });
        }
        $('work-packages').append(group);
    }
    for (const [group, catalog, target] of [['crews', C.TRADES, 'labor-roster'], ['equipment', C.EQUIPMENT, 'equipment-roster']]) {
        $(target).replaceChildren();
        for (const [key, item] of Object.entries(catalog)) {
            const card = document.createElement('article'); card.className = 'resource-card resource-row';
            card.innerHTML = '<div class="resource-info"><details class="resource-detail"><summary><strong>' + item.name + '</strong><span>Details</span></summary><p>' + item.detail + '</p></details><p class="resource-stats"></p></div><div class="resource-amount"></div>';
            const amount = card.querySelector('.resource-amount'); $(target).append(card);
            resourceRows.set(group + ':' + key, { card, amount, group, key, item });
        }
    }
    $('delivery-roster').replaceChildren();
    for (const [key, m] of Object.entries(C.MATERIALS)) {
        const card = document.createElement('article'); card.className = 'resource-card';
        const materialName=C.material(state,key).name;
        card.innerHTML = '<h4>' + materialName + '</h4><p>' + m.quantity + ' package' + (m.quantity > 1 ? 's' : '') + ' / ' + m.lead + ' scenario days / ' + money(m.cost * m.quantity) + '</p><p class="resource-stats"></p>';
        $('delivery-roster').append(card); deliveryRows.set(key, { card });
    }
    const p = C.site(state.site); text('record-fact', p.fact); text('record-source', p.source); $('record-source').href = p.url; text('record-date', p.date);
    renderEvidence('record-model',C.model(state.site));
    $('apply-site-model').hidden=state.modelRevision===2;
    text('scene-mode',state.modelRevision===2?C.model(state).basis:'Original saved layout');
    $('speed').value = state.speed; setTab('work');
}
async function mobilize() {
    const saved = readSave(selected.id); state = saved.state || newProject(selected.id); storageBlocked = !!saved.raw && !saved.state;
    notice(storageBlocked ? 'The existing save uses an unreadable format. It is preserved; this attempt will not overwrite it. Use Start a new attempt in Project record to explicitly replace it.' : saved.unavailable ? 'Device storage is unavailable. Download a project record before leaving.' : state.modelRevision!==2 ? 'This saved attempt keeps its original layout. Apply the researched layout in Operations > Project record to update it without restarting.' : '');
    onMap = false; document.body.classList.remove('world-view'); $('operations-toggle').hidden = false; $('explorer').hidden = true; $('construction').hidden = false; $('map-return').hidden = false;
    text('project-name', selected.name); text('project-location', selected.place + ' / ' + (selected.type === 'space' ? 'Civil expansion' : 'Representative construction phase'));
    buildBoard(); openOperations(false, false); hud(); window.scrollTo({ top: 0 }); $('run-project').focus();
    try {
        if (!scene) { const { CampusScene } = await import('./jobsite-campus-scene.js'); scene = new CampusScene($('campus-canvas'), () => { pause(); $('scene-error').hidden = false; }); }
        scene.configure(state); const initialView=state.modelRevision===2?'site':'work'; scene.setCamera(initialView); document.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-pressed', b.dataset.view === initialView)); $('scene-error').hidden = true;
    } catch (_) { $('scene-error').hidden = false; }
    dirty = true; save();
}
function showMap() { pause(); onMap = true; document.body.classList.add('world-view'); $('operations-toggle').hidden = true; openOperations(false, false); $('explorer').hidden = false; $('construction').hidden = true; $('map-return').hidden = true; choose(selected.id); world?.resize(); window.scrollTo({ top: 0 }); $('mobilize-campus').focus(); }
$('mobilize-campus').addEventListener('click', mobilize); $('map-return').addEventListener('click', showMap); $('choose-next').addEventListener('click', showMap);
function toggleRun() {
    if (!state || state.complete || onMap || $('field-guide').open) return;
    if (state.running) state.running = false;
    else {
        if (['stopped', 'ready'].includes(state.safety.stage)) scene?.activity.regroup();
        C.startProject(state);
    }
    dirty = true; hud();
}
$('run-project').addEventListener('click', toggleRun);
$('speed').addEventListener('change', e => { state.speed = Number(e.target.value); dirty = true; });
$('next-action').addEventListener('click', () => { nextAction(); dirty = true; hud(); });
function desk(allocation) {
    let title, copy, button, action;
    if (state.complete) { title = 'Ready for the owner.'; copy = 'Every work package is accepted. Review the project record or explore another site.'; button = 'Choose next project'; action = showMap; }
    else if (!state.running) { title = state.day === 0 ? 'Ready to break ground.' : 'Project paused.'; copy = 'Crews, equipment, deliveries and inspection releases run automatically. Start the clock to watch the project take shape.'; button = state.day === 0 ? 'Start construction' : 'Run project'; action = toggleRun; }
    else if (state.safety.stage === 'review') { title = 'Safety stand-down review.'; copy = state.safety.remaining.toFixed(2) + ' scenario days remaining. Traffic separation is restored. Construction resumes automatically after the review.'; button = 'See site traffic'; action = () => setTab('resources'); }
    else if (!allocation.active.length && allocation.passive.length) { title = 'Concrete is curing.'; copy = 'Elapsed curing and test time frees the crew and pump. Inspection follows automatically before the next load goes on the foundation.'; button = 'Explore the sequence'; action = () => setTab('work'); }
    else if (!allocation.active.length) { title = 'Waiting on the next handoff.'; copy = (Object.values(allocation.reasons).find(r => !['Complete', 'Not dispatched'].includes(r)) || 'Preparing the next work front') + '. Work resumes automatically when conditions are ready.'; button = 'Explore the sequence'; action = () => setTab('work'); }
    else { title = allocation.active.length + ' work fronts moving.'; copy = allocation.active.map(t => t.name).join('. ') + '. Crews and inspections keep the project moving automatically.'; button = 'Explore crews + equipment'; action = () => setTab('resources'); }
    text('next-title', title); text('next-copy', copy); text('next-action', button); nextAction = action;
}
function hud() {
    if (!state || onMap) return;
    const a = C.allocation(state), p = C.site(state.site), progress = C.progress(state), workers = a.active.reduce((n, t) => n + C.TRADES[t.trade].people, 0), payroll = Object.entries(state.crews).reduce((n, [k, count]) => n + count * C.TRADES[k].people, 0);
    text('run-project', state.complete ? 'Handed over' : state.running ? 'Pause project' : 'Run project'); $('run-project').disabled = state.complete;
    if(state.day===0&&!Object.values(state.tasks).some(t=>t.enabled))text('run-project','Start construction');
    text('safety-status',state.safety.incidents+(state.safety.incidents===1?' incident / ':' incidents / ')+state.safety.lostDays.toFixed(1)+' stand-down days'+(Object.keys(state._siteHolds||{}).length?' / equipment yielding at a crossing':''));
    text('metric-progress', Math.floor(progress * 100) + '%'); $('overall-progress').style.width = progress * 100 + '%';
    text('metric-day', Math.floor(state.day)); text('metric-target', 'Target ' + p.target + ' days' + (state.day > p.target ? ' / over target' : ''));
    text('metric-cost', money(state.spent)); text('metric-budget', money(state.budget) + ' allowance' + (state.spent > state.budget ? ' / over allowance' : ''));
    text('metric-workers', (state.running ? workers : 0) + ' / ' + payroll); text('metric-active', a.active.length + (state.running ? ' active work fronts' : ' ready work fronts'));
    const w = C.weather(state); text('weather-label', w.name); text('weather-next', 'Scenario weather changes in ' + w.ends.toFixed(1) + ' days.');
    for (const t of C.plan(state)) {
        const ts = state.tasks[t.id], r = taskRows.get(t.id), status = a.reasons[t.id]; r.row.dataset.status = status;
        r.row.querySelector('.work-state span').textContent = status === 'Working' ? (state.running ? (t.reachWork ? C.workPhase(state,t).label : t.gate ? 'Inspection in progress' : 'Working') : 'Ready / project paused') : status==='Curing / test wait' ? (state.running ? status : 'Curing clock paused') : status === 'Not dispatched' ? 'Scheduled automatically' : status === 'Inspection release needed' ? 'Automatic release pending' : status;
        r.row.querySelector('.work-state small').textContent = ts.start !== null ? 'Started day ' + Math.floor(ts.start) + (ts.finish !== null ? ' / accepted day ' + Math.ceil(ts.finish) : '') : (t.elapsed ? 'No crew assigned / elapsed time' : C.TRADES[C.workPhase(state,t).trade||t.trade].people + ' people') + ' / ' + (t.equipment ? C.EQUIPMENT[t.equipment].name : 'Field team');
        r.row.querySelector('.work-amount span').textContent = Math.floor(ts.progress * 100) + '%'; r.row.querySelector('.progress i').style.width = ts.progress * 100 + '%';
    }
    for (const r of resourceRows.values()) {
        const count = state[r.group][r.key], active = count - (r.group === 'crews' ? a.labor[r.key] : a.equipment[r.key]);
        r.amount.textContent = count ? count + (r.group === 'crews' ? ' crew' : ' spread') + (count > 1 ? 's' : '') : 'Off site';
        r.card.querySelector('.resource-stats').textContent = count ? active + ' assigned / ' + money(count * r.item.rate) + '/day' + (r.item.people ? ' / ' + count * r.item.people + ' people' : '') : state.complete ? 'Demobilized / project complete' : 'Mobilizes automatically when needed';
    }
    for (const [key, r] of deliveryRows) {
        const o = state.orders[key]; r.card.querySelector('.resource-stats').textContent = !o.ordered ? 'Orders automatically when construction starts' : o.arrival > state.day ? 'Ordered / due day ' + Math.ceil(o.arrival) + ' / ' + (o.arrival - state.day).toFixed(1) + ' days remaining' : 'Delivered / ' + o.used + ' of ' + C.MATERIALS[key].quantity + ' packages installed or in work';
    }

    const milestones = [['Site access + controls', ['controls']], ['Formation accepted', ['formation']], ['Structures erected', ['a-frame', 'b-frame']], ['Buildings + plant complete', ['a-fitout', 'b-fitout', 'power', 'cooling']], ['Startup verified', ['startup']], ['Functional tests passed', ['functional']], ['Systems commissioned', ['test']], ['Owner handover', ['handover']]];
    $('milestones').replaceChildren(); let current = false;
    for (const [name, ids] of milestones) { const li = document.createElement('li'), complete = ids.every(id => C.done(state, id)); li.textContent = name; li.className = complete ? 'done' : current ? '' : 'current'; if (!complete) current = true; $('milestones').append(li); }
    if (scene?.activity) { text('scene-activity', state.running ? scene.activity.title + ' / ' + scene.activity.detail : 'Project paused / equipment and crews stopped'); text('site-attendance', scene.activity.workerCount + ' people on site / ' + scene.activity.parkedCount + ' vehicles parked'); }
    desk(a); $('completion').hidden = !state.complete;
    const report = C.report(state);
    text('completion-report', 'Score ' + report.score + '/100. ' + report.days + ' scenario days / ' + money(report.cost) + ' / ' + report.laborHours.toLocaleString() + ' productive labor hours. ' + (report.onTime ? 'Within schedule target.' : 'Beyond schedule target.') + ' ' + (report.onBudget ? 'Within cost allowance.' : 'Beyond cost allowance.'));
    text('process-save-note',state.migratedFrom===1?'Earlier progress retained. '+state.legacyCredits.length+' newly separated prerequisites received legacy credit; remaining work follows the updated sequence. Saving this upgrade requires a device backup of the original save.':'Process model 2 / 44 work packages. Durations, crew sizes and acceptance outcomes are illustrative.');
    text('project-record-metrics', Math.round(state.laborHours).toLocaleString() + ' productive labor hours / ' + state.peakWorkers + ' peak working people / ' + state.idleDays.toFixed(1) + ' days with no productive work / '+report.incidents+' equipment contacts / '+report.standDownDays.toFixed(1)+' stand-down days.');
    $('project-log').replaceChildren(); for (const entry of state.log) { const li = document.createElement('li'); li.textContent = 'Day ' + Math.floor(entry.day) + ': ' + entry.message; $('project-log').append(li); }
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
    if (!state) return; state = newProject(state.site); storageBlocked = false; readSave(state.site); notice(''); dirty = true; buildBoard(); scene?.configure(state); hud(); save();
});
$('apply-site-model').addEventListener('click',()=>{
    if(!state||state.modelRevision===2||storageBlocked)return;
    pause();
    if(storageBlocked)return;
    try{
        const key=prefix+state.site,raw=localStorage.getItem(key);
        if(raw!==knownSaves.get(state.site))throw Error('Another tab changed this save. Reload before applying the model.');
        if(raw&&!localStorage.getItem(key+':before-site-model'))localStorage.setItem(key+':before-site-model',raw);
    }catch(error){notice('The original layout could not be backed up. '+error.message);return;}
    state.modelRevision=2;dirty=true;buildBoard();scene?.configure(state);hud();save();
    notice('Researched layout applied. All quantities, costs, deliveries and inspection releases are retained. The original layout is backed up on this device.');
});
$('export-record').addEventListener('click', () => {
    const data = { notice: 'Illustrative game scenario, not a project estimate or engineering record.', project: C.site(state.site), siteModel: {revision:state.modelRevision,...C.model(state),checked:C.MODELS.checked}, report: C.report(state), workPackages: C.plan(state).map(t => ({ ...t, ...state.tasks[t.id] })), state };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = 'jobsite-' + state.site + '-record.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
});
function loop(now) {
    const dt = Math.min(.1, (now - (last || now)) / 1000); last = now;
    if (onMap && !document.hidden && !$('field-guide').open && now - renderTime > 33) { world?.render(Math.min(.1, (now - renderTime) / 1000)); renderTime = now; }
    if (!onMap && state) {
        if (state.running && !$('field-guide').open) { C.supervise(state); scene?.prepare(state,dt / 12 * state.speed); C.advanceProject(state, dt / 12 * state.speed); dirty = true; }
        if (now - hudTime > 250) { hud(); hudTime = now; }
        if (!document.hidden && !$('field-guide').open && now - renderTime > 33) { scene?.render(state, Math.min(.1, (now - renderTime) / 1000)); renderTime = now; }
        if (now - saveTime > 2000) { save(); saveTime = now; }
    }
    requestAnimationFrame(loop);
}
choose(selected.id); document.body.dataset.campusReady = 'true'; loadWorld();
if (location.hash === '#how-to-play') $('field-guide').showModal();
requestAnimationFrame(loop);

for(const source of Object.values(C.PROCESS_SOURCES)){const a=document.createElement('a');a.href=source.url;a.textContent=source.title;a.target='_blank';a.rel='noopener';a.className='process-source';$('process-sources').append(a);}
