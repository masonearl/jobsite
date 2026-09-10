// Shared geometry rules for routing and contact checks; distances are game metres.
export function segmentHitsBox(a, b, box, padding = 0) {
    let lo = 0, hi = 1;
    for (const [axis, min, max] of [[0, box.x0 - padding, box.x1 + padding], [2, box.z0 - padding, box.z1 + padding]]) {
        const d = b[axis] - a[axis];
        if (Math.abs(d) < 1e-9) { if (a[axis] < min || a[axis] > max) return false; }
        else { const p = (min - a[axis]) / d, q = (max - a[axis]) / d; lo = Math.max(lo, Math.min(p, q)); hi = Math.min(hi, Math.max(p, q)); if (lo > hi) return false; }
    }
    return true;
}
export function closestPoint(a,b,p) {
    const dx=b[0]-a[0],dz=b[2]-a[2],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[2]-a[2])*dz)/(dx*dx+dz*dz||1)));
    return [a[0]+dx*t,p[1],a[2]+dz*t];
}
export function sweptDistance(a, b, p, q = p) {
    const x = a[0] - p[0], z = a[2] - p[2], dx = b[0] - q[0] - x, dz = b[2] - q[2] - z;
    const t = Math.max(0, Math.min(1, -(x * dx + z * dz) / (dx * dx + dz * dz || 1)));
    return Math.hypot(x + t * dx, z + t * dz);
}
export function wallPanels(height) {
    const parts = [];
    for (const z of [-22, 22]) {
        for (const x of [-12, 12]) parts.push({ size: [16, height, .3], position: [x, height / 2, z], solid: true });
        parts.push({ size: [8, height - 5, .3], position: [0, (height + 5) / 2, z], solid: false });
    }
    for (const x of [-20, 20]) parts.push({ size: [.3, height, 44], position: [x, height / 2, 0], solid: true });
    return parts;
}
export class PedestrianNetwork {
    constructor(boxes = []) { this.boxes = boxes; this.cache = new Map(); this.blocked = new Map(); }
    clear(a, b) { return !this.boxes.some(box => segmentHitsBox(a, b, box, .38)); }
    free(point) { return this.clear(point, point); }
    nearest(point) {
        if (this.free(point)) return point.slice();
        for (let r = 1; r <= 12; r++) for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8, p = [point[0] + Math.cos(a) * r, point[1], point[2] + Math.sin(a) * r]; if (this.free(p)) return p; }
        return null;
    }
    route(from, target) {
        const to = this.nearest(target); if (!to || !this.free(from)) return null;
        if (this.clear(from, to)) return [from.slice(), to];
        // A one-metre lattice leaves the goods doors and rack aisles usable. Routes never fall back to crossing a solid.
        const cell = p => [Math.round(p[0]), Math.round(p[2])], key = (x,z) => (x + 100) * 210 + z + 80;
        const point = n => [n.x, to[1], n.z], [sx,sz] = cell(from), [tx,tz] = cell(to), cacheKey = [sx,sz,tx,tz].join(':');
        const cached = this.cache.get(cacheKey); if (cached && this.clear(from, cached[0]) && this.clear(cached.at(-1), to)) return [from.slice(), ...cached.map(p=>p.slice()), to];
        const valid = (x,z) => {
            if(x < -92 || x > 112 || z < -70 || z > 124) return false;
            const k=key(x,z); if(!this.blocked.has(k)) this.blocked.set(k,!this.free([x,0,z])); return !this.blocked.get(k);
        };
        const nodes = new Map(), heap = [];
        const push = n => { heap.push(n); let i=heap.length-1; while(i){const p=(i-1)>>1;if(heap[p].f<=n.f)break;heap[i]=heap[p];i=p;}heap[i]=n; };
        const pop = () => {const first=heap[0],last=heap.pop();if(heap.length){let i=0;while(i*2+1<heap.length){let c=i*2+1;if(c+1<heap.length&&heap[c+1].f<heap[c].f)c++;if(last.f<=heap[c].f)break;heap[i]=heap[c];i=c;}heap[i]=last;}return first;};
        // Connect the exact position to nearby free nodes without crossing a wall.
        for(let x=sx-1;x<=sx+1;x++)for(let z=sz-1;z<=sz+1;z++)if(valid(x,z)&&this.clear(from,[x,0,z])){const n={x,z,g:Math.hypot(x-from[0],z-from[2]),parent:null};n.f=n.g+Math.hypot(tx-x,tz-z);nodes.set(key(x,z),n);push(n);}
        let end=null, visits=0;
        while(heap.length && visits++<16000){const n=pop();if(n.closed)continue;n.closed=true;if(Math.hypot(n.x-to[0],n.z-to[2])<2&&this.clear(point(n),to)){end=n;break;}
            for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){const x=n.x+dx,z=n.z+dz,k=key(x,z);if(!valid(x,z)||!this.clear(point(n),[x,0,z]))continue;const g=n.g+Math.hypot(dx,dz),old=nodes.get(k);if(old&&old.g<=g)continue;const next={x,z,g,f:g+Math.hypot(to[0]-x,to[2]-z),parent:n};nodes.set(k,next);push(next);}
        }
        if(!end)return null;
        const raw=[];for(let n=end;n;n=n.parent)raw.unshift(point(n));raw.push(to);
        const result=[from.slice()];let i=0;while(i<raw.length){let j=raw.length-1;while(j>i&&!this.clear(result.at(-1),raw[j]))j--;result.push(raw[j]);i=j+1;}
        if(this.cache.size>512)this.cache.clear();this.cache.set(cacheKey,result.slice(1,-1));return result;
    }
}
