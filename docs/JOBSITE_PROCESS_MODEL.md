# Jobsite construction process model

Process model 2, researched September 9, 2026. Applies to the 44-package campus campaigns in `jobsite-campus.js`; the separate utility sandbox retains its own production model.

The campaign now separates preparation, installation and acceptance. Crews still work autonomously, but available equipment alone cannot release downstream work. These are representative construction sequences inspired by published practice, not the actual construction plans for the named developments.

## What changes during play

- **Prepare the site:** released scenario design, setout and utility locates precede construction access and erosion controls, then clearing and bulk grading. Utility corridors and building pads are separate work areas, so they can progress concurrently when resources are available.
- **Build utilities in short reaches:** excavation, bedding and installation advance through six reaches per corridor. Each reach requires an installation check before backfill, then compaction and density records before the next reach. Field checks share the survey/inspection resource; removing that capacity visibly holds the work. System testing, flushing and records are a separate acceptance package.
- **Build and release foundations:** excavation and base preparation precede forms, reinforcing and embeds, a pre-pour check, concrete placement, elapsed curing/test time and strength/anchor release. Only then can the steel crew erect the structure. Power and cooling equipment also require completed and released foundations.
- **Commission before turnover:** installation and pre-energization acceptance lead to vendor startup, functional performance tests, integrated systems tests and owner handover. Permanent surfacing follows utility acceptance and major structure/plant lifts.

The scene reflects these stages: footing cuts, formwork and rebar precede concrete; curing markers remain until foundation release; trench cover follows its field check; plant equipment is lifted as grouped units onto prepared pads. Test equipment appears during commissioning. Existing equipment, worker, parking and delivery animations remain tied to assigned work and saved progress.

## Published sources and their use

These links also appear in the field guide and in each work package's **Sequence + scope** details. The rules below are interpretations for the game, not a replacement for the applicable contract documents.

- [EPA: construction sequencing](https://www.epa.gov/system/files/documents/2021-11/bmp-construction-sequencing.pdf) coordinates land disturbance with erosion/sediment controls and stabilization. The game therefore installs access and controls before clearing, and permits work in separate areas.
- [OSHA 1926.651: excavation](https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926.651) addresses locating underground installations, excavation conditions and inspections. The game starts with utility verification and represents a protected, limited work reach. It does not calculate excavation protection or model competent-person qualifications.
- [Salt Lake City: utility inspection practices](https://www.slcdocs.com/utilities/PDF%20Files/Std_practices_090105.pdf) describes local inspection and survey documentation for underground work. This is a local example supporting inspection before concealment, not a universal utility acceptance specification.
- [Salt Lake City: Sewer System Management Program](https://slcdocs.com/utilities/PDF%20Files/SSMP%20Program.pdf), Standard Practices 103–104, describes trench compaction in lifts and documented density testing. The game abstracts these into backfill/compaction and a reach-record check; it does not adopt that document's numeric lift thickness or test frequency as a national rule.
- [UFGS 33 11 00: Water Utility Distribution Piping](https://www.wbdg.org/FFC/DOD/UFGS/UFGS%2033%2011%2000.pdf) contains system- and material-specific field testing requirements. The game's final utility release groups testing and records. Actual pressure-test timing relative to restraint, backfill and flushing depends on the specified system; the pre-cover reach check is not presented as the final pressure test.
- [OSHA 1926.703: cast-in-place concrete](https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926.703) addresses formwork, reinforcing and sufficient strength for construction loading/form removal. The game distinguishes preparing a pour, placing concrete and releasing it for subsequent work.
- [OSHA 1926.752: steel erection](https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926.752) requires appropriate concrete strength evidence and the controlling contractor's written notification, along with suitable access and staging conditions. The game's strength/anchor release is a separate hold after curing; completing a timer is not evidence of actual concrete strength.
- [Vertiv: commissioning and engineering services](https://www.vertiv.com/en-us/services-catalog/services/project-services/engineering/) describes installation checks, startup, functional tests, integrated testing and turnover documentation/training. The game now separates these commissioning stages. It does not operate live electrical systems or model actual failure testing.
- [Microsoft: Boyd Farms construction update](https://local.microsoft.com/blog/boyd-farms-datacenter-construction-update/) describes foundations, underground work, electrical installation and slabs occurring across an active campus. It supports overlapping work areas instead of forcing the entire site through one phase at a time; the game does not reproduce that project's detailed schedule.

## Deliberate simplifications

Durations, quantities, crew counts, costs, weather and test outcomes remain game presets. Three scenario days for curing is an elapsed scheduling constraint, **not a concrete strength prediction**. Curing consumes no assigned crew, pump or productive labor hours and extra crews cannot speed it up. It continues while work packages are held but the project clock is running; **Pause** stops the entire simulation. Hired resources still accrue payroll/rental charges until demobilized.

Survey crews represent shared survey/inspection availability. Real surveyors, inspectors, testing laboratories, competent persons and engineers have different responsibilities and qualifications. Inspection tasks succeed after their simulated work; explicit player releases represent acceptance at the major holds. Rejected tests, retests, lab turnaround uncertainty and rework are not yet modeled.

The campus utility cycle is a short-reach batch model. Visual excavation leads pipe and backfill, but independent production rates, bucket-level mass balances and detailed trench support belong to future campus work. The utility sandbox has its own more detailed excavation/material-flow model. Similarly, foundation geometry is schematic, plant pads group several operations, and the two building work fronts group activities that a real schedule would divide further. No project drawings or proprietary schedules were used.

Permitting, design coordination, submittals, factory acceptance tests, utility-provider energization scheduling and commissioning design review begin before the game's construction phase or remain outside this version. Purchase packages retain the existing delivery presets. The new site model improves construction dependencies; it does not claim to represent the full development process.

## Existing saves

Campus saves now contain `version: 2` while retaining the existing `openmud-jobsite-campus-v1:<site>` storage key. Version 1 saves are first checked against their original 24-package graph. Their quantities, spending, orders, timestamps and accepted work are retained. Newly separated prerequisites needed by already-started work receive explicit `legacyCredits`, visible in the project record.

Some old work could legally start under the original game before a newly required existing package finished. The migration records those already-started dependency edges as `legacyWaivers` for save validation. Remaining work still waits for the updated dependencies. The migration does not erase completed construction or charge historical costs for credited steps. A completed version 1 scenario remains completed.

Before replacing an original version 1 device save, the UI stores its exact serialized contents under `<key>:before-process-update`. If that backup cannot be saved, the original is not overwritten and the UI reports storage failure. Unsupported or malformed saves and conflicting writes from another tab continue to be preserved. Utility sandbox saves are unaffected.

## Verification

- Node tests cover resource-blocked reach inspections, bounded open trench geometry, curing without assigned resources, strength holds, plant foundations, commissioning order and migration from five authentic prior-engine save fixtures.
- The full browser campaign reaches all 44 accepted work packages. The rendered-scene check includes foundation preparation and plant pads as well as terrain, equipment, labor, arrival, pause and reconstruction checks.
- `/__campus-migration-check` on the local QA server exercises exact backup, restored progress, reload and storage failure through the actual application UI using memory storage. It never modifies a player's device saves.


## Physical delivery, access and contact model

Structural members and power/cooling skids now use a shared component cycle: collect, transport, rig, hoist, connect, release and return empty. A carrier and crane carry a clone of the actual component; the installed count changes only at placement. Saved package progress reconstructs the same component and pose. Component count is schematic and is not the published quantity for a named project. Envelope, MEP and fit-out remain quantity-driven installation groups; they do not yet have individual delivery vehicles.

Walls have actual eight-metre goods openings. Workers route on a one-metre navigation grid around installed wall panels, columns, racks, plant equipment, trailers and the perimeter fence. Diagonal movement cannot cut a corner; unavailable paths stop instead of falling back to a straight line through geometry. New geometry invalidates routes. If a newly placed piece occupies a former workstation, that person is reassigned to the nearest clear service face. Cutaway changes visibility, not collision geometry.

The scene checks the swept path of haul trucks, excavators, earthmoving fronts and material carriers before advancing their package. Guarded traffic is the default: affected production yields while workers clear the route, then resumes without another dispatch. Workers detour around vehicle envelopes. Hired resource costs continue during traffic holds. Standalone headless schedule calculations do not invent pedestrian positions; those temporary holds are supplied by the scene and excluded from saved state.

With traffic separation disabled in Operations, equipment/worker contact stops the entire project, preserves installed work, adds a **$25,000 game allowance and ten-point score penalty**, and requires a half-day stand-down review followed by explicit release. Contact is nongraphic. Review restores guarded traffic and regroups personnel. Counts, review state and the latest incident survive save/reload; old saves default to guarded traffic. These numeric penalties, envelopes and compressed recovery stages are gameplay choices, not real costs, safe distances or incident-response procedures. There is no injury/medical model or rigid-body simulation. Parked equipment, decorative plant and overhead loads do not yet have a full physical collision solver.

Sources checked September 9, 2026: [OSHA backing safety solutions](https://www.osha.gov/preventing-backovers/solutions) describes coordinating worker and equipment paths through internal traffic-control plans; [OSHA 1926.1425](https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926.1425) addresses reducing exposure to hoisted loads and limiting personnel near them. The simplified game does not certify compliance or replace site-specific plans, competent supervision, rigging or training.

Local verification: `node --test tests/jobsite-*.test.js`; run `python3 scripts/serve-jobsite-input-check.py --port 4181` and open `/__interaction-check` for actual geometry, delivery, contact/recovery and complete guarded-build checks. Existing `/__activity-check`, `/__campus-check` and `/__campus-migration-check` cover scene, controls and older saves.
