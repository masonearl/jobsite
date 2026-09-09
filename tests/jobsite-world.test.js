const test = require('node:test');
const assert = require('node:assert/strict');
const math = import('../web/assets/js/jobsite-world-math.mjs');

test('globe coordinates match the equirectangular map and preserve radius', async () => {
    const { surfacePoint } = await math;
    assert.deepEqual(surfacePoint(0, 0), [1, 0, -0]);
    for (const [lat, lon] of [[41.8, -112.8], [25.99, -97.15], [-36, 151], [90, 0]]) {
        const p = surfacePoint(lat, lon, 3);
        assert.ok(Math.abs(Math.hypot(...p) - 3) < 1e-10);
        assert.ok(Math.abs(Math.asin(p[1] / 3) * 180 / Math.PI - lat) < 1e-8);
        if (lat !== 90) assert.ok(Math.abs(Math.atan2(-p[2], p[0]) * 180 / Math.PI - lon) < 1e-8);
    }
});
test('continuous zoom stays outside terrain and clamps extreme wheel or pinch input', async () => {
    const { zoomDistance, MIN_DISTANCE, MAX_DISTANCE } = await math;
    let d = 3.7;
    for (let i = 0; i < 100; i++) d = zoomDistance(d, -1000);
    assert.equal(d, MIN_DISTANCE); assert.ok(d > 1);
    for (let i = 0; i < 100; i++) d = zoomDistance(d, 1000);
    assert.equal(d, MAX_DISTANCE);
    assert.ok(zoomDistance(3.7, -.01) < 3.7 && zoomDistance(3.7, -.01) > 3.6);
});
test('rotation crosses the date line and cannot flip over a pole', async () => {
    const { rotateView } = await math;
    const v = rotateView({lat:79,lon:179,distance:3.7},-500,500,720);
    assert.equal(v.lat,80); assert.ok(v.lon >= -180 && v.lon < 180);
    assert.equal(rotateView(v,0,-100000,720).lat,-80);
});
test('camera transitions take the short route across the date line', async () => {
    const { approachView } = await math;
    const halfway = approachView({lat:0,lon:179,distance:4},{lat:40,lon:-179,distance:2},.5);
    assert.equal(halfway.lon,-180); assert.equal(halfway.lat,20); assert.equal(halfway.distance,3);
});
test('far-side and below-horizon markers cannot be clicked through the globe', async () => {
    const { surfacePoint, facesCamera } = await math;
    const camera = surfacePoint(0,0,2);
    assert.equal(facesCamera(surfacePoint(0,0),camera),true);
    assert.equal(facesCamera(surfacePoint(0,180),camera),false);
    assert.equal(facesCamera(surfacePoint(0,65),camera),false);
});
test('nearby Michigan and Indiana markers remain separate without mutating anchors', async () => {
    const { spreadMarkers } = await math;
    const points = [{id:'saline',x:300,y:100},{id:'indiana',x:305,y:104},{id:'third',x:302,y:101}];
    const placed = spreadMarkers(points);
    for (let i=0;i<placed.length;i++) for(let j=i+1;j<placed.length;j++) assert.ok(Math.hypot(placed[i].x-placed[j].x,placed[i].y-placed[j].y)>=38);
    assert.deepEqual(points[1],{id:'indiana',x:305,y:104});
});
