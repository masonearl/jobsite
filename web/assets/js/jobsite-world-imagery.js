import * as THREE from 'three';
import { visibleTiles, tileBounds, tileKey, tileURL, CACHE_LIMIT } from './jobsite-world-tiles.mjs';

export class WorldImagery {
    constructor(scene, renderer, material, canvas, load = null) {
        this.scene = scene; this.renderer = renderer; this.material = material; this.canvas = canvas;
        this.cache = new Map(); this.pending = new Map(); this.failed = new Map(); this.wanted = new Set();
        this.load = load || ((tile, signal) => this.loadTexture(tile, signal));
        this.last = -Infinity; this.closed = false;
    }
    async loadTexture(tile, signal) {
        const response = await fetch(tileURL(tile), { signal, credentials: 'omit' });
        if (!response.ok) throw Error('Terrain detail unavailable');
        const bitmap = await createImageBitmap(await response.blob(), { imageOrientation: 'flipY', premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
        const texture = new THREE.Texture(bitmap); texture.flipY = false; texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy()); texture.needsUpdate = true;
        return texture;
    }
    mesh(tile, texture) {
        const b = tileBounds(tile), rad = Math.PI / 180;
        const geometry = new THREE.SphereGeometry(1.0005 + tile.level * .00003, Math.max(4, Math.ceil((b.east - b.west) / 1.5)), Math.max(4, Math.ceil((b.north - b.south) / 1.5)), (b.west + 180) * rad, (b.east - b.west) * rad, (90 - b.north) * rad, (b.north - b.south) * rad);
        // GIBS' southernmost low-level tiles extend beyond the pole; retain only their geographic portion.
        texture.repeat.set((b.east - b.west) / b.span, (b.north - b.south) / b.span); texture.offset.y = 1 - texture.repeat.y;
        const material = this.material.clone(); material.map = texture;
        const mesh = new THREE.Mesh(geometry, material); mesh.renderOrder = tile.level; this.scene.add(mesh); return mesh;
    }
    discard(entry) {
        this.scene.remove(entry.mesh); entry.mesh.geometry.dispose(); entry.mesh.material.dispose();
        entry.texture.dispose(); entry.texture.image.close?.();
    }
    update(view, width, height, pixelRatio, now = performance.now()) {
        if (this.closed || now - this.last < 200) return; this.last = now;
        const tiles = visibleTiles(view, width, height, pixelRatio); this.wanted = new Set(tiles.map(tileKey));
        const retain = new Set(this.wanted);
        for (const tile of tiles) for (let level = tile.level - 1; level >= 2; level--) {
            const divisor = 2 ** (tile.level - level); retain.add(tileKey({ level, row: Math.floor(tile.row / divisor), col: Math.floor(tile.col / divisor) }));
        }
        for (const [key, controller] of this.pending) if (!this.wanted.has(key)) controller.abort();
        for (const [key, entry] of this.cache) { entry.mesh.visible = retain.has(key); if (entry.mesh.visible) entry.used = now; }
        for (const [key, retryAt] of this.failed) if (now > retryAt) this.failed.delete(key);
        for (const tile of tiles) {
            const key = tileKey(tile); if (this.pending.size >= 4) break;
            if (this.cache.has(key) || this.pending.has(key) || this.failed.has(key)) continue;
            const controller = new AbortController(); this.pending.set(key, controller);
            const timeout = setTimeout(() => controller.abort(), 12000);
            this.load(tile, controller.signal).then(texture => {
                if (this.closed || !this.wanted.has(key)) { texture.dispose(); texture.image.close?.(); return; }
                this.cache.set(key, { texture, mesh: this.mesh(tile, texture), used: performance.now() });
                this.trim();
            }).catch(() => { if (!this.closed && this.wanted.has(key)) this.failed.set(key, performance.now() + 60000); })
                .finally(() => { clearTimeout(timeout); this.pending.delete(key); });
        }
        this.trim();
        this.canvas.dataset.detailTiles = [...this.wanted].filter(key => this.cache.has(key)).length;
        this.canvas.dataset.detailWanted = tiles.length;
        this.canvas.dataset.detailLevel = tiles[0]?.level || 0;
        this.canvas.dataset.detailCache = this.cache.size;
        this.canvas.dataset.detailState = !tiles.length ? 'overview' : [...this.wanted].every(key => this.cache.has(key)) ? 'ready' : [...this.wanted].some(key => this.failed.has(key)) ? 'fallback' : 'loading';
    }
    trim() {
        const oldest = [...this.cache.entries()].filter(([key]) => !this.wanted.has(key)).sort((a, b) => a[1].used - b[1].used);
        while (this.cache.size > CACHE_LIMIT && oldest.length) { const [key, entry] = oldest.shift(); this.discard(entry); this.cache.delete(key); }
    }
    dispose() {
        this.closed = true; for (const controller of this.pending.values()) controller.abort();
        for (const entry of this.cache.values()) this.discard(entry); this.cache.clear();
    }
}
