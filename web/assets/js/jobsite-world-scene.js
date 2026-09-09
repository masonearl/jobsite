import * as THREE from 'three';
import { surfacePoint, rotateView, zoomDistance, approachView, facesCamera, spreadMarkers } from './jobsite-world-math.mjs';
import { WorldImagery } from './jobsite-world-imagery.js';

export class WorldScene {
    constructor(canvas, pins, sites, select, failure) {
        this.canvas = canvas; this.pins = pins; this.sites = sites; this.select = select;
        this.view = { lat: 24, lon: -100, distance: 3.7 }; this.target = { ...this.view };
        this.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
        this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
        this.renderer.setClearColor(0x15120f, 0);
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(42, 1, .01, 100);
        this.globe = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .92, metalness: .12 }));
        this.scene.add(this.globe);
        this.scene.add(new THREE.AmbientLight(0xd7d4cf, 1.6));
        this.sun = new THREE.DirectionalLight(0xffead2, 2.6); this.scene.add(this.sun);
        const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(1.025, 64, 48), new THREE.ShaderMaterial({
            transparent: true, depthWrite: false, side: THREE.BackSide,
            vertexShader: 'varying vec3 n; varying vec3 v; void main(){vec4 p=modelViewMatrix*vec4(position,1.0); n=normalize(normalMatrix*normal);v=normalize(-p.xyz);gl_Position=projectionMatrix*p;}',
            fragmentShader: 'varying vec3 n;varying vec3 v;void main(){float a=pow(1.0-abs(dot(normalize(n),normalize(v))),3.5);gl_FragColor=vec4(0.42,0.58,0.72,a*0.18);}'
        }));
        this.scene.add(atmosphere);
        this.markerNodes = sites.map((site, i) => {
            const button = document.createElement('button'); button.className = 'world-pin'; button.textContent = String(i + 1).padStart(2, '0');
            button.dataset.worldSite = site.id; button.setAttribute('aria-label', site.name + ', ' + site.place); button.title = site.name;
            button.addEventListener('click', () => { this.select(site.id); this.focusSite(site); });
            const label = document.createElement('span'); label.className = 'pin-label'; label.textContent = site.name; button.append(label);
            pins.append(button);
            return { site, button, point: surfacePoint(site.lat, site.lon) };
        });
        this.cluster = document.createElement('button'); this.cluster.className = 'world-cluster';
        this.cluster.innerHTML = '<span>07</span><div>United States<small>Explore projects</small></div>';
        this.cluster.setAttribute('aria-label', 'Explore seven United States projects'); this.cluster.addEventListener('click', () => this.focusUS()); pins.append(this.cluster);
        this.observer = new ResizeObserver(() => this.resize()); this.observer.observe(canvas.parentElement);
        canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); this.imagery?.dispose(); failure(); });
        canvas.addEventListener('webglcontextrestored', () => failure());
        this.bindInput(); this.resize();
        this.ready = this.buildSurface();
    }
    async buildSurface() {
        try {
            const texture = await new THREE.TextureLoader().loadAsync('/assets/jobsite/earth-blue-marble-4k.jpg');
            texture.colorSpace = THREE.SRGBColorSpace;
            texture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
            this.globe.material.map = texture; this.globe.material.needsUpdate = true;
            this.canvas.dataset.surface = 'blue-marble';
            this.imagery = new WorldImagery(this.scene, this.renderer, this.globe.material, this.canvas);
            return;
        } catch (_) { /* Keep a local cartographic fallback if the image cannot load. */ }

        const response = await fetch('/assets/jobsite/world-land.geojson'); if (!response.ok) throw Error('World map unavailable');
        const data = await response.json(), map = document.createElement('canvas'); map.width = 2048; map.height = 1024;
        const ctx = map.getContext('2d'); ctx.fillStyle = '#17232a'; ctx.fillRect(0, 0, map.width, map.height);
        const land = new Path2D();
        for (const feature of data.features) {
            const polygons = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
            for (const polygon of polygons) for (const ring of polygon) {
                ring.forEach(([lon, lat], i) => { const x = (lon + 180) / 360 * map.width, y = (90 - lat) / 180 * map.height; if (i) land.lineTo(x, y); else land.moveTo(x, y); }); land.closePath();
            }
        }
        const terrain = ctx.createLinearGradient(0, 0, 0, 1024);
        [[0,'#d0ccbd'],[.14,'#8c8e7a'],[.27,'#686d57'],[.37,'#a89670'],[.48,'#687051'],[.57,'#737658'],[.7,'#998566'],[.85,'#b0aa94'],[1,'#e0d9ca']].forEach(([stop,color]) => terrain.addColorStop(stop,color));
        ctx.fillStyle = terrain; ctx.fill(land, 'evenodd');
        ctx.save(); ctx.clip(land,'evenodd');
        // Deterministic grain gives the cartographic terrain relief without remote imagery.
        let seed = 749;
        const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
        for (let i = 0; i < 44000; i++) { const light = random() > .5; ctx.fillStyle = light ? '#efe8dd16' : '#171b1718'; ctx.fillRect(random()*2048,random()*1024,1+random()*5,1+random()*2); }
        ctx.restore(); ctx.strokeStyle='#ccb79666'; ctx.lineWidth=.65; ctx.stroke(land);
        ctx.strokeStyle = '#b4a69219'; ctx.lineWidth=.65;
        for (let lon = 0; lon <= 360; lon += 15) { const x=lon/360*2048;ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,1024);ctx.stroke(); }
        for (let lat = 15; lat < 180; lat += 15) { const y=lat/180*1024;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(2048,y);ctx.stroke(); }
        const texture = new THREE.CanvasTexture(map); texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=Math.min(8,this.renderer.capabilities.getMaxAnisotropy());
        this.globe.material.map = texture; this.globe.material.needsUpdate = true;
    }
    resize() {
        const { width, height } = this.canvas.parentElement.getBoundingClientRect(); if (!width || !height) return;
        this.width=width;this.height=height;this.renderer.setSize(width,height,false);this.camera.aspect=width/height;
        this.camera.fov = width < height ? 2 * Math.atan(Math.tan(21 * Math.PI / 180) * height / width) * 180 / Math.PI : 42;
        this.camera.updateProjectionMatrix();
    }
    setSelected(id) { this.markerNodes.forEach(({site,button}) => button.setAttribute('aria-pressed', site.id===id)); }
    home() { this.target = { lat: 24, lon: -100, distance: 3.7 }; }
    focusUS() { this.target = { lat: 36, lon: -98, distance: 1.94 }; }
    focusSite(site) { this.target = { lat: site.lat, lon: site.lon, distance: 1.6 }; }
    zoom(delta) { this.target.distance = zoomDistance(this.target.distance, delta); }
    bindInput() {
        const pointers = new Map(); let pinch = 0;
        const gap = () => { const p=[...pointers.values()]; return p.length < 2 ? 0 : Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y); };
        this.canvas.addEventListener('pointerdown', e => {
            if (e.pointerType==='mouse' && e.button!==0) return;
            this.canvas.focus({preventScroll:true});this.canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});pinch=gap();this.canvas.classList.add('dragging');
        });
        this.canvas.addEventListener('pointermove', e => {
            const previous=pointers.get(e.pointerId);if(!previous)return;
            pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
            if(pointers.size===1)this.target=rotateView(this.target,e.clientX-previous.x,e.clientY-previous.y,this.height);
            else { const next=gap();if(pinch>0&&next>0)this.zoom(Math.log(pinch/next));pinch=next; }
        });
        const release=e=>{pointers.delete(e.pointerId);pinch=gap();if(!pointers.size)this.canvas.classList.remove('dragging');};
        ['pointerup','pointercancel','lostpointercapture'].forEach(name=>this.canvas.addEventListener(name,release));
        this.canvas.addEventListener('wheel',e=>{e.preventDefault();const pixels=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?this.height:1);this.zoom(pixels*.0015);},{passive:false});
        this.canvas.addEventListener('keydown',e=>{
            if(e.metaKey||e.ctrlKey||e.altKey)return;
            const amount=5*Math.max(.3,this.target.distance-1);
            if(e.key==='ArrowLeft')this.target=rotateView(this.target,amount*10,0,this.height);
            else if(e.key==='ArrowRight')this.target=rotateView(this.target,-amount*10,0,this.height);
            else if(e.key==='ArrowUp')this.target=rotateView(this.target,0,-amount*10,this.height);
            else if(e.key==='ArrowDown')this.target=rotateView(this.target,0,amount*10,this.height);
            else if(e.key==='+'||e.key==='=')this.zoom(-.18);
            else if(e.key==='-')this.zoom(.18);
            else if(e.key==='Home')this.home();else return;e.preventDefault();
        });
    }
    render(dt) {
        this.view=approachView(this.view,this.target,this.reducedMotion?1:1-Math.exp(-dt*9));
        const cameraPoint=surfacePoint(this.view.lat,this.view.lon,this.view.distance);this.camera.position.set(...cameraPoint);this.camera.lookAt(0,0,0);this.camera.updateMatrixWorld();
        this.sun.position.copy(this.camera.position).add(new THREE.Vector3(-1,2,1));
        this.imagery?.update(this.view, this.width, this.height, this.renderer.getPixelRatio());
        this.renderer.render(this.scene,this.camera);
        const project=point=>{const p=new THREE.Vector3(...point).project(this.camera);return{x:(p.x+1)*this.width/2,y:(1-p.y)*this.height/2,visible:facesCamera(point,cameraPoint)&&p.z<1&&Math.abs(p.x)<1.05&&Math.abs(p.y)<1.05};};
        const clustered=this.view.distance>2.75, clusterPosition=project(surfacePoint(36,-98));
        this.cluster.hidden=!clustered||!clusterPosition.visible;this.cluster.style.left=clusterPosition.x+'px';this.cluster.style.top=clusterPosition.y+'px';
        const positions=spreadMarkers(this.markerNodes.map((node,i)=>({...project(node.point),i})).filter(p=>p.visible));
        this.markerNodes.forEach(node=>{node.button.hidden=true;});
        if(!clustered)for(const p of positions){const b=this.markerNodes[p.i].button;b.hidden=false;b.style.left=p.x+'px';b.style.top=p.y+'px';}
        this.canvas.dataset.worldDistance=this.view.distance.toFixed(3);this.canvas.dataset.worldLongitude=this.view.lon.toFixed(2);this.canvas.dataset.drawCalls=this.renderer.info.render.calls;
    }
}
