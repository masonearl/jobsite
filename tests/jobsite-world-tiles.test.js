const test = require('node:test'), assert = require('node:assert/strict');
const tiles = import('../web/assets/js/jobsite-world-tiles.mjs');

test('NASA geographic matrix bounds match published non-Mercator tile coordinates', async () => {
    const { tileAt, tileBounds, tileURL } = await tiles, tile = tileAt(41.8, -112.8, 5);
    assert.deepEqual(tile, { level:5, row:5, col:7 });
    assert.deepEqual(tileBounds(tile), { west:-117, east:-108, north:45, south:36, span:9 });
    assert.ok(tileURL(tile).endsWith('/500m/5/5/7.jpeg'));
});
test('dateline wrapping and the cropped southern edge stay inside NASA tile bounds', async () => {
    const { tileAt, tileBounds } = await tiles;
    assert.deepEqual(tileAt(0,180,4),tileAt(0,-180,4));
    assert.equal(tileBounds(tileAt(-90,0,2)).south,-90);
    for(const level of [2,3,7])for(const lat of [-90,-80,0,80,90])for(const lon of [-540,-180,-179,0,179,180,540]){
        const b=tileBounds(tileAt(lat,lon,level));assert.ok(b.south<=lat&&b.north>=lat);assert.ok(b.west>=-180&&b.east<=180);
    }
});
test('detail increases with zoom and physical screen density', async () => {
    const { detailLevel } = await tiles;
    assert.ok(detailLevel(1.16,1300,900,2)>detailLevel(1.94,1300,900,2));
    assert.ok(detailLevel(1.6,1300,900,2)>=detailLevel(1.6,1300,900,1));
});
test('adaptive patches cover the focus point within a bounded cache budget', async () => {
    const { visibleTiles,tileBounds,tileKey,TILE_LIMIT,CACHE_LIMIT } = await tiles;
    for(const lat of [-80,-35,0,41.8,80])for(const lon of [-179,-112.8,151,179])for(const distance of [1.16,1.6,1.94,2.74])for(const [w,h] of [[1292,886],[390,844]]){
        const result=visibleTiles({lat,lon,distance},w,h,2);assert.ok(result.length>0&&result.length<=TILE_LIMIT&&TILE_LIMIT<CACHE_LIMIT);
        assert.equal(new Set(result.map(tileKey)).size,result.length);
        assert.ok(result.some(t=>{const b=tileBounds(t);return b.west<=lon&&b.east>=lon&&b.south<=lat&&b.north>=lat;}),'focus coverage '+[lat,lon,distance,w]);
        for(const t of result){const b=tileBounds(t);assert.ok(b.north>b.south&&b.east>b.west);assert.ok(t.level>=2&&t.level<=7);}
    }
});
test('closest Utah view uses at least 40K-equivalent imagery rather than the 2K overview', async () => {
    const { visibleTiles,tileBounds } = await tiles;
    const result=visibleTiles({lat:41.8,lon:-112.8,distance:1.16},1292,886,2);
    const center=result.find(t=>{const b=tileBounds(t);return b.west<=-112.8&&b.east>=-112.8&&b.south<=41.8&&b.north>=41.8;});
    assert.ok(center.level>=6);
});
test('overview and collapsed canvases make no regional requests', async () => {
    const { visibleTiles } = await tiles;
    assert.deepEqual(visibleTiles({lat:24,lon:-100,distance:3.7},1300,900,2),[]);
    assert.deepEqual(visibleTiles({lat:24,lon:-100,distance:1.6},0,0,2),[]);
});
