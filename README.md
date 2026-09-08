# Jobsite

A browser construction game from [openmud](https://openmud.ai). Choose a region, operate an excavator, cut a persistent trench, load trucks, and bring in a pipe crew.

**[Play Jobsite](https://openmud.ai/jobsite)** · **[How to play](https://openmud.ai/jobsite#how-to-play)** · **[Report an issue](https://github.com/masonearl/jobsite/issues)**

![Jobsite gameplay](web/assets/meta/jobsite-gameplay.png)

This is an early, playable prototype. The source is MIT licensed. Contributions from operators, construction professionals, artists, and developers are welcome.

## Play locally

Clone the project and serve the `web` folder with Python 3:

```sh
git clone https://github.com/masonearl/jobsite.git
cd jobsite
python3 -m http.server 8000 --directory web
```

Open **http://localhost:8000**. Use an HTTP server rather than opening the HTML file directly: the game loads JavaScript modules and map data. A browser with WebGL is required.

There is no build step, account, API key, backend service, or package install needed to play. Three.js is included locally. This standalone edition does not include the parent site's analytics or navigation scripts.

## Controls

- **Up:** drive forward toward the bucket. **Down:** reverse. Release to stop.
- **Left / Right:** turn the machine. Trench assist makes a quarter turn per press and stops cuts at the 0.90 m pipe bed; turn it off for free steering and deeper cuts.
- **Space:** start or resume, dig, load, and advance to the next cut. Hold Space or the gold button to keep working at 80% bucket capacity. Release in the marked zone for a full single bite and cash bonus. Tap during a cycle to queue one next action. Space clears crew stops and recovers blocked or parked trucks. Release stops repeating; the current action finishes. Space works across game toolbar controls; Enter activates the focused control. Text fields and the guide keep normal keyboard behavior.
- **Recovery:** blocked trucks move to a clear loading lane; a finished or obstructed cut advances to fresh ground. At the boundary, the spread relocates to a usable pad. Recovery preserves excavated terrain, installed pipe, payload and earnings. Repeated crew/truck overlaps trigger recovery after a bounded wait. Pausing, leaving the game or reloading clears queued input.
- **Back up 2 m:** move one pipe length in reverse while keeping the trench aligned.
- **Install 2 m pipe:** available after the bed is within the target depth tolerance and the bucket is empty. Install an adjoining section, then **Connect joint**.
- **Site plan:** show a saved pipe-corridor layout over the actual terrain. Planned, on-grade and installed sections have different colors. **Plan from bucket** aligns a new plan with the current machine heading.
- **Drag / scroll / pinch:** orbit and zoom the camera. Camera orientation does not change forward or reverse.
- **Expand game:** fill the browser viewport. **Fullscreen:** use native fullscreen where supported. **Esc:** exit the expanded view.
- **Clear crew:** park workers outside the equipment zone after pipe work. Workers stop nearby equipment; open cuts, exposed pipe and stored bundles stop a blocked truck. **Switch truck side** routes it beyond the existing trench to the other loading pad. **Cancel truck move** parks it if the route is blocked; reposition the spread, then call it again.
- **Crew & upgrades:** train spotting or machine operation, take lunch, and review saved crew levels.
- **Throttle:** three distinct 2 m sections on grade unlock Eco, Work and Boost RPM presets with different speeds and fuel use.
- **P:** pause when the game has keyboard focus. Opening the guide or map also pauses the shift.

Touch controls are available in the scene. In expanded view, open **Upgrades** for equipment purchases.

## What is implemented

- Six regional scenarios with different landscapes, materials, hauling times, and equipment presets.
- Three equipment spreads, three contracts per region, and free digging without a clock.
- Articulated equipment, a digging/loading cycle, trucks, and a visible pipe crew.
- Terrain deformation at each bucket location. Cuts and installed pipe remain as you move and carry into the next contract on that site.
- Trench alignment assistance, two-meter reversing, pipe joint connection and a saved site-plan overlay.
- Equipment upgrades, foreman/operator/laborer/joiner levels 1–10, training and lunch breaks.
- Geometry-based excavation volume, density-based mass accounting and truck capacity limits.
- Equipment/worker interlocks, persistent trench and pipe obstacles, and device saves.
- A construction learning guide and fullscreen controls.

The regions are illustrative presets with generated environments. Terrain, capacities, time, and prices are simplified game values, not surveyed conditions, estimating data, or equipment training. Each region and fleet keeps its own local device save, including active excavation, pipes, vehicles, cash, upgrades, crew skills, fuel and shift history. Reloaded shifts resume paused. Changing shifts preserves the work. Saves include a previous-good backup; unsupported saves are retained, and stale tabs cannot overwrite a newer saved job. Saves stay in this browser profile and do not sync between devices.

## Development

Run the simulation checks with Node.js 22 or later:

```sh
npm test
```

To check the browser input path, run `python3 scripts/serve-jobsite-input-check.py` and open `http://127.0.0.1:4181/__input-check`. Select **Run input checks**. These eleven real-page checks cover saved-site Resume, sustained Space past pipe grade, repeat and release, toolbar focus, guide/world return, typing, crew drills, queued taps, blocked trucks, crew stops and ended shifts. Timed holds use synthetic keyboard events. The fixture uses in-memory saves and does not modify your browser's saved jobs. Also check physical Space keypresses after Resume and fullscreen in your target browser.

- `web/index.html`: game and learning guide.
- `web/assets/js/jobsite-sim.js`: deterministic production, movement, terrain, and pipe-work state.
- `web/assets/js/jobsite-scene.js`: Three.js equipment, terrain, crew, lighting, and camera.
- `web/assets/js/jobsite-save.js`: versioned sparse terrain saves, validation, backups and cross-tab protection.
- `web/assets/js/jobsite.js`: browser controls, screens, audio, and persistence.
- `web/assets/css/jobsite.css`: responsive UI.
- `tests/jobsite-sim.test.js`: simulation and construction-flow checks.

The live demo is hosted within openmud.ai; this repository is the standalone game. Static hosts can serve `web` as the site root. A Vercel configuration is included.

## Lightweight rendering and simulation

The renderer is Three.js r170, capped at 30 frames per second and one device pixel per CSS pixel, with a 1024-pixel shadow map. The 56 m terrain grid has 0.25 m spacing (50,625 vertices). Excavation updates only the affected vertices and nearby normals. Rendering stops when the page is hidden or the map/guide is open, and settled paused scenes draw only when needed. There is no physics engine or server simulation.

Worker zones and vehicle obstacles use simple geometric checks. Blocked trucks stop until the primary action requests recovery. Recovery is a short equipment reset, not a rigid-body rollover or tow simulation. Switching loading sides uses a route around the far end of existing excavation; it does not perform a full road-network route search. The game currently models open cuts and exposed pipes; backfilling is not implemented. Machine capacity, density, fuel and time are explicit game presets. Bank volume is integrated from the height field; mass equals removed volume times the current bite density. Loose-volume swell is not modeled.

Performance depends on the GPU, browser and number of placed pipes. Operator notes show CPU render-submission time and draw calls; this does not measure GPU time or total browser memory. Device saves are subject to browser storage availability and limits.

## Help build it

Useful contributions include clearer equipment geometry and animations, better trench and material behavior, operator feedback on controls, accessibility, and performance on lower-powered devices. Please open an issue with a concrete example or a focused pull request. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License and assets

Crew overhead tags are `F1` (foreman), `Operator 1`, `L1` (laborer), and `PJ1` (pipe joiner); the number tracks each role's trained level.

Code is [MIT licensed](LICENSE). Three.js and OrbitControls retain their [MIT license](web/assets/vendor/three/LICENSE). Natural Earth map data is public domain. Generated landscape and ground textures are included; their source notes and prompts are in [ASSETS.md](web/assets/jobsite/ASSETS.md).
