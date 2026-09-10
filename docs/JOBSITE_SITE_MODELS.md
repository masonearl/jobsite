# Destination models and public evidence

Checked September 9, 2026. The executable provenance catalog is `web/assets/js/jobsite-campus-models.js`; the same records appear in each destination brief, Project record and downloaded JSON. No private project files were used.

These are compressed construction scenarios, not engineered digital twins. Coordinates, footprints, equipment counts, clearances and temporary construction logistics are game geometry. Two work fronts use the existing 44-package production graph. Campus context is present from the start; dashed, flat plots show the larger program without claiming that those buildings have been erected. Context does not earn progress or incur fictitious construction quantities.

## Starbase

Basis: [FAA April 2025 final tiered assessment](https://www.faa.gov/media/94346), Figure 1, printed page 9 (PDF page 17), visually inspected. The drawing distinguishes existing and future features as of that assessment. It shows two orbital launch mounts and integration towers south of State Highway 4, a shared tank farm, water farms, blast protection and coastal wetland boundaries. [FAA operations background](https://www.faa.gov/space/stakeholder_engagement/spacex_starship/operations) separates the launch area from manufacturing and launch control to the west.

Model: two eight-module towers and launch mounts; no data halls or integration warehouse in the launch compound. Northern highway and shared tank context, water equipment, blast wall, eastern coastal dunes/water and western off-site manufacturing label establish the setting. Scaled positions, temporary parking, internal roads, foundations, access platforms and ground-support equipment are reconstructed. Both launch fronts are replayed from bare ground, irrespective of their real status. Fueling, launch operations and rocket assembly are outside this game.

## Abilene

[Crusoe’s March 18, 2025 expansion announcement](https://www.crusoe.ai/resources/newsroom/crusoe-expands-ai-data-center-campus-in-abilene-to-1-2-gigawatts) identifies eight buildings: the original two plus six additional buildings. [Crusoe’s September 30, 2025 update](https://www.crusoe.ai/resources/newsroom/crusoe-announces-flagship-abilene-data-center-is-live) reports the first two energized. The scenario shows two active elongated halls and six outlined footprints with a service spine. Their paired-row arrangement, dimensions, electrical precinct and basin are inferred, not surveyed. This is not Crusoe’s separately announced Microsoft campus.

## Saline / The Barn

[August 5, 2025 township planning minutes](https://salinetownship.org/uploads/minutes/1761140618_August%205.pdf) describe three large buildings and screening. The [township document register](https://www.salinetownship.org/data-center-update) links the Atwell submissions. [OpenAI announced groundbreaking June 1, 2026](https://openai.com/index/stargate-michigan-data-center/). The model uses two active long halls, a third outlined footprint, screened edges, substation and temporary batch-plant context. Parallel placement, roads, setbacks and dimensions are inferred; the model does not claim to trace the approved engineering plan.

## Doña Ana / Project Jupiter

The [developer’s current overview](https://projectjupitertogether.com/) identifies four buildings and an updated fuel-cell microgrid in place of earlier turbine/diesel proposals. Its [media register](https://projectjupitertogether.com/media-gallery/) includes a July 17, 2026 construction update. The model shows two active buildings, two outlined footprints and a distinct fuel-cell precinct. Positions, dimensions and module counts are inferred. Fuel cells are campus context; the active power package still installs switchgear. Cooling uses a schematic closed-loop plant; energy operation is not simulated.

## New Carlisle

[AWS’s April 25, 2024 announcement](https://www.aboutamazon.com/news/aws/aws-indiana-investment-11-billion) verifies the Indiana Enterprise Center campus. The model is explicitly a conceptual six-block sector with two active low modular halls, an electrical service spine and expansion plots. Six is not asserted to be the real campus building count. Roads, basins, dimensions and the remaining block arrangement are inferred.

## Stratos

The [county fact sheet](https://www.boxeldercountyut.gov/647/Stratos-Project-Fact-Sheet) describes phased data, energy, water and road infrastructure. The [developer overview](https://www.boxelderstratos.com/) describes a first phase within a larger holding. Building-level geometry was not verified. The two active halls, outlined expansion, separate energy/water precincts and open land are conceptual. Capacity and proposed land use are not treated as an approved final design or current construction status.

## Terafab

[SpaceX’s August 6, 2026 announcement](https://new.spacex.com/updates) identifies Grimes County and an integrated logic, memory and advanced-packaging program. The [Terafab program page](https://terafab.ai/) is also linked for users. No detailed verified Grimes County footprint was located. The model uses two tall process/packaging wings, a utility connection that appears after both service packages, process-tool interiors, roof utility equipment and a larger outlined factory expansion. All massing, dimensions and roads are conceptual; this is a small teaching phase rather than the announced whole factory.

## Geometry, logistics and saves

Each active footprint drives the building scale, foundation excavation, crew workstations, pump locations, crane targets and collision geometry. Material payloads clone the actual structural piece with its world scale. Traffic predictions and visible vehicles use the same routes. Pedestrian navigation rebuilds around installed columns, walls and fit-out; the goods doors stay open. Context is outside the active compound and is not used as an unguarded worker shortcut.

New attempts carry `modelRevision: 2`. Saves without that field decode as revision 1 and keep their original layout. Applying the researched layout in Project record pauses the project and makes a byte-for-byte `:before-site-model` backup before changing the revision. Tasks, acceptance, spending, deliveries and incidents stay intact. A failed backup or concurrent save change prevents the upgrade. The save format remains version 2 and retains the previous version-1 process migration.
