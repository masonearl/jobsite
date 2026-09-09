import * as THREE from 'three';
import { CampusActivity } from './jobsite-campus-actors.js';
import { clamp, cycle, mix, smooth, workLocation } from './jobsite-campus-activity.mjs';
import { OrbitControls } from '../vendor/three/OrbitControls.js';

const C = window.JobsiteCampus;
export class CampusScene {
    constructor(canvas, failure) {
        this.canvas = canvas;
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'low-power' });
        this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.25));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.2;
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(42, 1, .1, 1800);
        this.controls = new OrbitControls(this.camera, canvas);
        this.controls.enableDamping = true; this.controls.minDistance = 35; this.controls.maxDistance = 300;
        this.controls.maxPolarAngle = Math.PI / 2 - .05;
        this.controls.target.set(0, 2, 0);
        this.controls.addEventListener('start', () => { this.followWork = false; this.canvas.dispatchEvent(new CustomEvent('campuscamera', { detail: 'free' })); });
        this.observer = new ResizeObserver(() => this.resize()); this.observer.observe(canvas.parentElement);
        canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); failure(); });
        this.cutaway = false; this.clock = 0; this.cache = new Map();
        this.assetToken = 0; this.textureLoader = new THREE.TextureLoader();
        this.environmentGenerator = new THREE.PMREMGenerator(this.renderer);
        this.groundMaterial = new THREE.MeshStandardMaterial({ color: 0xb8a58a, roughness: 1 });
        this.surroundMaterial = new THREE.MeshStandardMaterial({ color: 0x969478, roughness: 1 });
        this.textureLoader.load('/assets/jobsite/ground.jpg', texture => {
            texture.colorSpace = THREE.SRGBColorSpace; texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(14, 14);
            texture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
            this.groundMaterial.map = this.groundMaterial.bumpMap = texture; this.groundMaterial.bumpScale = .16; this.groundMaterial.needsUpdate = true;
            const distant = texture.clone(); distant.repeat.set(130, 130); this.surroundMaterial.map = distant; this.surroundMaterial.needsUpdate = true;
        });
        this.sun = new THREE.DirectionalLight(0xffe8bf, 3.5); this.sun.position.set(-60, 100, 40);
        this.sun.castShadow = true; this.sun.shadow.mapSize.set(2048, 2048);
        Object.assign(this.sun.shadow.camera, { left: -115, right: 115, top: 115, bottom: -115, near: .5, far: 300 });
        this.sun.shadow.bias = -.0003; this.sun.shadow.normalBias = .12;
        this.scene.add(this.sun, new THREE.HemisphereLight(0xcce7ff, 0x7c735a, 2.5));
        this.setCamera('site');
    }
    mat(color, metalness = 0, roughness = .85) {
        const key = color + ':' + metalness;
        if (!this.cache.has(key)) this.cache.set(key, new THREE.MeshStandardMaterial({ color, metalness, roughness }));
        return this.cache.get(key);
    }
    group(parent = this.root, x = 0, y = 0, z = 0) { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; }
    shape(geometry, color, position, parent = this.root, metal = 0) {
        const m = new THREE.Mesh(geometry, this.mat(color, metal)); m.position.set(...position); m.castShadow = m.receiveShadow = true; parent.add(m); return m;
    }
    box(size, pos, color, parent, metal = 0) { return this.shape(new THREE.BoxGeometry(...size), color, pos, parent, metal); }
    cyl(r, h, pos, color, parent, sides = 12) { return this.shape(new THREE.CylinderGeometry(r, r, h, sides), color, pos, parent); }
    beam(a, b, width, color, parent) {
        const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b), m = this.box([width, va.distanceTo(vb), width], va.clone().add(vb).multiplyScalar(.5).toArray(), color, parent, .4);
        m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.sub(va).normalize()); return m;
    }
    setCamera(name) {
        this.followWork = name === 'work';
        if (this.followWork) return;
        if (name === 'parking') { this.camera.position.set(4, 35, 129); this.controls.target.set(-37, 0, 82); this.controls.update(); return; }
        this.camera.position.set(...({ site: [122, 104, 148], overhead: [0, 200, 1], detail: [67, 34, 52] }[name] || [122, 104, 148]));
        this.controls.target.set(0, 2, 0); this.controls.update();
    }
    resize() {
        const r = this.canvas.parentElement.getBoundingClientRect(); if (!r.width || !r.height) return;
        this.renderer.setSize(r.width, r.height, false); this.camera.aspect = r.width / r.height;
        this.camera.fov = r.width / r.height < 1 ? 60 : 42; this.camera.updateProjectionMatrix();
    }
    configure(state) {
        const token = ++this.assetToken;
        this.activity?.dispose();
        if (this.root) { this.root.traverse(o => { o.geometry?.dispose(); }); this.scene.remove(this.root); }
        this.state = state; this.root = new THREE.Group(); this.scene.add(this.root);
        const p = C.site(state.site), coast = p.biome === 'coast', desert = p.biome === 'desert';
        this.scene.background = new THREE.Color(coast ? 0xbad5db : 0xc0d0d9); this.scene.fog = new THREE.Fog(this.scene.background, 270, 750);
        for (const z of [-405.5, 405.5]) this.box([1500, 1, 689], [0, -.6, z], 0x868975).material = this.surroundMaterial;
        for (const x of [-413.5, 413.5]) this.box([673, 1, 122], [x, -.6, 0], 0x868975).material = this.surroundMaterial;
        this.surroundMaterial.color.setHex(desert ? 0xb3a58b : coast ? 0x939c8b : 0x939884);
        this.box([154, 1, 122], [0, -2.6, 0], 0x9e8d6e).material = this.groundMaterial;
        if (coast) {
            const water = this.shape(new THREE.PlaneGeometry(900, 1500), 0x6aadb6, [-600, -.5, 0], this.root, .25);
            water.rotation.x = -Math.PI / 2; water.castShadow = false;
        }
        // Deterministic landscape silhouettes, independent of the construction quantities.
        for (let i = 0; i < 24; i++) {
            const a = i * 2.39996, r = 310 + i % 4 * 35;
            if (p.biome === 'forest') for (let j = 0; j < 7; j++) {
                const x = Math.cos(a) * (140 + j * 15), z = Math.sin(a) * (125 + j * 12);
                this.cyl(.6, 7, [x, 2.5, z], 0x675b44);
                this.shape(new THREE.ConeGeometry(3.5, 11, 7), j % 2 ? 0x4c6252 : 0x5a715b, [x, 10, z]);
            }
        }
        // A haul loop stays clear of the buildings; finished paving replaces its base course.
        for (let x = -75; x <= 75; x += 6) for (const z of [-60, 60]) if (z < 0 || x < -53 || x > -43) this.box([.14, 2, .14], [x, .8, z], 0x697675);
        for (const y of [.3, 1.5]) { this.box([150, .07, .07], [0, y, -60], 0x899391); this.box([22, .07, .07], [-64, y, 60], 0x899391); this.box([107, .07, .07], [10.5, y, 60], 0x899391); }
        for (let i = 0; i < 3; i++) {
            const g = this.group(this.root, -48 + i * 13, 0, 40);
            this.box([10, 3, 4], [0, 1.5, 0], 0xc7c4b7, g); this.box([10.3, .2, 4.3], [0, 3.1, 0], 0xe0ddd0, g);
            for (const x of [-3, 0, 3]) this.box([1.4, 1, .1], [x, 1.9, 2.05], 0x355760, g);
        }
        this.halls = ['a', 'b'].map((key, i) => this.buildHall(key, i ? 30 : -28, p.type));
        this.power = this.group(this.root, -41, 0, -38); this.cooling = this.group(this.root, 32, 0, -38);
        for (let i = 0; i < 6; i++) {
            const x = (i % 3) * 7, z = Math.floor(i / 3) * 8;
            this.box([5, .5, 5], [x, .25, z], 0xbebbb1, this.power);
            this.box([3.3, 3.3, 3.5], [x, 2, z], 0x7c8e8c, this.power, .5);
            for (let j = 0; j < 3; j++) this.cyl(.22, 1.1, [x - 1 + j, 4, z], 0x605c55, this.power);
            this.box([5, 2.5, 5], [x, 1.5, z], 0xc3c9c6, this.cooling, .4);
            for (const dx of [-1.3, 1.3]) { this.cyl(.95, .18, [x + dx, 2.85, z], 0x343e40, this.cooling, 20); this.box([1.8, .1, .12], [x + dx, 2.98, z], 0x819190, this.cooling); }
        }
        this.cranes = Array.from({ length: 3 }, () => this.buildCrane());
        this.activity = new CampusActivity(this, state);
        this.setCamera('site'); this.resize(); this.render(state, 0);
        this.textureLoader.load('/assets/jobsite/' + (coast ? 'desert' : p.biome) + '.jpg', texture => {
            if (token !== this.assetToken) { texture.dispose(); return; }
            this.sky?.dispose(); this.environment?.dispose(); this.sky = texture;
            texture.mapping = THREE.EquirectangularReflectionMapping; texture.colorSpace = THREE.SRGBColorSpace;
            this.scene.background = texture; this.environment = this.environmentGenerator.fromEquirectangular(texture);
            this.scene.environment = this.environment.texture; this.scene.environmentIntensity = .35;
        });
    }
    buildHall(key, x, type) {
        const g = this.group(this.root, x, 0, -3), height = type === 'space' ? key === 'a' ? 52 : 24 : type === 'fab' ? 14 : 10;
        const slab = this.group(g);
        for (let i = 0; i < 10; i++) this.box([43, .6, 4.75], [0, .25, -22 + i * 4.8], 0xbfbfb5, slab);
        const foundation = this.group(g);
        for (const z of [-20, -10, 0, 10, 20]) for (const px of [-18, 18]) this.box([3, .6, 3], [px, .35, z], 0xc6c4b8, foundation);
        const frame = this.group(g), envelope = this.group(g), roof = this.group(g), fitout = this.group(g), mep = this.group(g);
        if (type === 'space' && key === 'a') {
            for (let y = 0; y < 52; y += 6.5) {
                const level = this.group(frame, -8, y, 0);
                for (const px of [-3, 3]) for (const z of [-3, 3]) this.box([.55, 6.5, .55], [px, 3.25, z], 0x69787c, level, .7);
                for (const z of [-3, 3]) { this.beam([-3, 0, z], [3, 6.5, z], .23, 0x869292, level); this.box([7, .3, .6], [0, 6.5, z], 0x69787c, level); }
                this.box([8, .3, 8], [-8, y + .8, 0], 0x939e9e, envelope);
            }
            this.cyl(10, 1.2, [9, .8, 0], 0x92938c, fitout, 48);
            for (const z of [-16, 16]) this.box([30, .4, 2], [0, 2, z], 0x9ca5a2, envelope);
        } else {
            for (const z of [-22, -11, 0, 11, 22]) {
                for (const px of [-20, 20]) { const column = this.group(frame, px, height / 2, z); this.box([.6, height, .6], [0, 0, 0], 0x72858a, column, .6); }
                const rafter = this.group(frame, 0, height, z);
                this.box([40, .65, .45], [0, 0, 0], 0x879a9b, rafter, .6);
                for (let px = -20; px < 20; px += 8) this.beam([px, 0, 0], [px + 4, -2, 0], .16, 0xa3b2b0, rafter);
            }
            for (const z of [-22, 22]) this.box([41, height, .3], [0, height / 2, z], 0xc0c9c9, envelope, .2);
            for (const px of [-20, 20]) this.box([.3, height, 44], [px, height / 2, 0], 0xa7b4b8, envelope, .2);
            for (let px = -19; px < 20; px += 2) for (const z of [-22.2, 22.2]) this.box([.07, height, .07], [px, height / 2, z], 0x939f9e, envelope);
            this.box([42, .35, 46], [0, height + .3, 0], 0xd2d4cc, roof, .2);
            for (let z = -20; z < 22; z += 4) this.box([42, .08, .12], [0, height + .53, z], 0xa3aca9, roof);
            for (let i = 0; i < 6; i++) this.box([4, 1.5, 3], [-12 + i % 3 * 12, height + 1.2, -12 + Math.floor(i / 3) * 24], 0x858f8e, roof);
            for (let row = 0; row < 6; row++) for (let col = 0; col < 8; col++) this.box([1.2, type === 'fab' ? 3 : 2.5, 2], [-15 + row * 6, 1.7, -17 + col * 4.7], type === 'fab' ? 0xd0d8d6 : 0x263b43, fitout, .3);
            for (const z of [-17, 0, 17]) this.box([37, .4, .7], [0, height - 2, z], 0x74a3a2, mep, .4);
            for (const px of [-15, 15]) this.box([.6, .5, 43], [px, height - 2, 0], 0xc0a86a, mep, .4);
        }
        return { key, g, slab, foundation, frame, envelope, roof, fitout, mep };
    }
    buildCrane() {
        const g = this.group(), upper = this.group(g, 0, 2, 0);
        for (const x of [-2, 2]) this.box([.9, 1.1, 7], [x, .6, 0], 0x414947, g);
        this.box([3.5, 1.3, 5], [0, 1.2, 0], 0xd7ab4a, g);
        this.box([2, 1.7, 2.4], [1, 1.6, -1], 0xa7bbb9, upper);
        this.box([1.8, 1, .1], [1, 1.8, -2.25], 0x34545e, upper);
        this.box([3.5, 2, 2.4], [0, 1.1, 2], 0xd7ab4a, upper);
        const boom = this.box([.65, .65, 1], [0, 0, 0], 0xd8b35b, this.root);
        const cable = this.box([.06, .06, 1], [0, 0, 0], 0x333c40, this.root);
        const hook = this.box([.5, .65, .45], [0, 0, 0], 0xc9a24d, this.root);
        const payload = this.group(this.root);
        return { g, upper, boom, cable, hook, payload, payloadKey: null };
    }
    updateCrane(crane, task, state, index) {
        const active = !!task;
        [crane.g, crane.boom, crane.cable, crane.hook].forEach(o => o.visible = index < state.equipment.crane);
        crane.payload.visible = active;
        const p = task ? state.tasks[task.id].progress : 0;
        const hall = task && this.halls.find(h => task.id === h.key + '-frame');
        const group = hall ? hall.frame : task?.id === 'power' ? this.power : task?.id === 'cooling' ? this.cooling : null;
        const c = cycle(p, group?.children.length || 1), part = group?.children[c.index];
        const base = hall ? [hall.g.position.x + 26, 0, hall.g.position.z + (part?.position.z || 0)] : task?.zone === 'power' ? [-14, 0, -35] : task?.zone === 'cooling' ? [57, 0, -35] : [60,0,35-index*10];
        crane.g.position.set(...base);
        let target = [base[0]-7, 1, base[2]-5], loadPosition = target;
        if (part) {
            const parent = hall ? hall.g.position : group.position;
            target = [part.position.x+parent.x, part.position.y+parent.y, part.position.z+parent.z];
            const key = task.id + ':' + c.index;
            if (crane.payloadKey !== key) { crane.payload.clear(); const load = part.clone(); load.position.set(0,0,0); load.visible = true; const bounds=new THREE.Box3().setFromObject(load); crane.loadBottom=bounds.min.y;crane.loadTop=bounds.max.y;crane.payload.add(load); crane.payloadKey = key; }
            const pickup = [base[0]+2, .3-crane.loadBottom, base[2]+8];
            const raised = [pickup[0],target[1]+6,pickup[2]], over = [target[0],target[1]+6,target[2]];
            loadPosition = c.phase < .22 ? pickup.map((v,i)=>mix(v,raised[i],smooth(c.phase/.22))) : c.phase < .7 ? raised.map((v,i)=>mix(v,over[i],smooth((c.phase-.22)/.48))) : over.map((v,i)=>mix(v,target[i],smooth((c.phase-.7)/.3)));
            crane.payload.position.set(...loadPosition);
        }
        const top = [loadPosition[0],loadPosition[1]+(crane.loadTop||2)+6,loadPosition[2]], hook = [loadPosition[0],loadPosition[1]+(crane.loadTop||2)+.3,loadPosition[2]];
        this.activity.setBeam(crane.boom,[base[0],4,base[2]],top);this.activity.setBeam(crane.cable,top,hook);crane.hook.position.set(...hook);
        crane.upper.rotation.y=Math.atan2(-(top[0]-base[0]),-(top[2]-base[2]));
    }
    showParts(group, amount) { group.children.forEach((part, i) => { part.visible = i < Math.floor(amount * group.children.length + 1e-6); }); group.visible = amount > 0; }
    render(s, dt) {
        if (!this.root || !this.activity) return;
        const renderStart=performance.now();
        const val = key => s.tasks[key]?.progress || 0;
        const { active } = C.allocation(s);
        for (const h of this.halls) {
            const foundation = val(h.key + '-slab'), poured = clamp((foundation - .25) / .75);
            this.showParts(h.foundation, clamp(foundation / .25));
            h.slab.children.forEach((strip, i) => { const f = clamp(poured * 10 - i); strip.visible = f > 0; strip.scale.x = Math.max(.001, f); strip.position.x = -21.5 + 21.5 * f; });
            this.showParts(h.frame, val(h.key + '-frame'));
            this.showParts(h.envelope, val(h.key + '-envelope'));
            this.showParts(h.roof, val(h.key + '-envelope'));
            const indoor = this.followWork && active.some(t => t.zone === h.key && !t.outdoor);
            h.roof.visible = h.roof.visible && !this.cutaway && !indoor;
            h.envelope.visible = h.envelope.visible && !this.cutaway && !indoor;
            this.showParts(h.fitout, val(h.key + '-fitout'));
            this.showParts(h.mep, Math.max(val(h.key + '-mep'), val(h.key + '-electric')));
        }
        this.showParts(this.power, val('power')); this.showParts(this.cooling, val('cooling'));
        this.activity.update(s, dt, active);
        const lifting = active.filter(t => t.equipment === 'crane');
        this.cranes.forEach((crane, i) => this.updateCrane(crane, lifting[i], s, i));
        if (this.followWork) {
            const target = new THREE.Vector3(...this.activity.focus).add(new THREE.Vector3(0,2,0));
            const offset = new THREE.Vector3(34,27,42);
            this.controls.target.lerp(target, dt ? 1-Math.exp(-dt*2.5) : 1);
            this.camera.position.lerp(target.clone().add(offset), dt ? 1-Math.exp(-dt*2.5) : 1);
        }
        this.controls.update(); this.renderer.render(this.scene, this.camera);
        this.canvas.dataset.drawCalls = this.renderer.info.render.calls;
        this.canvas.dataset.cameraFollow = String(!!this.followWork);
        this.canvas.dataset.renderMs=(performance.now()-renderStart).toFixed(1);
    }
}
