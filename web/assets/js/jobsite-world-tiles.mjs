import { surfacePoint, wrapLongitude } from './jobsite-world-math.mjs';

const RAD = Math.PI / 180;
export const TILE_LIMIT = 40;
export const CACHE_LIMIT = 48;
export const tileSpan = level => 288 / 2 ** level;
export const tileKey = tile => [tile.level, tile.row, tile.col].join('/');
export const tileURL = tile => 'https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/BlueMarble_ShadedRelief_Bathymetry/default/500m/' + tileKey(tile) + '.jpeg';
export function tileBounds({ level, row, col }) {
    const span = tileSpan(level), west = -180 + col * span, north = 90 - row * span;
    return { west, east: Math.min(180, west + span), north, south: Math.max(-90, north - span), span };
}
export function tileAt(lat, lon, level) {
    const span = tileSpan(level);
    return { level, row: Math.min(Math.ceil(180 / span) - 1, Math.floor((90 - Math.max(-90, Math.min(90, lat))) / span)), col: Math.floor((wrapLongitude(lon) + 180) / span) };
}
export function detailLevel(distance, width, height, pixelRatio = 1) {
    // Match texture texels to physical pixels at the nearest surface, rather than stretching one global image.
    const focalLength = Math.min(width, height) * pixelRatio / (2 * Math.tan(21 * RAD));
    return Math.max(2, Math.min(7, Math.ceil(Math.log2(2 * Math.PI * focalLength / Math.max(.16, distance - 1) / 640))));
}
export function visibleTiles(view, width, height, pixelRatio = 1) {
    if (view.distance >= 2.75 || width <= 0 || height <= 0) return [];
    const n = surfacePoint(view.lat, view.lon), c = n.map(v => v * view.distance), horizontal = Math.hypot(n[0], n[2]);
    const right = [n[2] / horizontal, 0, -n[0] / horizontal], up = [-n[1] * n[0] / horizontal, horizontal, -n[1] * n[2] / horizontal];
    const tanY = Math.tan(21 * RAD) * Math.max(1, height / width), tanX = tanY * width / height;
    const focal = height * pixelRatio / (2 * tanY), maxLevel = detailLevel(view.distance,width,height,pixelRatio), dot = (a,b) => a.reduce((sum,v,i) => sum + v*b[i],0);
    const assess = tile => {
        const b = tileBounds(tile); if (b.south >= b.north || b.east <= b.west) return null;
        const p = surfacePoint((b.north+b.south)/2,(b.west+b.east)/2), corners = [surfacePoint(b.north,b.west),surfacePoint(b.north,b.east),surfacePoint(b.south,b.west),surfacePoint(b.south,b.east)];
        const angle = Math.max(...corners.map(v=>Math.acos(Math.max(-1,Math.min(1,dot(p,v)))))), radius = 2*Math.sin(angle/2);
        if (Math.acos(Math.max(-1,Math.min(1,dot(p,n)))) > Math.acos(1/view.distance)+angle) return null;
        const q = p.map((v,i)=>v-c[i]), depth = -dot(q,n);
        if (depth+radius<=0 || Math.abs(dot(q,right))>depth*tanX+radius*Math.hypot(1,tanX) || Math.abs(dot(q,up))>depth*tanY+radius*Math.hypot(1,tanY)) return null;
        const nearestDepth = Math.max(view.distance-1, depth);
        return {...tile, error:focal*b.span*RAD/nearestDepth/512, score:dot(p,n)};
    };
    // Refine the largest projected patches first. The limb remains coarse while the area under the camera gets detail.
    let tiles=[];
    for(let row=0;row<3;row++)for(let col=0;col<5;col++){const tile=assess({level:2,row,col});if(tile)tiles.push(tile);}
    for(let attempt=0;attempt<200;attempt++){
        const candidates=tiles.filter(t=>t.level<maxLevel&&t.error>1).sort((a,b)=>b.error-a.error);if(!candidates.length)break;
        let split=false;
        for(const parent of candidates){
            const children=[];for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++){const tile=assess({level:parent.level+1,row:parent.row*2+dy,col:parent.col*2+dx});if(tile)children.push(tile);}
            if(tiles.length-1+children.length>TILE_LIMIT)continue;
            tiles=tiles.filter(t=>t!==parent).concat(children);split=true;break;
        }
        if(!split)break;
    }
    return tiles.sort((a,b)=>b.score-a.score).map(({level,row,col})=>({level,row,col}));
}
