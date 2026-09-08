import * as THREE from 'three';
import { OrbitControls } from '../vendor/three/OrbitControls.js';

const Sim = window.JobsiteSim;
const v = (x, y, z) => new THREE.Vector3(x, y, z);
const ease = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };

export class JobsiteScene {
    constructor(canvas, onFailure) {
        this.canvas = canvas;
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'low-power' });
        this.renderer.setPixelRatio(1);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.15;
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(42, 1, .1, 500);
        this.controls = new OrbitControls(this.camera, canvas);
        this.controls.enableDamping = true;
        this.dirty = true; this.renderMs = 0; this.renderCount = 0;
        this.controls.addEventListener('change', () => { this.dirty = true; });
        this.controls.enablePan = false;
        this.controls.minDistance = 7;
        this.controls.maxDistance = 40;
        this.controls.minPolarAngle = .12;
        this.controls.maxPolarAngle = Math.PI / 2 - .04;
        this.canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); onFailure('The graphics context was interrupted. Reload the 3D view to continue.'); });
        this.resizeObserver = new ResizeObserver(() => this.resize());
        this.resizeObserver.observe(canvas.parentElement);
        this.frame = 0;
        this.changeToken = 0;
        this.lastTerrainRevision = -1; this.terrainRef = null;
        this.textureLoader = new THREE.TextureLoader();
        this.environmentGenerator = new THREE.PMREMGenerator(this.renderer);
        this.setCamera('site');
    }
    resize() {
        const { width, height } = this.canvas.parentElement.getBoundingClientRect();
        if (!width || !height) return;
        this.renderer.setSize(width, height, false);
        this.camera.aspect = width / height;
        this.camera.fov = width / height < .85 ? 60 : width / height < 1.1 ? 52 : 42;
        this.camera.updateProjectionMatrix();
        this.dirty = true;
    }
    setCamera(name) {
        const positions = { site: [11, 5.5, 11], machine: [8, 3.9, 9], overhead: [6, 22, 8] };
        this.camera.position.set(...(positions[name] || positions.site));
        const position = this.state?.machine || { x: 0, z: 0 };
        this.camera.position.add(v(position.x, 0, position.z));
        this.controls.target.set(position.x + 1.5, 1.3, position.z - 1.5);
        this.cameraAnchor = v(position.x, 0, position.z);
        this.controls.update();
    }
    material(color, metalness = 0, roughness = .8, options = {}) {
        return new THREE.MeshStandardMaterial({ color, metalness, roughness, ...options });
    }
    mesh(geometry, material, position, parent = this.root) {
        const m = new THREE.Mesh(geometry, material);
        if (position) m.position.set(...position);
        m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
    }
    box(size, position, material, parent = this.root, bevel = false) {
        let geometry;
        if (bevel) {
            const [w, h, d] = size, s = new THREE.Shape();
            s.moveTo(-w / 2, -h / 2); s.lineTo(w / 2, -h / 2); s.lineTo(w / 2, h / 2); s.lineTo(-w / 2, h / 2); s.closePath();
            geometry = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: .05, bevelThickness: .04 });
            geometry.translate(0, 0, -d / 2);
        } else geometry = new THREE.BoxGeometry(...size);
        return this.mesh(geometry, material, position, parent);
    }
    cylinder(r1, r2, h, position, material, parent = this.root, sides = 16) {
        return this.mesh(new THREE.CylinderGeometry(r1, r2, h, sides), material, position, parent);
    }
    rod(a, b, radius, material, parent) {
        const m = this.cylinder(radius, radius, a.distanceTo(b), [0, 0, 0], material, parent, 12);
        this.placeRod(m, a, b); return m;
    }
    placeRod(m, a, b) {
        m.position.copy(a).add(b).multiplyScalar(.5);
        m.quaternion.setFromUnitVectors(v(0, 1, 0), b.clone().sub(a).normalize());
        const nativeHeight = m.geometry.parameters.height;
        m.scale.y = a.distanceTo(b) / nativeHeight;
    }
    label(value, width = 256) {
        const c = document.createElement('canvas'); c.width = width; c.height = 64;
        const x = c.getContext('2d'); x.fillStyle = '#202a24'; x.fillRect(0, 0, width, 64);
        x.fillStyle = '#eee3bb'; x.font = 'bold 32px Arial'; x.textAlign = 'center'; x.fillText(value, width / 2, 44);
        const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
    }
    crewLabel(parent, role, height) {
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.label(Sim.crewTag(this.state, role), role === 'operator' ? 256 : 96), depthTest: true }));
        sprite.position.y = height; sprite.scale.set(role === 'operator' ? 2 : .75, .4, 1); parent.add(sprite);
        return { sprite, role, level: 1 };
    }
    paintWear() {
        const c = document.createElement('canvas'); c.width = c.height = 512;
        const x = c.getContext('2d'); x.fillStyle = '#eeeae1'; x.fillRect(0, 0, 512, 512);
        let seed = 173;
        const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
        for (let i = 0; i < 4500; i++) {
            x.fillStyle = i % 3 ? '#574d3822' : '#fff9e833';
            x.fillRect(rnd() * 512, rnd() * 512, .5 + rnd() * 2, .5 + rnd() * 2);
        }
        for (let i = 0; i < 42; i++) {
            x.strokeStyle = '#77664b40'; x.lineWidth = .5; x.beginPath();
            const px = rnd() * 512, py = rnd() * 512;
            x.moveTo(px, py); x.lineTo(px + 8 + rnd() * 50, py - rnd() * 7); x.stroke();
        }
        const texture = new THREE.CanvasTexture(c); texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = 4; return texture;
    }
    groundTexture(biome) {
        const c = document.createElement('canvas'); c.width = c.height = 512;
        const x = c.getContext('2d');
        const colors = { mountain: [133, 116, 88], forest: [94, 83, 68], desert: [177, 152, 114], volcanic: [76, 77, 72] };
        const base = colors[biome]; const data = x.createImageData(512, 512);
        let seed = 89;
        const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
        for (let i = 0; i < data.data.length; i += 4) {
            const n = (rnd() - .5) * 44;
            for (let j = 0; j < 3; j++) data.data[i + j] = base[j] + n;
            data.data[i + 3] = 255;
        }
        x.putImageData(data, 0, 0);
        for (let i = 0; i < 2400; i++) {
            const px = rnd() * 512, py = rnd() * 512, r = rnd() * 2.5 + .4;
            x.fillStyle = rnd() > .5 ? '#e7dac633' : '#15171155';
            x.beginPath(); x.ellipse(px, py, r, r * .65, rnd() * 3, 0, Math.PI * 2); x.fill();
        }
        const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
        t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(20, 20); t.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
        return t;
    }
    disposeRoot() {
        const materials = new Set(), geometries = new Set(), textures = new Set();
        this.scene.traverse(o => {
            o.shadow?.map?.dispose();
            if (o.geometry) geometries.add(o.geometry);
            for (const m of o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []) {
                materials.add(m); for (const value of Object.values(m)) if (value?.isTexture) textures.add(value);
            }
        });
        geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose());
        this.skyTexture?.dispose(); this.environment?.dispose();
        this.scene.clear();
    }
    async configure(s) {
        const token = ++this.changeToken;
        this.disposeRoot();
        this.pendingPipe = null; this.utilityRef = null; this.utilityCount = -1; this.skyTexture = null; this.environment = null;
        this.planLines = null; this.planRef = null; this.planRevision = -1;
        this.root = new THREE.Group(); this.scene.add(this.root);
        this.scene.background = new THREE.Color('#afb8ae'); this.scene.environment = null;
        this.scene.fog = new THREE.Fog(s.region.biome === 'forest' ? '#9baba4' : s.region.biome === 'desert' ? '#ddc9a6' : '#b8bdb0', 50, 170);
        this.state = s; this.lastTerrainRevision = -1; this.terrainRef = null;
        const wet = s.region.biome === 'forest';
        const wear = this.paintWear();
        this.paint = this.material(s.fleet.color, .32, .42, { map: wear, bumpMap: wear, bumpScale: .012 });
        this.paintDark = this.material('#99722a', .35, .5);
        this.rubber = this.material('#252927', .12, .88);
        this.steel = this.material('#505954', .72, .37);
        this.chrome = this.material('#bbc9c7', .92, .2);
        this.glass = this.material('#38585b', .55, .14, { transparent: true, opacity: .82 });
        this.dirtMaterial = this.material(Sim.soil(s).color, 0, wet ? .65 : 1);
        this.scene.add(new THREE.HemisphereLight('#d9e8eb', '#756447', 2));
        const sun = new THREE.DirectionalLight(s.region.biome === 'desert' ? '#ffe1aa' : '#fff0d2', wet ? .95 : 3.6);
        sun.position.set(-14, 23, 12); sun.castShadow = true;
        sun.shadow.mapSize.set(1024, 1024); sun.shadow.camera.left = -23; sun.shadow.camera.right = 23; sun.shadow.camera.top = 23; sun.shadow.camera.bottom = -23;
        sun.shadow.camera.near = 1; sun.shadow.camera.far = 70; sun.shadow.bias = -.00025; sun.shadow.normalBias = .03;
        this.scene.add(sun);
        const tex = this.groundTexture(s.region.biome);
        const groundMat = this.material('#ffffff', .02, wet ? .65 : .96, { map: tex, bumpMap: tex, bumpScale: .12, vertexColors: true });
        const groundGeometry = new THREE.PlaneGeometry(Sim.TERRAIN.size, Sim.TERRAIN.size, Sim.TERRAIN.segments, Sim.TERRAIN.segments); groundGeometry.rotateX(-Math.PI / 2);
        groundGeometry.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(groundGeometry.attributes.position.count * 3).fill(1), 3));
        this.ground = this.mesh(groundGeometry, groundMat, [0, -.03, 0]); this.ground.castShadow = false;
        const surround = new THREE.Shape();
        surround.moveTo(-450, -450); surround.lineTo(450, -450); surround.lineTo(450, 450); surround.lineTo(-450, 450); surround.closePath();
        const opening = new THREE.Path();
        opening.moveTo(-28, -28); opening.lineTo(-28, 28); opening.lineTo(28, 28); opening.lineTo(28, -28); opening.closePath();
        surround.holes.push(opening);
        const surroundGeometry = new THREE.ShapeGeometry(surround);
        const surroundUV = surroundGeometry.attributes.uv;
        for (let i = 0; i < surroundUV.count; i++) surroundUV.setXY(i, (surroundUV.getX(i) + 28) / 56, (surroundUV.getY(i) + 28) / 56);
        const distantMaterial = groundMat.clone(); distantMaterial.vertexColors = false;
        const distantGround = this.mesh(surroundGeometry, distantMaterial, [0, -.03, 0]);
        distantGround.rotation.x = -Math.PI / 2; distantGround.castShadow = false;
        this.originalGround = groundGeometry.attributes.position.array.slice();
        this.buildExcavator(s); this.buildTruck(s); this.buildSite(s); this.buildCrew();
        this.crewLabels.push(this.crewLabel(this.upper, 'operator', 2.7));
        this.updateGround(s);
        this.updateProjectScene(s); this.setCamera('site'); this.resize();
        this.render(s, 0);
        try {
            const texture = await this.textureLoader.loadAsync('/assets/jobsite/' + s.region.biome + '.jpg');
            if (token !== this.changeToken) { texture.dispose(); return; }
            texture.mapping = THREE.EquirectangularReflectionMapping; texture.colorSpace = THREE.SRGBColorSpace;
            this.skyTexture = texture; this.scene.background = texture;
            this.environment = this.environmentGenerator.fromEquirectangular(texture);
            this.scene.environment = this.environment.texture;
            this.scene.environmentIntensity = .65;
            const gravel = await this.textureLoader.loadAsync('/assets/jobsite/ground.jpg');
            if (token !== this.changeToken) { gravel.dispose(); return; }
            gravel.colorSpace = THREE.SRGBColorSpace; gravel.wrapS = gravel.wrapT = THREE.RepeatWrapping; gravel.repeat.set(20, 20);
            gravel.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
            groundMat.map = gravel; groundMat.bumpMap = gravel; groundMat.bumpScale = .18;
            groundMat.color.set({mountain:'#dbceba', forest:'#9d9581', desert:'#edce97', volcanic:'#727576'}[s.region.biome]);
            groundMat.needsUpdate = true;
            distantMaterial.map = gravel; distantMaterial.bumpMap = gravel; distantMaterial.color.copy(groundMat.color); distantMaterial.needsUpdate = true; tex.dispose();
            const looseGravel = gravel.clone(); looseGravel.repeat.set(2, 2);
            this.dirtMaterial.map = looseGravel; this.dirtMaterial.bumpMap = looseGravel; this.dirtMaterial.bumpScale = .08; this.dirtMaterial.needsUpdate = true;
        } catch (_) {
            // Physical lighting and terrain remain playable if a panorama cannot load.
        }
        this.dirty = true;
    }
    buildExcavator(s) {
        const machine = this.machine = new THREE.Group(); this.root.add(machine); machine.scale.setScalar(s.fleet.scale);
        const width = s.fleet.width;
        for (const z of [-1.27 * width, 1.27 * width]) {
            this.box([3.85, .68, .6 * width], [0, .68, z], this.rubber, machine, true);
            for (const end of [-1.95, 1.95]) {
                const wheel = this.cylinder(.57, .57, .62 * width, [end, .68, z], this.rubber, machine, 24); wheel.rotation.x = Math.PI / 2;
                const hub = this.cylinder(.35, .35, .65 * width, [end, .68, z], this.steel, machine, 20); hub.rotation.x = Math.PI / 2;
            }
            for (let i = 0; i < 7; i++) { const roller = this.cylinder(.32, .32, .64 * width, [-1.5 + i * .5, .58, z], this.steel, machine); roller.rotation.x = Math.PI / 2; }
            const shoeGeo = new THREE.BoxGeometry(.17, .1, .78 * width), shoes = new THREE.InstancedMesh(shoeGeo, this.steel, 76);
            const transform = new THREE.Object3D();
            for (let i = 0; i < 76; i++) {
                const angle = i / 76 * Math.PI * 2;
                transform.position.set(Math.cos(angle) * 2.35, .68 + Math.sin(angle) * .57, z);
                transform.rotation.z = Math.atan2(.57 * Math.cos(angle), -2.35 * Math.sin(angle)); transform.updateMatrix(); shoes.setMatrixAt(i, transform.matrix);
            }
            shoes.castShadow = true; shoes.receiveShadow = true; machine.add(shoes);
        }
        this.box([2.8, .45, 2.55 * width], [0, 1.16, 0], this.steel, machine, true);
        this.cylinder(.86, .92, .24, [0, 1.5, 0], this.steel, machine, 32);
        const upper = this.upper = new THREE.Group(); upper.position.y = 1.6; machine.add(upper);
        this.box([3.7, .85, 2.4], [-.35, .5, 0], this.paint, upper, true);
        this.box([1.15, 1.04, 2.45], [-1.65, .48, 0], this.paint, upper, true);
        this.box([1.7, .5, 1.55], [-.9, 1.04, -.45], this.paint, upper, true);
        for (let i = 0; i < 9; i++) this.box([.035, .44, 1.25], [-1.52 + i * .09, 1.02, -.5], this.steel, upper);
        this.cylinder(.07, .08, .82, [-1.1, 1.71, -.75], this.steel, upper);
        this.box([1.34, 1.53, 1.04], [.6, 1.43, .75], this.glass, upper, true);
        this.box([1.48, .12, 1.18], [.6, 2.26, .75], this.paint, upper, true);
        for (const x of [-.03, 1.22]) for (const z of [.23, 1.24]) this.box([.07, 1.6, .07], [x, 1.43, z], this.paint, upper);
        this.box([1.32, .06, .06], [.6, 1.65, 1.3], this.paint, upper);
        this.box([.1, .05, .25], [.93, 1.17, 1.31], this.steel, upper);
        this.box([.45, .47, .48], [.23, 1.21, .7], this.rubber, upper);
        this.box([.1, .3, 1.2], [1.31, .45, .75], this.steel, upper);
        for (let i = 0; i < 3; i++) this.box([.4, .06, .2], [.1, .03 - i * .18, 1.31 + i * .07], this.steel, upper);
        const decalMat = new THREE.MeshBasicMaterial({ map: this.label('openmud') });
        this.mesh(new THREE.PlaneGeometry(1.35, .34), decalMat, [-1.2, .5, 1.236], upper);
        const beacon = this.cylinder(.11, .11, .16, [.5, 2.41, .6], this.material('#ef9e38', .2, .25, { emissive: '#ca6714', emissiveIntensity: .3 }), upper);
        beacon.castShadow = false;
        this.arm = new THREE.Group(); this.arm.position.set(.65, .65, -.38); upper.add(this.arm);
        this.boom = this.box([1, .45, .44], [0, 0, 0], this.paint, this.arm, true);
        this.stick = this.box([1, .29, .34], [0, 0, 0], this.paint, this.arm, true);
        this.hydraulic = this.rod(v(0, 0, 0), v(1, 1, 0), .085, this.steel, this.arm);
        this.piston = this.rod(v(0, 0, 0), v(1, 1, 0), .045, this.chrome, this.arm);
        this.stickCylinder = this.rod(v(0, 0, 0), v(1, 1, 0), .065, this.chrome, this.arm);
        this.pins = [0, 1, 2].map(() => { const m = this.cylinder(.16, .16, .58, [0, 0, 0], this.steel, this.arm); m.rotation.x = Math.PI / 2; return m; });
        this.bucketGroup = new THREE.Group(); this.arm.add(this.bucketGroup);
        // A backhoe bucket opens toward the cab; the teeth pull through the cut.
        const bucketShell = new THREE.Group(); bucketShell.rotation.y = Math.PI; this.bucketGroup.add(bucketShell);
        const shape = new THREE.Shape(); shape.moveTo(-.45, .15); shape.lineTo(.25, .1); shape.lineTo(.6, -.45); shape.lineTo(.35, -.82); shape.quadraticCurveTo(-.5, -.85, -.55, -.3); shape.closePath();
        const bucketWidth = s.fleetId === 'quarry' ? .95 : s.region.biome === 'desert' ? 1.5 : 1.15;
        for (const z of [-bucketWidth / 2, bucketWidth / 2]) {
            const geom = new THREE.ExtrudeGeometry(shape, { depth: .07, bevelEnabled: true, bevelThickness: .015, bevelSize: .015, bevelSegments: 1, steps: 1 });
            this.mesh(geom, this.steel, [0, 0, z], bucketShell);
        }
        this.box([.75, .1, bucketWidth], [-.08, -.72, 0], this.steel, bucketShell);
        this.box([.12, .72, bucketWidth], [-.47, -.26, 0], this.steel, bucketShell);
        for (let i = 0; i < 5; i++) { const tooth = this.mesh(new THREE.ConeGeometry(.095, .36, 4), this.chrome, [.56, -.68, -.45 + i * .23], bucketShell); tooth.rotation.z = -Math.PI / 2; }
        this.bucketLoad = this.mesh(new THREE.SphereGeometry(.5, 12, 8), this.dirtMaterial, [0, -.3, 0], bucketShell); this.bucketLoad.scale.set(.9, .55, bucketWidth);
    }
    buildTruck(s) {
        const truck = this.truck = new THREE.Group(); truck.position.set(.25, 0, -6); this.root.add(truck);
        const offroad = s.fleet.truckType !== 'highway';
        const bodyMat = offroad ? this.paint : this.material('#dddcd2', .4, .36);
        const bedMat = this.material(offroad ? '#bda459' : '#a2a99c', .48, .65);
        this.box([7.3, .35, 2.15], [.1, 1.05, 0], this.steel, truck, true);
        const wheelR = offroad ? .85 : .61;
        for (const x of [-2.3, -.7, 2.7]) for (const z of [-1.28, 1.28]) {
            const tire = this.cylinder(wheelR, wheelR, .52, [x, wheelR, z], this.rubber, truck, 24); tire.rotation.x = Math.PI / 2;
            const hub = this.cylinder(wheelR * .5, wheelR * .5, .55, [x, wheelR, z], this.steel, truck, 20); hub.rotation.x = Math.PI / 2;
            for (let i = 0; i < 12; i++) {
                const a = i * Math.PI / 6, lug = this.box([.16, .1, .56], [x + Math.sin(a) * wheelR, wheelR + Math.cos(a) * wheelR, z], this.rubber, truck); lug.rotation.z = -a;
            }
        }
        this.box([1.6, 1.8, 2.2], [2.65, 2.15, 0], bodyMat, truck, true);
        this.box([.07, .65, 1.91], [3.51, 2.51, 0], this.glass, truck);
        for (const z of [-1.115, 1.115]) {
            this.box([1.19, .69, .025], [2.66, 2.55, z], this.glass, truck);
            this.box([.26, .05, .035], [2.29, 1.95, z], this.steel, truck);
            this.rod(v(3.15, 2.78, z), v(3.4, 2.85, z * 1.25), .025, this.steel, truck);
        }
        if (offroad) this.box([1.1, .65, 1.75], [3.7, 1.9, 0], bodyMat, truck, true);
        this.box([.1, .43, 1.1], [offroad ? 4.31 : 3.52, 1.78, 0], this.steel, truck);
        for (const z of [-.88, .88]) this.box([.1, .16, .3], [offroad ? 4.31 : 3.52, 1.98, z], this.material('#fff1c7', .1, .2, { emissive: '#ffe8ac', emissiveIntensity: .6 }), truck);
        this.box([.2, .22, 2.4], [offroad ? 4.37 : 3.6, 1.3, 0], this.chrome, truck);
        this.bed = new THREE.Group(); truck.add(this.bed);
        this.box([4.5, .16, 2.45], [-.65, 1.62, 0], bedMat, this.bed);
        for (const z of [-1.25, 1.25]) {
            this.box([4.6, 1.35, .12], [-.65, 2.27, z], bedMat, this.bed);
            for (let i = 0; i < 6; i++) this.box([.075, 1.37, .075], [-2.63 + i * .79, 2.27, z * 1.07], this.steel, this.bed);
            this.box([4.7, .09, .19], [-.65, 2.98, z], this.chrome, this.bed);
        }
        for (const x of [-2.91, 1.63]) this.box([.1, 1.35, 2.5], [x, 2.27, 0], bedMat, this.bed);
        this.truckLoad = this.mesh(new THREE.SphereGeometry(1, 20, 12), this.dirtMaterial, [-.65, 1.65, 0], this.bed);
        this.truckLoad.scale.set(2.12, .1, 1.18);
    }
    buildSite(s) {
        if (s.region.biome === 'forest') {
            const water = this.material('#7c8983', .45, .13, { transparent: true, opacity: .65 });
            for (const [x, z, sx, sz] of [[-6, 4, 2.3, .8], [9, 7, 1.8, .7], [-5, -10, 1.4, .8]]) {
                const puddle = this.mesh(new THREE.CircleGeometry(1, 40), water, [x, .009, z]);
                puddle.rotation.x = -Math.PI / 2; puddle.scale.set(sx, sz, 1); puddle.castShadow = false;
            }
        }
        const pipeMat = this.material('#556a59', .15, .72);
        for (const stock of s.stockpiles) for (let layer = 0; layer < 2; layer++) {
            const pipe = this.mesh(new THREE.CylinderGeometry(stock.radius, stock.radius, stock.length, 20, 1, true), pipeMat, [stock.x, .5 + layer * .8, stock.z], this.root);
            pipe.quaternion.setFromUnitVectors(v(0, 1, 0), v(Math.cos(stock.heading), 0, -Math.sin(stock.heading)));
        }
        const coneMat = this.material('#d67931', .03, .82), white = this.material('#e5debd');
        for (let i = 0; i < 8; i++) {
            const x = -4 + i * 1.8;
            this.box([.45, .07, .45], [x, .06, 4.7], this.rubber);
            this.cylinder(.04, .17, .57, [x, .38, 4.7], coneMat);
            this.cylinder(.095, .115, .09, [x, .39, 4.7], white);
        }
        const stake = this.material('#ad9770');
        for (const z of [-3.8, 3.8]) for (let i = 0; i < 5; i++) {
            this.box([.04, .8, .04], [3.4 + i * 1.6, .4, z], stake);
            this.box([.3, .16, .02], [3.53 + i * 1.6, .72, z], coneMat);
        }
        const trailer = new THREE.Group(); trailer.position.set(-12, 0, -18); this.root.add(trailer);
        this.box([6, 2.4, 2.6], [0, 1.5, 0], this.material('#c8cbc0', .3, .65), trailer);
        this.box([6.2, .12, 2.8], [0, 2.77, 0], this.material('#6e7972', .5, .4), trailer);
        for (const x of [-1.6, .4]) this.box([1.2, .8, .04], [x, 1.8, 1.32], this.glass, trailer);
        this.box([.8, 2, .06], [2, 1.45, 1.33], this.material('#829087'), trailer);
        const rockGeo = new THREE.DodecahedronGeometry(1, 0), rockMat = this.material(s.region.biome === 'volcanic' ? '#3e4240' : '#827c68', .03, .95);
        const rocks = new THREE.InstancedMesh(rockGeo, rockMat, 150), transform = new THREE.Object3D();
        let seed = 211; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
        for (let i = 0; i < 150; i++) { const x = (rnd() - .5) * 56, z = (rnd() - .5) * 56; transform.position.set(x, .07, z); const scale = .05 + rnd() * .2; transform.scale.set(scale, scale * .7, scale); transform.rotation.set(rnd(), rnd(), rnd()); transform.updateMatrix(); rocks.setMatrixAt(i, transform.matrix); }
        rocks.receiveShadow = true; rocks.castShadow = true; this.root.add(rocks);
        for (let side = 0; side < 2; side++) {
            const marks = new THREE.InstancedMesh(new THREE.BoxGeometry(.12, .012, .6), this.material('#544c3c', 0, 1), 60);
            for (let i = 0; i < 60; i++) { transform.position.set(-14 + i * .25, .012, 1.5 + side * 1.8); transform.scale.set(1, 1, 1); transform.rotation.set(0, .07, 0); transform.updateMatrix(); marks.setMatrixAt(i, transform.matrix); } this.root.add(marks);
        }
        this.particles = [];
        for (let i = 0; i < 24; i++) { const m = this.mesh(new THREE.DodecahedronGeometry(.06), this.dirtMaterial, [0, -10, 0]); this.particles.push(m); }
    }
    buildCrew() {
        this.buildProjectTools();
        this.crewLabels = [];
        this.utilitiesGroup = new THREE.Group(); this.root.add(this.utilitiesGroup);
        this.utilityRef = null; this.utilityCount = -1; this.pendingPipe = null;
        this.pipeMaterial = this.material('#526f67', .35, .45, { side: THREE.DoubleSide });
        this.pipeInner = this.material('#253b34', .1, .8, { side: THREE.BackSide });
        this.jointMaterial = this.material('#d2a64b', .45, .45);
        const vest = this.material('#e7882b', .05, .8), cloth = this.material('#344c54'), skin = this.material('#b08a68'), tape = this.material('#e9dd89');
        this.crew = [];
        for (let i = 0; i < 3; i++) {
            const person = new THREE.Group(); this.root.add(person);
            this.box([.34, .58, .25], [0, 1.02, 0], vest, person, true);
            this.box([.36, .07, .27], [0, .93, 0], tape, person);
            for (const x of [-.1, .1]) {
                this.cylinder(.067, .06, .66, [x, .43, 0], cloth, person, 10);
                this.box([.15, .13, .25], [x, .08, .04], this.rubber, person, true);
            }
            this.mesh(new THREE.SphereGeometry(.13, 12, 8), skin, [0, 1.45, 0], person);
            this.mesh(new THREE.SphereGeometry(.16, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), tape, [0, 1.5, 0], person);
            this.cylinder(.2, .2, .025, [0, 1.5, 0], tape, person);
            const arms = [-1, 1].map(side => this.rod(v(side * .2, 1.26, 0), v(side * .28, .8, .14), .055, cloth, person));
            person.position.set(-2 - i * .75, 0, 3.3); this.crew.push({ person, arms, home: person.position.clone() });
            this.crewLabels.push(this.crewLabel(person, ['foreman', 'laborer', 'joiner'][i], 1.95));
        }
    }
    buildProjectTools() {
        this.projectMarks = new THREE.Group(); this.root.add(this.projectMarks); this.projectRef = null;
        const steel = this.material('#66716b', .55, .6), yellow = this.material('#dba638', .2, .6), gravel = this.material('#b5b09b', .05, 1);
        this.compactor = new THREE.Group(); this.root.add(this.compactor);
        this.box([.6, .08, .85], [0, .06, 0], steel, this.compactor, true);
        this.box([.35, .26, .38], [0, .23, 0], yellow, this.compactor, true);
        for (const side of [-1, 1]) this.rod(v(side * .22, .18, .2), v(side * .22, .9, .65), .025, steel, this.compactor);
        this.rod(v(-.22, .9, .65), v(.22, .9, .65), .03, this.rubber, this.compactor);
        this.tamper = new THREE.Group(); this.root.add(this.tamper);
        this.box([.2, .06, .2], [0, .03, 0], steel, this.tamper); this.cylinder(.025, .025, .95, [0, .52, 0], steel, this.tamper);
        this.rod(v(-.16, 1, 0), v(.16, 1, 0), .03, this.rubber, this.tamper);
        this.water = this.mesh(new THREE.PlaneGeometry(2, .85), this.material('#4a8187', .2, .2, { transparent: true, opacity: .55 }), [0, 0, 0]); this.water.rotation.x = -Math.PI / 2;
        this.aggregate = new THREE.Group(); this.root.add(this.aggregate);
        this.mesh(new THREE.ConeGeometry(1.2, .65, 16), gravel, [0, .325, 0], this.aggregate);
        this.supplyTruck = new THREE.Group(); this.root.add(this.supplyTruck);
        const white = this.material('#d4d5c7', .2, .65);
        this.box([4.3, .25, 1.7], [0, .8, 0], steel, this.supplyTruck, true);
        this.box([1.3, 1.4, 1.7], [2.6, 1.4, 0], white, this.supplyTruck, true);
        this.box([.02, .5, 1.4], [3.26, 1.7, 0], this.glass || steel, this.supplyTruck);
        for (const x of [-1.5, -.7, 2.5]) for (const z of [-.85, .85]) { const wheel = this.cylinder(.42, .42, .28, [x, .43, z], this.rubber, this.supplyTruck); wheel.rotation.x = Math.PI / 2; }
        for (let i = 0; i < 3; i++) this.box([1.5, .5, .45], [-.8, 1.2, (i - 1) * .5], gravel, this.supplyTruck);
    }
    updateProjectScene(s) {
        const project = s.project, section = Sim.projectSection(s), work = project?.work;
        this.projectMarks.visible = this.aggregate.visible = !!project;
        this.compactor.visible = work?.type === 'compact' && section.lift >= 2;
        this.tamper.visible = work?.type === 'compact' && section.lift < 2;
        this.water.visible = !!section && section.water > .03 && Sim.groundDepth(s, section.x, section.z) > .2;
        this.supplyTruck.visible = !!project?.delivery;
        if (!project) return;
        if (this.projectRef !== project) {
            this.projectMarks.traverse(object => { object.geometry?.dispose(); if (object.isSprite) { object.material.map?.dispose(); object.material.dispose(); } }); this.projectMarks.clear(); this.projectRef = project;
            const stake = this.material('#e4c68b', .05, .9);
            project.sections.forEach((p, i) => {
                this.box([.05, .8, .05], [p.x, .4, p.z + 1.1], stake, this.projectMarks);
                const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.label(i * 2 + '-' + (i * 2 + 2) + ' m', 128), depthTest: true }));
                sprite.position.set(p.x, 1.1, p.z + 1.1); sprite.scale.set(1.5, .4, 1); this.projectMarks.add(sprite);
            });
        }
        this.aggregate.position.set(project.sections[0].x + 3, 0, project.sections[0].z + 4);
        this.aggregate.scale.setScalar(Math.max(.25, Math.min(1.6, Math.cbrt((project.inventory.fill + project.inventory.bedding) / 4))));
        if (this.water.visible) this.water.position.set(section.x, -Sim.groundDepth(s, section.x, section.z) + section.water, section.z);
        if (work?.type === 'compact') {
            const progress = work.elapsed / work.duration, x = section.x + Math.sin(progress * Math.PI * 2) * .7;
            const tool = section.lift < 2 ? this.tamper : this.compactor, z = section.z + (section.lift < 2 ? .35 : 0);
            tool.position.set(x, -Sim.groundDepth(s, x, z) + Math.sin(this.frame * 60) * .015, z); tool.rotation.y = Math.PI / 2;
        }
        if (project.delivery) this.supplyTruck.position.set(project.sections[0].x + 5 + 25 * (1 - Math.min(1, project.delivery.elapsed / project.delivery.duration * 1.5)), 0, project.sections[0].z + 7);
    }
    makePipe(target, parent = this.utilitiesGroup) {
        const group = new THREE.Group(); parent.add(group);
        const axis = v(Math.cos(target.heading), 0, -Math.sin(target.heading));
        for (const [radius, material] of [[.18, this.pipeMaterial], [.145, this.pipeInner]]) {
            const tube = this.mesh(new THREE.CylinderGeometry(radius, radius, 2, 24, 1, true), material, [0, 0, 0], group);
            tube.quaternion.setFromUnitVectors(v(0, 1, 0), axis);
        }
        for (const end of [-1, 1]) {
            const rim = this.mesh(new THREE.TorusGeometry(.163, .018, 8, 24), this.pipeMaterial, [axis.x * end, 0, axis.z * end], group);
            rim.quaternion.setFromUnitVectors(v(0, 0, 1), axis);
        }
        group.position.set(target.x, target.y, target.z); return group;
    }
    updateCrew(s, dt) {
        for (const label of this.crewLabels) {
            const level = Sim.crewLevel(s, label.role);
            if (label.level !== level) { label.sprite.material.map.dispose(); label.sprite.material.map = this.label(Sim.crewTag(s, label.role), label.role === 'operator' ? 256 : 96); label.level = level; }
        }
        const count = s.utilities.pipes.length + ':' + s.utilities.joints.length;
        if (this.utilityRef !== s.utilities || this.utilityCount !== count) {
            this.utilitiesGroup.traverse(object => object.geometry?.dispose()); this.utilitiesGroup.clear();
            this.utilityRef = s.utilities; this.utilityCount = count;
            s.utilities.pipes.forEach(pipe => this.makePipe(pipe));
            for (const joint of s.utilities.joints) {
                const collar = this.cylinder(.215, .215, .22, [joint.x, joint.y, joint.z], this.jointMaterial, this.utilitiesGroup, 24);
                collar.quaternion.setFromUnitVectors(v(0, 1, 0), v(Math.cos(joint.heading), 0, -Math.sin(joint.heading)));
            }
        }
        const work = s.utilities.work || s.project?.work;
        if (work?.type === 'install' || work?.type === 'pipe') {
            if (!this.pendingPipe) this.pendingPipe = this.makePipe(work.target, this.root);
            this.pendingPipe.position.y = .85 + (work.target.y - .85) * ease(work.elapsed / (work.duration || 3));
        } else if (this.pendingPipe) {
            this.pendingPipe.traverse(object => object.geometry?.dispose()); this.root.remove(this.pendingPipe); this.pendingPipe = null;
        }
        for (let i = 0; i < this.crew.length; i++) {
            const { person, arms } = this.crew[i], position = s.crew[i];
            person.position.set(position.x, -Sim.groundDepth(s, position.x, position.z), position.z);
            if (work) person.rotation.y = work.target.heading + Math.PI;
            arms.forEach((arm, j) => {
                const side = j ? 1 : -1, reach = work ? .42 : .14;
                this.placeRod(arm, v(side * .2, 1.26, 0), v(side * .23, work ? .86 + Math.sin(this.frame * 5 + i) * .04 : .8, reach));
            });
        }
    }
    updateGround(s) {
        if (this.terrainRef === s.terrain && this.lastTerrainRevision === s.terrain.revision) return;
        const dirtyCells = s.project?.work?.cells.length ? s.project.work.cells : s.cut?.cells;
        const full = this.terrainRef !== s.terrain || !dirtyCells;
        this.terrainRef = s.terrain; this.lastTerrainRevision = s.terrain.revision;
        const { position: pos, color: colors, normal } = this.ground.geometry.attributes;
        const indices = full ? Array.from({ length: pos.count }, (_, i) => i) : dirtyCells.map(cell => cell.index);
        const normals = new Set(), row = Sim.TERRAIN.segments + 1, spacing = Sim.TERRAIN.size / Sim.TERRAIN.segments;
        let first = pos.count, end = 0;
        for (const i of indices) {
            const x = this.originalGround[i * 3], z = this.originalGround[i * 3 + 2], depth = s.terrain.depths[i];
            pos.setY(i, -depth + Math.sin(x * 3.3) * Math.cos(z * 4) * .018);
            const exposed = Math.min(1, depth * 5), strata = .04 * Math.sin(depth * 23);
            const restored = s.project?.sections.some(p => (p.bedded || s.project.work?.type === 'bedding' && s.project.active === s.project.sections.indexOf(p)) && Math.abs(x - p.x) < Math.max(1.42, 1.3 * s.fleet.scale) && Math.abs(z - p.z) < .78 * s.fleet.scale);
            if (restored) colors.setXYZ(i, .85, .88, .81);
            else colors.setXYZ(i, 1 - exposed * (.4 + strata), 1 - exposed * (.5 + strata), 1 - exposed * (.59 + strata));
            for (const j of [i, i - 1, i + 1, i - row, i + row]) if (j >= 0 && j < pos.count) normals.add(j);
            first = Math.min(first, i); end = Math.max(end, i);
        }
        for (const i of normals) {
            const x = i % row, z = Math.floor(i / row);
            const nx = pos.getY(i - (x > 0 ? 1 : 0)) - pos.getY(i + (x < row - 1 ? 1 : 0));
            const nz = pos.getY(i - (z > 0 ? row : 0)) - pos.getY(i + (z < row - 1 ? row : 0));
            const ny = spacing * 2, length = Math.hypot(nx, ny, nz);
            normal.setXYZ(i, nx / length, ny / length, nz / length);
        }
        if (indices.length) {
            for (const attribute of [pos, colors]) { attribute.addUpdateRange(first * 3, (end - first + 1) * 3); attribute.needsUpdate = true; }
            const start = Math.max(0, first - row), stop = Math.min(pos.count - 1, end + row);
            normal.addUpdateRange(start * 3, (stop - start + 1) * 3); normal.needsUpdate = true;
        }
        this.dirtMaterial.color.set(Sim.soil(s).color);
        this.dirty = true;
    }
    beam(m, a, b) {
        m.position.copy(a).add(b).multiplyScalar(.5);
        m.rotation.z = Math.atan2(b.y - a.y, b.x - a.x);
        m.scale.x = a.distanceTo(b);
    }
    updatePlan(s) {
        if (this.planLines) this.planLines.visible = s.planVisible;
        if (!s.planVisible) return;
        const revision = s.terrain.revision + ':' + s.utilities.pipes.length;
        if (this.planRef === s.plan && this.planRevision === revision && this.planLines) return;
        this.planRef = s.plan; this.planRevision = revision;
        const points = [], colors = [], c = Math.cos(s.plan.heading), sn = Math.sin(s.plan.heading);
        for (const section of Sim.planSections(s)) {
            const color = new THREE.Color(section.installed ? '#7ae0ac' : section.ready ? '#ffe29a' : '#9edaf1');
            const corners = [[-1,-s.plan.width/2],[1,-s.plan.width/2],[1,s.plan.width/2],[-1,s.plan.width/2]];
            for (let i = 0; i < 4; i++) for (const [along, across] of [corners[i], corners[(i + 1) % 4]]) {
                points.push(v(section.x + along * c + across * sn, .06, section.z - along * sn + across * c));
                colors.push(color.r, color.g, color.b);
            }
        }
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        if (this.planLines) { this.planLines.geometry.dispose(); this.planLines.geometry = geometry; }
        else {
            this.planLines = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ vertexColors: true, depthTest: false, transparent: true, opacity: .95 }));
            this.planLines.renderOrder = 8; this.root.add(this.planLines);
        }
        this.dirty = true;
    }
    render(s, dt) {
        if (!this.root || !this.upper) return;
        this.updatePlan(s);
        this.controls.update();
        if (s.status !== 'playing' && !this.dirty && this.terrainRef === s.terrain) return;
        const started = performance.now();
        this.frame += s.status === 'playing' ? dt : 0;
        this.updateGround(s);
        this.updateProjectScene(s);
        let swing = 0;
        if (s.phase === 'swinging') swing = ease(s.phaseTime / .8);
        else if (s.phase === 'dumping') swing = 1;
        else if (s.phase === 'returning') swing = 1 - ease(s.phaseTime / .65);
        this.state = s;
        this.machine.position.set(s.machine.x, 0, s.machine.z); this.machine.rotation.y = s.machine.heading;
        const anchor = v(s.machine.x, 0, s.machine.z), travel = anchor.clone().sub(this.cameraAnchor);
        this.camera.position.add(travel); this.controls.target.add(travel); this.cameraAnchor.copy(anchor);
        this.upper.rotation.y = swing * 1.7 * -s.haulSide;
        const t = s.phase === 'digging' ? Math.min(1, s.phaseTime / Sim.digDuration(s)) : 0;
        let toolX = s.bucket > 0 ? 4.6 : 6, toolY = s.bucket > 0 ? 1.2 : .3, curl = s.bucket > 0 ? -.95 : .05;
        if (s.phase === 'digging') {
            const entry = ease(t / .25), pull = ease((t - .25) / .45), lift = ease((t - .65) / .35);
            toolX = 6 - 1.7 * pull + .3 * lift;
            toolY = .3 - entry * (.6 + (s.cut?.depth || 0) / s.fleet.scale) + lift * (1.5 + (s.cut?.depth || 0) / s.fleet.scale);
            curl = .05 - pull;
        }
        toolX += (5.75 - toolX) * swing; toolY += (3.55 / s.fleet.scale - toolY) * swing;
        if (s.phase === 'dumping') curl += ease(s.phaseTime / .45) * 1.8;
        if (s.phase === 'returning') curl = .85 - ease(s.phaseTime / .65) * 1.8;
        const bucketScale = s.upgrades.bucket ? 1.16 : 1;
        const tipX = (-.74 * Math.cos(curl) + .68 * Math.sin(curl)) * bucketScale;
        const tipY = (-.74 * Math.sin(curl) - .68 * Math.cos(curl)) * bucketScale;
        const a = v(0, 0, 0), c = v(toolX - .65 - tipX, toolY - 2.25 - tipY, 0);
        const distance = c.length(), mid = distance / 2, rise = Math.sqrt(Math.max(.05, 3.9 ** 2 - mid ** 2));
        const b = v(c.x / 2 - c.y / distance * rise, c.y / 2 + c.x / distance * rise, 0);
        this.beam(this.boom, a, b); this.beam(this.stick, b, c);
        this.pins[0].position.copy(a); this.pins[1].position.copy(b); this.pins[2].position.copy(c);
        const cylinderEnd = b.clone().multiplyScalar(.65).add(v(0, -.16, .29));
        this.placeRod(this.hydraulic, v(.08, -.15, .29), cylinderEnd);
        this.placeRod(this.piston, cylinderEnd, b.clone().add(v(.1, -.1, .29)));
        this.placeRod(this.stickCylinder, b.clone().add(v(.1, .18, .23)), c.clone().lerp(b, .34).add(v(.15, .08, .23)));
        this.bucketGroup.position.copy(c); this.bucketGroup.rotation.z = curl;
        this.bucketGroup.scale.setScalar(bucketScale);
        this.bucketLoad.visible = s.bucket > 0 || (s.phase === 'digging' && t > .3);
        this.truck.position.set(s.truckPose.x, 0, s.truckPose.z);
        const turn = Math.atan2(Math.sin(s.truckHeading - this.truck.rotation.y), Math.cos(s.truckHeading - this.truck.rotation.y));
        this.truck.rotation.y += turn * Math.min(1, dt * 8);
        this.truckLoad.visible = s.truck > 0;
        this.truckLoad.scale.y = Math.max(.05, s.truck / s.fleet.capacity * 1.38);
        this.truckLoad.position.y = 1.65 + s.truck / s.fleet.capacity * .35;
        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i], active = s.phase === 'dumping' || s.phase === 'digging';
            p.visible = active;
            if (active) {
                const age = (s.phaseTime * 1.7 + i / this.particles.length) % 1;
                this.bucketGroup.updateWorldMatrix(true, false);
                const origin = this.bucketGroup.localToWorld(v(-.4, -.4, 0));
                p.position.set(origin.x + Math.sin(i * 17) * .3, origin.y - age * 1.4, origin.z + Math.cos(i * 13) * .35);
            }
        }
        this.updateCrew(s, s.status === 'playing' ? dt : 0);
        this.renderer.render(this.scene, this.camera); this.dirty = false;
        this.renderMs = this.renderMs ? this.renderMs * .95 + (performance.now() - started) * .05 : performance.now() - started;
        this.renderCount++;
    }
}
