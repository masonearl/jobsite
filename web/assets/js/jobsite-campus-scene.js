import * as THREE from 'three';
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
        if (this.root) { this.root.traverse(o => { o.geometry?.dispose(); }); this.scene.remove(this.root); }
        this.state = state; this.root = new THREE.Group(); this.scene.add(this.root);
        const p = C.site(state.site), coast = p.biome === 'coast', desert = p.biome === 'desert';
        this.scene.background = new THREE.Color(coast ? 0xbad5db : 0xc0d0d9); this.scene.fog = new THREE.Fog(this.scene.background, 270, 750);
        this.box([1500, 1, 1500], [0, -1.4, 0], 0x868975).material = this.surroundMaterial;
        this.surroundMaterial.color.setHex(desert ? 0xb3a58b : coast ? 0x939c8b : 0x939884);
        this.box([154, .45, 122], [0, -.4, 0], 0x9e8d6e).material = this.groundMaterial;
        this.graded = this.box([143, .12, 112], [0, -.12, 0], 0xb4a389);
        this.graded.material = this.groundMaterial;
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
        this.roads = this.group();
        for (const z of [-53, 53]) this.box([145, .14, 7], [0, .03, z], 0x4f5555, this.roads);
        for (const x of [-69, 69]) this.box([7, .14, 106], [x, .03, 0], 0x4f5555, this.roads);
        for (let x = -60; x <= 60; x += 9) for (const z of [-53, 53]) this.box([3, .02, .12], [x, .12, z], 0xd9cda8, this.roads);
        for (let x = -75; x <= 75; x += 6) for (const z of [-60, 60]) this.box([.14, 2, .14], [x, .8, z], 0x697675);
        for (const z of [-60, 60]) for (const y of [.3, 1.5]) this.box([150, .07, .07], [0, y, z], 0x899391);
        for (let i = 0; i < 3; i++) {
            const g = this.group(this.root, -48 + i * 13, 0, 40);
            this.box([10, 3, 4], [0, 1.5, 0], 0xc7c4b7, g); this.box([10.3, .2, 4.3], [0, 3.1, 0], 0xe0ddd0, g);
            for (const x of [-3, 0, 3]) this.box([1.4, 1, .1], [x, 1.9, 2.05], 0x355760, g);
        }
        this.halls = ['a', 'b'].map((key, i) => this.buildHall(key, i ? 30 : -28, p.type));
        this.utility = this.group();
        this.pipePieces = Array.from({ length: 24 }, (_, i) => this.box([4.6, .3, 1.2], [-57 + i * 5, .13, 30], 0x476d70, this.utility));
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
        this.movers = Array.from({ length: 8 }, (_, i) => this.buildVehicle(i < 2 ? 'excavator' : i < 4 ? 'dozer' : 'truck'));
        this.workers = Array.from({ length: 72 }, (_, i) => {
            const g = this.group(); this.box([.4, .65, .28], [0, 1, 0], i % 3 ? 0xe7a83b : 0xe9e373, g);
            this.cyl(.18, .28, [0, 1.56, 0], 0xd4b292, g); this.cyl(.23, .1, [0, 1.73, 0], 0xf1e2b1, g);
            for (const x of [-.12, .12]) this.box([.14, .65, .17], [x, .35, 0], 0x334953, g); return g;
        });
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
        const slab = this.box([43, .6, 49], [0, .25, 0], 0xbfbfb5, g);
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
                const bay = this.group(frame);
                for (const px of [-20, 20]) this.box([.6, height, .6], [px, height / 2, z], 0x72858a, bay, .6);
                this.box([40, .65, .45], [0, height, z], 0x879a9b, bay, .6);
                for (let px = -20; px < 20; px += 8) this.beam([px, height, z], [px + 4, height - 2, z], .16, 0xa3b2b0, bay);
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
        this.box([4, 1.5, 7], [0, .8, 0], 0x444c4d, g); this.box([5, 1.4, 4], [0, .6, 0], 0x424846, g);
        this.box([3, 2, 4], [0, 1, 0], 0xd7ab4a, upper);
        this.beam([0, 2, 0], [0, 38, -15], .9, 0xd8b35b, upper);
        this.beam([0, 38, -15], [0, 5, -15], .07, 0x40494a, upper);
        this.box([1, .7, 1], [0, 5, -15], 0xc9a24d, upper);
        return { g, upper };
    }
    buildVehicle(kind) {
        const g = this.group(), body = this.group(g);
        this.box([2.8, .8, 4.5], [0, .7, 0], 0x414746, body);
        this.box([2.5, 1.3, 3.6], [0, 1.7, 0], 0xd8ad50, body);
        this.box([1.6, 1.6, 1.7], [.4, 2.7, -.6], 0xb7c7c6, body);
        this.box([1.45, .85, .07], [.4, 2.9, -1.48], 0x355760, body);
        const arm = this.group(body, -1, 2, -1);
        if (kind === 'excavator') { this.beam([0, 0, 0], [0, 4, -3], .45, 0xd9ae4f, arm); this.beam([0, 4, -3], [0, 0, -6], .3, 0xe0b956, arm); this.box([1.4, .8, 1.3], [0, -.3, -6], 0x555f5b, arm); }
        if (kind === 'dozer') this.box([4, 1.5, .55], [0, .8, -3], 0xdcc17c, body);
        if (kind === 'truck') { this.box([3, 1.5, 4.6], [0, 2, 2.5], 0xc3bca5, body); this.box([2.6, .2, 4.2], [0, 2.8, 2.5], 0x968260, body); }
        for (const x of [-1.5, 1.5]) for (const z of [-1.4, 1.4]) { const tire = this.cyl(.65, .45, [x, .6, z], 0x343b3c, body); tire.rotation.z = Math.PI / 2; }
        return { g, body, arm, kind };
    }
    showParts(group, progress) { group.children.forEach((part, i) => { part.visible = i / group.children.length < progress; }); group.visible = progress > 0; }
    render(s, dt) {
        if (!this.root) return;
        if (s.running) this.clock += dt * s.speed;
        const t = this.clock, val = key => s.tasks[key]?.progress || 0;
        this.graded.scale.x = Math.max(.02, val('grade')); this.roads.visible = val('clear') > .25;
        this.roads.children.forEach(m => { if (m.geometry.parameters.height > .1) m.material = this.mat(val('roads') > .5 ? 0x414a4c : 0x938c79); });
        for (const h of this.halls) {
            h.foundation.visible = val(h.key + '-slab') > 0;
            h.slab.visible = val(h.key + '-slab') > .35; h.slab.scale.z = Math.max(.01, val(h.key + '-slab'));
            this.showParts(h.frame, val(h.key + '-frame'));
            this.showParts(h.envelope, val(h.key + '-envelope'));
            this.showParts(h.roof, val(h.key + '-envelope'));
            h.roof.visible = h.roof.visible && !this.cutaway;
            h.envelope.visible = h.envelope.visible && !this.cutaway;
            this.showParts(h.fitout, val(h.key + '-fitout'));
            this.showParts(h.mep, val(h.key + '-mep'));
        }
        this.showParts(this.power, val('power')); this.showParts(this.cooling, val('cooling'));
        this.pipePieces.forEach((p, i) => { p.visible = i / 24 < val('drain'); p.material = this.mat(i / 24 < val('duct') ? 0xb1a087 : 0x49757b); });
        const { active } = C.allocation(s), positions = { a: [-28, 0], b: [30, 0], yard: [0, 28], utilities: [0, 30], power: [-38, -37], cooling: [36, -37], access: [-44, 40] };
        const cranes = active.filter(a => a.equipment === 'crane');
        this.cranes.forEach((crane, i) => {
            crane.g.visible = i < s.equipment.crane;
            const location = cranes[i] ? positions[cranes[i].zone] : [57, 35 - i * 10];
            crane.g.position.set(location[0] + (cranes[i] ? 21 : 0), 0, location[1]);
            crane.upper.rotation.y = cranes[i] ? Math.sin(t * .15 + i) * .4 + 1 : 0;
        });
        const earth = active.some(a => a.equipment === 'earth'), utility = active.some(a => a.equipment === 'trench');
        this.movers.forEach((m, i) => {
            const work = earth || (i === 0 && utility), phase = work ? t * .35 + i * 4 : i * 4;
            if (i >= 4) { const a = phase * .08; m.g.position.set(Math.sin(a) * 66, 0, Math.cos(a) * 52); m.g.rotation.y = a + Math.PI / 2; }
            else { m.g.position.set(-52 + i * 22 + (work ? Math.sin(phase * .15) * 7 : 0), 0, i === 0 && utility ? 27 : 31); m.body.rotation.y = work ? Math.sin(phase * .3) * .6 : 0; m.arm.rotation.x = work ? Math.sin(phase) * .18 : 0; }
        });
        let worker = 0;
        for (const task of active) {
            const [x, z] = positions[task.zone], count = Math.min(C.TRADES[task.trade].people, 8);
            for (let j = 0; j < count && worker < this.workers.length; j++, worker++) {
                const w = this.workers[worker], angle = j * 2.4 + t * .02;
                w.visible = true; w.position.set(x + Math.cos(angle) * (5 + j % 3 * 2), 0, z + Math.sin(angle) * (4 + j % 4 * 2)); w.rotation.y = angle;
            }
        }
        for (; worker < this.workers.length; worker++) this.workers[worker].visible = false;
        this.controls.update(); this.renderer.render(this.scene, this.camera);
        this.canvas.dataset.drawCalls = this.renderer.info.render.calls;
    }
}
