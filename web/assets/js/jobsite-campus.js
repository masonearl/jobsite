(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.JobsiteCampus = factory();
})(typeof globalThis === 'object' ? globalThis : this, function () {
    'use strict';
    // Public project identities are separate from the deliberately compressed game model.
    const SITES = [
        { id: 'stratos', name: 'Stratos', place: 'Box Elder County, Utah', type: 'data', lat: 41.8, lon: -112.8, biome: 'mountain', climate: 'Dry ground / wind windows', earth: 1.2, weather: 'wind', target: 55,
          status: 'Proposed development', fact: 'Box Elder County describes a proposed phased technology and energy campus, with roads, water and power infrastructure. This scenario builds a representative data-center phase, not the full Stratos development.', source: 'Box Elder County project fact sheet', url: 'https://www.boxeldercountyut.gov/647/Stratos-Project-Fact-Sheet', date: 'Public fact sheet, checked September 9, 2026' },
        { id: 'abilene', name: 'Stargate / Abilene', place: 'Abilene, Texas', type: 'data', lat: 32.45, lon: -99.73, biome: 'desert', climate: 'Dry heat / slower outdoor shifts', earth: 1, weather: 'heat', target: 54,
          status: 'Operating campus / scenario rebuild', fact: 'OpenAI reports that its flagship Stargate site operates on Oracle Cloud Infrastructure. Play a fictional new two-hall phase from bare ground; the game does not depict the campus as unbuilt.', source: 'OpenAI infrastructure update', url: 'https://openai.com/index/building-the-compute-infrastructure-for-the-intelligence-age/', date: 'April 29, 2026' },
        { id: 'saline', name: 'Stargate / The Barn', place: 'Saline, Michigan', type: 'data', lat: 42.17, lon: -83.78, biome: 'forest', climate: 'Wet ground / rain delays', earth: 1.15, weather: 'rain', target: 57,
          status: 'Groundbreaking announced June 2026', fact: 'OpenAI announced groundbreaking for The Barn, a 1 GW campus with Oracle, Related Digital and Walbridge. The playable two-hall phase uses illustrative quantities and trades.', source: 'OpenAI Michigan groundbreaking', url: 'https://openai.com/index/stargate-michigan-data-center/', date: 'June 1, 2026' },
        { id: 'dona-ana', name: 'Stargate / New Mexico', place: 'Doña Ana County, New Mexico', type: 'data', lat: 32.1, lon: -106.8, biome: 'desert', climate: 'Desert ground / heat delays', earth: 1.1, weather: 'heat', target: 55,
          status: 'Site announced September 2025', fact: 'OpenAI named Doña Ana County as one of its additional Stargate sites being developed with Oracle. This is a construction scenario inspired by the announcement, not a live project-progress feed.', source: 'OpenAI Stargate site announcement', url: 'https://openai.com/index/five-new-stargate-sites/', date: 'September 23, 2025' },
        { id: 'indiana', name: 'AWS / New Carlisle', place: 'New Carlisle, Indiana', type: 'data', lat: 41.7, lon: -86.5, biome: 'forest', climate: 'Wet ground / rain delays', earth: 1.1, weather: 'rain', target: 56,
          status: 'Campus investment announced April 2024', fact: 'AWS announced a data-center campus at Indiana Enterprise Center in St. Joseph County. Build a representative phase; the scenario is not an AWS design or current construction schedule.', source: 'AWS Indiana investment announcement', url: 'https://www.aboutamazon.com/news/aws/aws-indiana-investment-11-billion', date: 'April 25, 2024' },
        { id: 'starbase', name: 'SpaceX / Starbase', place: 'Boca Chica, Texas', type: 'space', lat: 25.99, lon: -97.15, biome: 'coast', climate: 'Coastal ground / crane wind holds', earth: 1.25, weather: 'wind', target: 66,
          status: 'Existing launch site / civil works scenario', fact: 'The FAA identifies Starbase at Boca Chica as a Starship development and flight-test site. Build a fictional civil expansion with a pad, integration building, tower and support utilities. Rocket operations are outside this scenario.', source: 'FAA project background', url: 'https://www.faa.gov/space/stakeholder_engagement/spacex_starship_ksc', date: 'FAA background, checked September 9, 2026' },
        { id: 'terafab', name: 'Terafab', place: 'Grimes County, Texas', type: 'fab', lat: 30.61, lon: -96.08, biome: 'forest', climate: 'Clay ground / rain delays', earth: 1.3, weather: 'rain', target: 65,
          status: 'Location announced August 2026', fact: 'SpaceX announced Grimes County as the location for Terafab, combining logic, memory and advanced packaging. This game models a representative fab phase with cleanrooms and process utilities, not the announced full-scale factory.', source: 'SpaceX Terafab announcement', url: 'https://new.spacex.com/updates', date: 'August 6, 2026' }
    ];
    const TRADES = {
        survey: { name: 'Survey + field engineering', people: 4, rate: 3200, detail: 'Surveyors, field engineer and inspector' },
        earth: { name: 'Earthwork gang', people: 8, rate: 5800, detail: 'Operators, haul drivers, grade checker and laborers' },
        civil: { name: 'Underground utility crew', people: 7, rate: 5400, detail: 'Operator, pipe layers, top person and laborers' },
        concrete: { name: 'Concrete crew', people: 12, rate: 8400, detail: 'Form carpenters, reinforcing ironworkers and finishers' },
        steel: { name: 'Steel + enclosure crew', people: 10, rate: 7800, detail: 'Ironworkers, riggers, roofers and cladding installers' },
        electrical: { name: 'Electrical crew', people: 10, rate: 8600, detail: 'Electricians, cable crew and equipment specialists' },
        mechanical: { name: 'Mechanical crew', people: 10, rate: 8200, detail: 'Pipefitters, plumbers, HVAC and fire-protection trades' },
        fitout: { name: 'Fit-out crew', people: 8, rate: 6500, detail: 'Installers, low-voltage technicians and specialty trades' },
        testing: { name: 'Commissioning team', people: 6, rate: 6200, detail: 'Controls technicians, test engineers and owner representatives' }
    };
    const EQUIPMENT = {
        earth: { name: 'Earthmoving spread', rate: 4200, detail: '2 excavators, 2 dozers, 4 haul trucks, grader, roller, water truck' },
        trench: { name: 'Utility spread', rate: 1800, detail: 'Excavator, backfill backhoe, compactor and dewatering pump' },
        pump: { name: 'Concrete spread', rate: 2600, detail: 'Concrete pump, mixer-truck rotation and finishing equipment' },
        crane: { name: 'Crane + rigging spread', rate: 4000, detail: 'Mobile crane, telehandler and rigging' },
        lift: { name: 'Access equipment', rate: 1100, detail: '2 boom lifts, 2 scissor lifts and a forklift' },
        test: { name: 'Commissioning equipment', rate: 1800, detail: 'Load banks, test instruments and flushing equipment' }
    };
    const MATERIALS = {
        steel: { name: 'Fabricated steel', lead: 10, cost: 900000, quantity: 2 },
        power: { name: 'Transformers + switchgear', lead: 28, cost: 3800000, quantity: 1 },
        cooling: { name: 'Cooling plant packages', lead: 22, cost: 2400000, quantity: 1 },
        fitout: { name: 'Specialty fit-out packages', lead: 18, cost: 1900000, quantity: 2 }
    };
    const site = id => SITES.find(s => s.id === id) || SITES[0];
    function legacyPlan(id) {
        const p = site(id), space = p.type === 'space', fab = p.type === 'fab', tasks = [];
        const add = (key, name, deps, days, trade, equipment, zone, quantity, lesson, options = {}) => tasks.push({ id: key, name, deps, days, trade, equipment, zone, quantity, lesson, outdoor: true, cost: days * 18000, ...options });
        add('survey', 'Survey, approvals + mobilization', [], 2, 'survey', null, 'access', '1 released work area', 'Design release, site access and environmental controls precede field production. Real approvals are not compressed to two days.', { cost: 120000 });
        add('clear', 'Clear, strip + build access', ['survey'], 3, 'earth', 'earth', 'access', '12 ha scenario work area', 'Access roads, laydown and erosion controls give crews somewhere to work.');
        add('grade', 'Mass grading + balanced earthwork', ['clear'], 7 * p.earth, 'earth', 'earth', 'yard', '48,000 m3 cut and fill', 'Excavators and haul trucks cycle autonomously. Retain suitable material for engineered fill; disposal and imported fill are separate flows.');
        add('drain', 'Drainage, water + fire main', ['clear'], 6 * p.earth, 'civil', 'trench', 'utilities', '1,200 m utility corridor', 'The pipe crew follows excavation; backfill follows accepted installation. Utility work can advance beside grading.');
        add('duct', 'Electrical duct banks + fiber routes', ['drain'], 4, 'civil', 'trench', 'utilities', '800 m duct-bank corridor', 'Underground routes must be in place before finished paving and equipment terminations.');
        add('formation', 'Formation + underground inspection', ['grade', 'drain'], 1, 'survey', null, 'yard', '1 inspection release', 'Accept the formation and buried work before covering it with permanent foundations.', { gate: true });
        ['a', 'b'].forEach((h, i) => {
            const title = space ? (i ? 'Integration building' : 'Launch pad + tower') : fab ? (i ? 'Packaging hall' : 'Process fab') : 'Data hall ' + h.toUpperCase();
            add(h + '-slab', title + ' / foundations', ['formation'], space && !i ? 8 : 5, 'concrete', 'pump', h, space && !i ? '4,800 m3 reinforced foundation' : '3,000 m3 foundations + slab', 'Formwork, reinforcing, embedded services, concrete placement and curing create the next work front. Curing includes elapsed time.', { cost: 800000 });
            add(h + '-frame', title + ' / structure', [h + '-slab'], space && !i ? 9 : 5, 'steel', 'crane', h, space && !i ? '8 illustrative tower modules' : '850 t steel frame', 'The crane is shared with plant installation. Prioritize the work front that releases the most following trades.', { material: 'steel', cost: 400000 });
            add(h + '-envelope', title + (space && !i ? ' / platforms + access' : ' / weather-tight enclosure'), [h + '-frame'], 4, 'steel', 'lift', h, '1 enclosed work front', 'A weather-tight building allows indoor fit-out to continue when outdoor work slows.', { cost: 650000 });
            add(h + '-mep', title + (fab ? ' / process utilities' : space ? ' / support services' : ' / power, cooling + fire protection'), [h + '-envelope', 'duct'], fab ? 8 : 6, 'mechanical', 'lift', h, fab ? '1 process-utility zone' : '1 services zone', 'Piping, fire protection and air systems are coordinated before final specialty equipment is placed.', { outdoor: false, cost: 1000000 });
            add(h + '-electric', title + ' / distribution + controls', [h + '-envelope', 'duct'], 5, 'electrical', 'lift', h, '1 distribution zone', 'Electrical crews share access equipment with mechanical trades. More lifts only help when the matching labor is available.', { outdoor: false, cost: 950000 });
            add(h + '-fitout', title + (fab ? ' / cleanroom + tool install' : space ? ' / ground-support fit-out' : ' / racks + network install'), [h + '-mep', h + '-electric'], fab ? 7 : 4, 'fitout', 'lift', h, fab ? '1 cleanroom and tool zone' : space ? '1 support-system zone' : '240 scenario rack positions', 'Specialty fit-out needs completed services and delivered equipment. The package includes installation only, not an operating process.', { outdoor: false, material: 'fitout', cost: 700000 });
        });
        add('power', 'Substation + standby power yard', ['duct', 'formation'], 6, 'electrical', 'crane', 'power', '1 power-yard package', 'Long-lead transformers and switchgear can delay commissioning even after the building looks complete.', { material: 'power', cost: 1300000 });
        add('cooling', space ? 'Water + site-services plant' : fab ? 'Process water + cooling plant' : 'Closed-loop cooling plant', ['drain', 'formation'], 6, 'mechanical', 'crane', 'cooling', '1 plant package', 'Complete the plant and distribution loops before integrated system testing.', { material: 'cooling', cost: 900000 });
        add('roads', 'Final paving + site restoration', ['duct', 'a-frame', 'b-frame'], 4, 'earth', 'earth', 'access', '8,000 m2 paving + restoration', 'Keep heavy lifting access available until the structure is erected, then restore disturbed ground.');
        add('release', 'Pre-energization inspection', ['power', 'cooling', 'a-electric', 'b-electric'], 1, 'testing', 'test', 'power', '1 inspection release', 'An inspection hold prevents the simulation from energizing incomplete systems.', { gate: true, outdoor: false });
        add('test', fab ? 'Facility qualification + controls testing' : space ? 'Civil systems acceptance tests' : 'Integrated systems commissioning', ['release', 'a-fitout', 'b-fitout'], fab ? 7 : 5, 'testing', 'test', 'yard', '1 integrated test program', 'Installed is not commissioned. Controls, power and mechanical systems must function together before handover.', { outdoor: false, cost: 250000 });
        add('handover', 'Punch list, records + owner handover', ['test', 'roads'], 2, 'testing', null, 'yard', '1 accepted project phase', 'Close defects, deliver records and obtain acceptance. Completion counts the entire scope, not just the shell.', { outdoor: false, gate: true, cost: 80000 });
        return tasks;
    }
    const PROCESS_SOURCES = {
        sequencing: { title: 'EPA / construction sequencing', url: 'https://www.epa.gov/system/files/documents/2021-11/bmp-construction-sequencing.pdf' },
        excavation: { title: 'OSHA / excavation requirements', url: 'https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926.651' },
        utilities: { title: 'Salt Lake City / utility inspection practices', url: 'https://www.slcdocs.com/utilities/PDF%20Files/Std_practices_090105.pdf' },
        compaction: { title: 'Salt Lake City / trench compaction and quality records', url: 'https://slcdocs.com/utilities/PDF%20Files/SSMP%20Program.pdf' },
        water: { title: 'UFGS / water utility distribution piping', url: 'https://www.wbdg.org/FFC/DOD/UFGS/UFGS%2033%2011%2000.pdf' },
        concrete: { title: 'OSHA / cast-in-place concrete', url: 'https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926.703' },
        erection: { title: 'OSHA / steel erection release and access', url: 'https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926.752' },
        commissioning: { title: 'Vertiv / commissioning process', url: 'https://www.vertiv.com/en-us/services-catalog/services/project-services/engineering/' },
        overlap: { title: 'Microsoft / an active datacenter construction sequence', url: 'https://local.microsoft.com/blog/boyd-farms-datacenter-construction-update/' }
    };
    const planCache = new Map();
    function plan(id) {
        id=site(id).id;if(planCache.has(id))return planCache.get(id).slice();
        const tasks = legacyPlan(id), byId = Object.fromEntries(tasks.map(t => [t.id, t]));
        const change = (key, fields) => Object.assign(byId[key], fields);
        const add = (key, name, deps, days, trade, equipment, zone, lesson, options = {}) => {
            const t = { id:key, name, deps, days, trade, equipment, zone, lesson, quantity:'1 released work area', outdoor:true, cost:days*18000, ...options }; tasks.push(t); byId[key]=t;
        };
        change('survey', { name:'Design release, setout + utility locates', lesson:'The scenario starts with an approved design. Survey and existing-utility verification precede excavation; actual permitting and utility-owner response times remain outside the game.', sources:['excavation'] });
        add('controls', 'Construction entrance, drainage + erosion controls', ['survey'], 1, 'earth', 'earth', 'access', 'Prepare access, separated pedestrian routes and sediment controls before bulk disturbance. Maintain those controls while each work area is open.', {sources:['sequencing','erection']});
        change('clear', {deps:['controls'], sources:['sequencing']});
        change('grade', {sources:['sequencing'], lesson:'Cut suitable banks, haul to low areas, spread and compact engineered fill. The scene uses representative cut/fill cells; material suitability, moisture and density testing require project specifications.'});
        for(const key of ['drain','duct']) change(key, { reachWork:true, deps:['clear'], sources:['excavation','utilities','compaction','water'], lesson:'Work in six short reaches. Excavation leads bedding and installation; a field check releases each reach to backfill, then a density check closes it. Survey capacity is shared with other inspections. Water-system acceptance is a separate package; test timing depends on the specified system.' });
        add('utility-test', 'Utility testing, flushing + records', ['drain','duct'], 1.5, 'civil', 'test', 'utilities', 'Verify installed utilities with the specified tests, flushing and records before service connections and final surfacing. Water, storm and electrical routes require different acceptance checks; the game groups them into one release.', {gate:true,sources:['water','utilities']});
        change('formation', {name:'Building-pad formation acceptance',deps:['grade'],sources:['sequencing'],lesson:'Accept the building pad while off-footprint utility crews continue in separate work areas. This is a zone-based handoff, not a requirement to finish all campus earthwork before any foundation.'});
        for(const h of ['a','b']) {
            const title=byId[h+'-slab'].name.split(' / ')[0];
            add(h+'-prep', title+' / foundation excavation + base', ['formation'], 1.5, 'earth', 'earth', h, 'Excavate foundation locations and prepare bearing surfaces and base before formwork and reinforcing.', {sources:['concrete'],quantity:'1 foundation work front'});
            add(h+'-rebar', title+' / forms, reinforcing + embeds', [h+'-prep'], 1.5, 'concrete', null, h, 'Place forms, reinforcing, anchor assemblies and coordinated embedded services before the concrete crew requests a pour check.', {sources:['concrete'],quantity:'1 prepared pour'});
            add(h+'-pour-check', title+' / pre-pour inspection', [h+'-rebar'], .5, 'survey', null, h, 'Verify the prepared pour and covered services before concrete placement. This field check is automatic when a survey/inspection crew is available.', {sources:['concrete','utilities'],quantity:'1 pour release'});
            change(h+'-slab', {name:title+' / concrete placement', deps:[h+'-pour-check'], days:site(id).type==='space'&&h==='a'?5:3, sources:['concrete'],lesson:'Pump, place and finish concrete after the prepared pour is checked. Placement releases the pump and crew; curing and strength verification are separate activities.'});
            add(h+'-cure', title+' / curing + test wait', [h+'-slab'], 3, null, null, h, 'Elapsed curing/test time continues without an assigned crew or pump. Three scenario days is a gameplay wait, not a real strength prediction or permission to load concrete.', {elapsed:true,outdoor:false,cost:0,sources:['concrete','erection'],quantity:'3 scenario days / elapsed time'});
            add(h+'-strength', title+' / strength + anchor release', [h+'-cure'], .5, 'survey', null, h, 'Review the representative strength evidence and anchor condition before releasing steel erection. Real erection requires the controlling contractor’s written notification and suitable test evidence; elapsed time alone is insufficient.', {gate:true,sources:['erection'],quantity:'1 erection release'});
            change(h+'-frame', {deps:[h+'-strength'],sources:['erection']});
            change(h+'-envelope', {sources:['overlap']});
            change(h+'-mep', {sources:['commissioning','overlap']});
            change(h+'-electric', {sources:['commissioning']});
            change(h+'-fitout', {sources:['commissioning']});
        }
        for(const key of ['power','cooling']) {
            const name=key==='power'?'Power-yard':'Cooling-plant';
            add(key+'-pad', name+' equipment foundations', ['formation'], 2, 'concrete', 'pump', key, 'Prepare reinforced equipment foundations and cast the supports before delivery and setting of heavy plant.', {sources:['concrete'],quantity:'1 equipment pad'});
            add(key+'-cure', name+' curing + test wait', [key+'-pad'], 3, null, null, key, 'Reserve elapsed time for curing and test results without occupying the installation crane. The duration is an illustrative game allowance.', {elapsed:true,outdoor:false,cost:0,sources:['concrete'],quantity:'3 scenario days / elapsed time'});
            add(key+'-ready', name+' foundation release', [key+'-cure'], .5, 'survey', null, key, 'The field team verifies foundation readiness before plant loading. A completed timer alone does not constitute a real structural release.', {sources:['concrete'],quantity:'1 foundation release'});
            change(key, {deps:[key==='power'?'duct':'drain',key+'-ready'],sources:['commissioning','concrete']});
        }
        change('roads', {deps:['utility-test','a-frame','b-frame','power','cooling'],sources:['utilities','erection'],lesson:'Keep haul and crane access until major structure and plant lifts finish. Complete utility acceptance and density records before permanent surfacing and restoration.'});
        change('release', {deps:['utility-test','power','cooling','a-electric','b-electric'],sources:['commissioning'],lesson:'Check installation records, distribution and mechanical readiness before authorized energization. The game does not energize a campus just because the plant equipment is visible.'});
        add('startup', 'Vendor startup + pre-functional checks', ['release','a-mep','b-mep'], 2, 'testing', 'test', 'power', 'Verify installation, manufacturer startup and individual equipment operation before system performance tests.', {outdoor:false,sources:['commissioning'],quantity:'1 startup program'});
        add('functional', 'Functional performance tests', ['startup','a-fitout','b-fitout'], 2, 'testing', 'test', 'cooling', 'Prove individual system operation and control sequences before testing the facility as a whole.', {outdoor:false,sources:['commissioning'],quantity:'1 functional test program'});
        change('test', {deps:['functional'],sources:['commissioning'],lesson:'After functional tests, verify power, cooling, controls and backup arrangements together under representative load and failure scenarios. The game advances a test sequence, not a live electrical test procedure.'});
        change('handover', {sources:['commissioning'],lesson:'Resolve the punch list and deliver test records, operating manuals and owner training before acceptance. Construction completion is distinct from operational readiness.'});
        // Keep the board in dependency order, while allowing independent work fronts to overlap.
        const ordered=[],pending=tasks.slice();
        while(pending.length){const i=pending.findIndex(t=>t.deps.every(d=>ordered.some(p=>p.id===d)));if(i<0)throw Error('Construction plan has a dependency cycle');ordered.push(...pending.splice(i,1));}
        planCache.set(id,ordered);return ordered.slice();
    }
    const REACH_COUNT=6;
    function workPhase(s,t) {
        if(!t.reachWork)return {label:t.elapsed?'Curing / awaiting test evidence':t.name,end:1};
        const p=s.tasks[t.id].progress,reach=Math.min(REACH_COUNT-1,Math.floor((p+1e-9)*REACH_COUNT)),f=p*REACH_COUNT-reach;
        const steps=[{end:.5,label:'Excavate, bed + install',trade:'civil',equipment:'trench'}, {end:.6,label:'Inspect installation before cover',trade:'survey',equipment:null}, {end:.92,label:'Backfill + compact lifts',trade:'civil',equipment:'trench'}, {end:1,label:'Density check + reach records',trade:'survey',equipment:null}];
        const step=steps.find(step=>f<step.end-1e-8)||steps.at(-1);
        return {...step,end:(reach+step.end)/REACH_COUNT,reach:reach+1,label:'Reach '+(reach+1)+'/'+REACH_COUNT+' / '+step.label};
    }
    function create(id) {
        id = site(id).id;
        return { version: 2, site: id, day: 0, running: false, speed: 1, complete: false, spent: 0, budget: site(id).type === 'fab' ? 33000000 : site(id).type === 'space' ? 32000000 : 31000000, laborHours: 0, idleDays: 0, peakWorkers: 0,
            crews: Object.fromEntries(Object.keys(TRADES).map(k => [k, 1])), equipment: Object.fromEntries(Object.keys(EQUIPMENT).map(k => [k, k === 'lift' ? 2 : 1])),
            tasks: Object.fromEntries(plan(id).map(t => [t.id, { progress: 0, enabled: false, accepted: false, started: false, priority: 0, start: null, finish: null }])),
            orders: Object.fromEntries(Object.keys(MATERIALS).map(k => [k, { ordered: false, arrival: null, used: 0, expedited: false }])), log: [] };
    }
    function note(s, message) { s.log.unshift({ day: s.day, message }); s.log.length = Math.min(s.log.length, 30); }
    function weather(s) {
        const kind = site(s.site).weather, phase = s.day % 12;
        if (phase >= 7 && phase < 9) return { name: kind === 'wind' ? 'High wind / crane hold' : kind === 'rain' ? 'Rain / outdoor work at 55%' : 'Heat / outdoor work at 75%', factor: kind === 'rain' ? .55 : kind === 'heat' ? .75 : 1, crane: kind === 'wind', ends: 9 - phase };
        return { name: 'Clear work window', factor: 1, crane: false, ends: phase < 7 ? 7 - phase : 19 - phase };
    }
    function done(s, id) { return s.tasks[id]?.accepted === true; }
    function readiness(s, t) {
        const state = s.tasks[t.id];
        if (state.accepted) return 'Complete';
        if (state.progress >= 1) return 'Inspection release needed';
        if (!state.enabled && !t.elapsed) return 'Not dispatched';
        const missing = t.deps.filter(id => !done(s, id));
        if (missing.length) return 'Waiting for ' + missing.map(id => plan(s.site).find(x => x.id === id).name).join(', ');
        if (t.material && !state.started) {
            const order = s.orders[t.material];
            if (!order.ordered) return 'Order ' + MATERIALS[t.material].name.toLowerCase();
            if (order.arrival > s.day) return MATERIALS[t.material].name + ' arrives day ' + Math.ceil(order.arrival);
            if (order.used >= MATERIALS[t.material].quantity) return 'Material unavailable';
        }
        if (t.equipment === 'crane' && weather(s).crane) return 'High wind / crane hold';
        return 'Ready';
    }
    function allocation(s) {
        const labor = { ...s.crews }, equipment = { ...s.equipment }, active = [], passive = [], reasons = {};
        const tasks = plan(s.site).sort((a, b) => s.tasks[b.id].priority - s.tasks[a.id].priority || Number(s.tasks[b.id].started) - Number(s.tasks[a.id].started));
        for (const original of tasks) {
            const phase=workPhase(s,original),t={...original,...(original.reachWork?{trade:phase.trade,equipment:phase.equipment}:{}),phase:phase.label};
            let why = readiness(s, t);
            if (why==='Ready' && t.elapsed) { passive.push(t); reasons[t.id]='Curing / test wait'; continue; }
            if (why === 'Ready' && labor[t.trade] < 1) why = 'Waiting for ' + TRADES[t.trade].name.toLowerCase();
            if (why === 'Ready' && t.equipment && equipment[t.equipment] < 1) why = 'Waiting for ' + EQUIPMENT[t.equipment].name.toLowerCase();
            if (why === 'Ready') { active.push(t); labor[t.trade]--; if (t.equipment) equipment[t.equipment]--; }
            reasons[t.id] = why === 'Ready' ? 'Working' : why;
        }
        return { active, passive, reasons, labor, equipment };
    }
    function dispatch(s, id, enabled) {
        if (s.complete) return;
        for (const t of plan(s.site)) if (id === 'all' || t.id === id) s.tasks[t.id].enabled = enabled;
    }
    function order(s, key) {
        if (!MATERIALS[key] || s.orders[key].ordered || s.complete) return false;
        const m = MATERIALS[key]; s.orders[key] = { ordered: true, arrival: s.day + m.lead, used: 0, expedited: false };
        s.spent += m.cost * m.quantity; note(s, m.name + ' ordered; due day ' + Math.ceil(s.orders[key].arrival) + '.'); return true;
    }
    function expedite(s, key) {
        const o = s.orders[key];
        if (!o?.ordered || o.expedited || o.arrival <= s.day || s.complete) return false;
        o.arrival = s.day + (o.arrival - s.day) * .55; o.expedited = true;
        s.spent += MATERIALS[key].cost * MATERIALS[key].quantity * .2; note(s, MATERIALS[key].name + ' expedited at 20% premium.'); return true;
    }
    function capacity(s, group, key, delta) {
        const catalog = group === 'crews' ? TRADES : group === 'equipment' ? EQUIPMENT : null;
        if (!catalog?.[key] || ![-1, 1].includes(delta) || s.complete) return false;
        const value = s[group][key] + delta;
        if (value < 0 || value > 3) return false;
        s[group][key] = value; if (delta > 0) s.spent += catalog[key].rate * 2;
        return true;
    }
    function inspect(s, id) {
        const t = plan(s.site).find(t => t.id === id), state = s.tasks[id];
        if (!t?.gate || state.progress < 1 || state.accepted) return false;
        state.accepted = true; state.finish = s.day; note(s, t.name + ' accepted.');
        if (id === 'handover') { s.complete = true; s.running = false; }
        return true;
    }
    function advance(s, days) {
        if (!s.running || s.complete || !Number.isFinite(days) || days <= 0) return;
        // Small deterministic slices preserve dependency and equipment ownership across speed settings.
        let left = Math.min(days, 20);
        while (left > 1e-8) {
            const dt = Math.min(.05, left), { active, passive } = allocation(s), w = weather(s);
            const workers = active.reduce((n, t) => n + TRADES[t.trade].people, 0);
            s.peakWorkers = Math.max(s.peakWorkers, workers); s.laborHours += workers * 8 * dt;
            const daily = Object.entries(s.crews).reduce((n, [k, count]) => n + count * TRADES[k].rate, 0) + Object.entries(s.equipment).reduce((n, [k, count]) => n + count * EQUIPMENT[k].rate, 0) + 12000;
            s.spent += daily * dt;
            if (!active.length) s.idleDays += dt;
            for (const t of [...active,...passive]) {
                const state = s.tasks[t.id];
                if (!state.started) { state.started = true; state.start = s.day; if (t.material) s.orders[t.material].used++; }
                const amount = Math.min(workPhase(s,t).end - state.progress, dt / t.days * (t.outdoor ? w.factor : 1));
                state.progress += amount; s.spent += amount * t.cost;
                if (state.progress >= 1 - 1e-8) {
                    state.progress = 1; state.accepted = !t.gate; state.finish = t.gate ? null : s.day + dt;
                    note(s, t.name + (t.gate ? ': ready for inspection release.' : ': complete.'));
                }
            }
            s.day += dt; left -= dt;
        }
    }
    function progress(s) {
        const tasks = plan(s.site), total = tasks.reduce((n, t) => n + t.days, 0);
        return tasks.reduce((n, t) => n + t.days * (t.gate && !done(s, t.id) ? s.tasks[t.id].progress * .9 : s.tasks[t.id].progress), 0) / total;
    }
    function report(s) {
        const duration = Math.max(1, s.day), target = site(s.site).target;
        const score = Math.max(0, Math.round(100 - Math.max(0, duration - target) * 1.2 - Math.max(0, s.spent / s.budget - 1) * 45 - s.idleDays * .3));
        return { score, days: Math.ceil(s.day), cost: s.spent, onTime: s.day <= target, onBudget: s.spent <= s.budget, laborHours: Math.round(s.laborHours), peakWorkers: s.peakWorkers, idleDays: s.idleDays };
    }
    function decode(raw) {
        try {
            const data = JSON.parse(raw);
            if (!data || ![1,2].includes(data.version) || !SITES.some(s => s.id === data.site)) return null;
            const s = create(data.site), tasks=data.version===1?legacyPlan(data.site):plan(data.site), finite = n => Number.isFinite(n) && n >= 0;
            for (const k of ['day', 'spent', 'laborHours', 'idleDays', 'peakWorkers']) { if (!finite(data[k]) || data[k] > 1e12) return null; s[k] = data[k]; }
            for (const group of ['crews', 'equipment']) for (const key of Object.keys(s[group])) { const n = data[group]?.[key]; if (!Number.isInteger(n) || n < 0 || n > 3) return null; s[group][key] = n; }
            for (const t of tasks) {
                const v = data.tasks?.[t.id];
                if (!v || !finite(v.progress) || v.progress > 1 || typeof v.accepted !== 'boolean' || typeof v.started !== 'boolean' || typeof v.enabled !== 'boolean' || ![0, 1].includes(v.priority)) return null;
                if ((v.accepted && v.progress !== 1) || (v.progress > 0 && !v.started)) return null;
                if (![v.start, v.finish].every(n => n === null || finite(n) && n <= s.day + .1)) return null;
                s.tasks[t.id] = { ...v };
            }
            if(data.version===1){
                if(tasks.some(t=>s.tasks[t.id].started&&!t.deps.every(id=>s.tasks[id].accepted)))return null;
                const legacyIds=new Set(tasks.map(t=>t.id)),modern=plan(s.site),credited=new Set();
                const credit=(id,day)=>{if(legacyIds.has(id)||credited.has(id))return;const t=modern.find(t=>t.id===id);for(const d of t.deps)credit(d,day);s.tasks[id]={progress:1,enabled:true,accepted:true,started:true,priority:0,start:day,finish:day};credited.add(id);};
                // Existing downstream work is retained. Only newly introduced prerequisites receive legacy credit.
                for(const t of modern)if(legacyIds.has(t.id)&&s.tasks[t.id].started)for(const d of t.deps)credit(d,s.tasks[t.id].start||0);
                for(const t of modern)if(!legacyIds.has(t.id)&&!credited.has(t.id))s.tasks[t.id].enabled=tasks.some(old=>s.tasks[old.id].enabled);
                s.migratedFrom=1;s.legacyCredits=[...credited];s.legacyWaivers=modern.flatMap(t=>legacyIds.has(t.id)&&s.tasks[t.id].started?t.deps.filter(d=>!s.tasks[d].accepted).map(d=>t.id+':'+d):[]);
            }else if(data.migratedFrom===1){s.migratedFrom=1;s.legacyCredits=Array.isArray(data.legacyCredits)?data.legacyCredits.filter(id=>typeof id==='string'&&s.tasks[id]?.accepted):[];const old=legacyPlan(s.site);s.legacyWaivers=Array.isArray(data.legacyWaivers)?data.legacyWaivers.filter(pair=>typeof pair==='string'&&tasks.some(t=>t.deps.some(d=>pair===t.id+':'+d)&&old.some(o=>o.id===t.id&&!o.deps.includes(pair.split(':')[1])))):[];}
            for (const t of tasks) if (s.tasks[t.id].started && !t.deps.every(id => s.tasks[id].accepted || s.legacyWaivers?.includes(t.id+':'+id))) return null;
            for (const k of Object.keys(MATERIALS)) {
                const o = data.orders?.[k], used = tasks.filter(t => t.material === k && s.tasks[t.id].started).length;
                if (!o || typeof o.ordered !== 'boolean' || typeof o.expedited !== 'boolean' || o.used !== used || used > MATERIALS[k].quantity || (o.ordered ? !finite(o.arrival) : o.arrival !== null || used > 0)) return null;
                s.orders[k] = { ...o };
            }
            s.complete = done(s, 'handover'); s.running = false; s.speed = [1, 3, 8].includes(data.speed) ? data.speed : 1;
            s.log = Array.isArray(data.log) ? data.log.filter(e => e && finite(e.day) && e.day <= s.day + .1 && typeof e.message === 'string' && e.message.length < 400).slice(0, 30).map(e => ({ day: e.day, message: e.message })) : [];
            return s;
        } catch (_) { return null; }
    }
    return { SITES, TRADES, EQUIPMENT, MATERIALS, PROCESS_SOURCES, workPhase, site, plan, create, done, weather, readiness, allocation, dispatch, order, expedite, capacity, inspect, advance, progress, report, decode };
});
