# Jobsite world assets

## Landscape environments

`mountain.jpg`, `forest.jpg`, `desert.jpg`, and `volcanic.jpg` are original generated 2:1 equirectangular landscape assets created with the built-in image generation tool for this game. They are illustrative environments, not photographs of specific real project sites. JPEG conversion uses quality 84; original PNGs were preserved outside the repository.

Shared final prompt:

> Use case: photorealistic-natural. Asset: equirectangular environment texture for an interactive 3D construction game. Generate one seamless 360-degree by 180-degree panoramic photograph, 2:1 width:height landscape, 2048x1024 if possible. Scene: [scene below]. Camera at 2.5 meters high in the center of a broad empty level site clearing. Horizon precisely at vertical center, landscape details concentrated near horizon; upper half is uninterrupted realistic sky; lower half earth with perspective towards nadir. PBR environment reference, real camera tonal response, extremely detailed geology and landscape, natural colors. No vehicles, equipment, people, signs, text, buildings or watermarks. It is a background sphere for movable 3D equipment, so leave a wide clear dirt work area in all directions.

Scenes:

- Mountain: Utah Wasatch foothills, wide quarry worksite on dry gravel earth, distant rugged limestone mountain range under clear pale blue afternoon sky, golden directional sun, no snow on foreground.
- Forest: Pacific Northwest Canada, logging road earthworks clearing surrounded by tall dense Douglas fir forest, damp brown gravel and clay foreground, cloud-covered misty mountains, soft overcast late-morning light, subtle wet surfaces.
- Desert: Arabian desert outside Dubai, dune-edge construction clearing on pale sandy gravel, softly rolling golden sand dunes far away, hazy brilliant pale-blue hot sky, warm afternoon directional sunlight.
- Volcanic: Iceland volcanic roadworks clearing, black basalt gravel foreground, distant dramatic dark volcanic hills with green moss and thin snow patches, cool overcast sky, crisp atmospheric cinematic daylight.

## Map

`world-land.geojson` is the Natural Earth 1:110m land outline, public domain.

- Source: https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_land.geojson
- Terms: https://www.naturalearthdata.com/about/terms-of-use/

## Renderer

Three.js and OrbitControls 0.170.0 are vendored under `../vendor/three/`. Their MIT license is included there. These files are loaded locally; rendering does not depend on a CDN, maps API, geolocation service, or API key. The dependency is necessary for perspective geometry, physical lighting, environment reflections, and orbital camera controls, with no build step or framework change.

Source: https://github.com/mrdoob/three.js/tree/r170

## Ground material

`ground.jpg` is an original generated seamless ground albedo texture, created with the built-in image generation tool and converted to JPEG quality 87.

Final prompt:

> Use case: photorealistic-natural. Asset: seamless PBR ground albedo tile for a realistic 3D earthmoving game. Create a perfectly top-down orthographic photograph of one square meter of compacted construction soil: fine granular sandy earth mixed with small irregular gravel pebbles, subtle disturbed dusty tracks and varied mineral grain. Neutral desaturated brown-gray color, flat diffuse lighting, no directional shadows, no macro objects or plants, no text, no perspective. 1024x1024 square, tileable continuously on all four edges, sharp detailed texture with organic variation at multiple scales. This is a material texture, not a landscape.

## Earth surface

`earth-blue-marble.jpg` is the unmodified 2048 × 1024 Blue Marble land, ocean and ice mosaic from NASA Goddard Space Flight Center. It is a historical composite, not live imagery or surveyed site photography.

- Image: https://eoimages.gsfc.nasa.gov/images/imagerecords/57000/57730/land_ocean_ice_2048.jpg
- Background and credits: https://science.nasa.gov/resource/blue-marble/
- NASA media usage: https://www.nasa.gov/nasa-brand-center/images-and-media/
- Credit: NASA Goddard Space Flight Center. Image by Reto Stöckli (land surface, shallow water, clouds).

NASA imagery is generally not subject to US copyright; this image remains NASA material, outside the code's MIT license. No NASA endorsement is implied. It is served locally, with Natural Earth land outlines as a fallback.
