import * as THREE from 'three';
import { OutlineEffect } from 'three/addons/OutlineEffect.js';
import { loadBody } from './body.js';
import { Avatar } from './avatar.js';
import { Outfit } from './outfit.js';

// Wardrobe card pictures: each item is put on a second, hidden mannequin in
// its rest pose, photographed once, and cached as a data URL. Work is queued
// so the wardrobe stays responsive; `onReady` fires as pictures arrive.

const FRAMES = { // camera target joint, framing height, eye offset
  hair: ['head', 0.42, [0.35, 0.05, 1]],
  acc: ['head', 0.3, [0.5, 0.25, 1]],
  top: ['spine_03', 0.55, [0.3, 0.05, 1]],
  bottom: ['thigh_l', 0.7, [0.3, 0.05, 1], -0.089],
  shoes: ['calf_l', 0.5, [0.6, 0.25, 1], -0.13, -0.24],
};

export class Thumbnailer {
  constructor(size = 160) {
    this.size = size;
    this.cache = new Map();
    this.queue = [];
    this.pending = new Set();
    this.onReady = () => {};
  }

  async _init() {
    this.ready ??= (async () => {
      const canvas = document.createElement('canvas');
      this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
      this.renderer.setSize(this.size, this.size, false);
      this.effect = new OutlineEffect(this.renderer, { defaultThickness: 0.004 });
      this.scene = new THREE.Scene();
      this.scene.add(new THREE.HemisphereLight('#ffffff', '#c9a0b8', 1.9));
      const key = new THREE.DirectionalLight('#ffffff', 2.0);
      key.position.set(1.5, 2, 3);
      this.scene.add(key);
      this.camera = new THREE.PerspectiveCamera(24, 1, 0.01, 20);
      this.body = await loadBody();
      this.avatar = new Avatar(this.body);
      this.outfit = new Outfit(this.avatar);
      this.scene.add(this.body.root);
      // Arms down a little so tops read clearly.
      for (const [b, z] of [['upperarm_l', -0.45], ['upperarm_r', 0.45]]) this.body.bone[b].rotation.z = z;
    })();
    return this.ready;
  }

  key(slot, id, look) { return `${slot}:${id}:${slot === 'hair' ? look.hairColor : ''}`; }

  get(slot, id, look = {}) {
    const k = this.key(slot, id, look);
    if (this.cache.has(k)) return this.cache.get(k);
    if (!this.pending.has(k)) {
      this.pending.add(k);
      this.queue.push([k, slot, id, { ...look }]);
      this._pump();
    }
    return null;
  }

  async _pump() {
    if (this.busy) return;
    this.busy = true;
    await this._init();
    while (this.queue.length) {
      const [k, slot, id, look] = this.queue.shift();
      try { this.cache.set(k, this._shoot(slot, id, look)); } catch (e) { console.warn('thumbnail failed', k, e); }
      this.pending.delete(k);
      this.onReady(k);
      await new Promise((r) => setTimeout(r, 0));
    }
    this.busy = false;
  }

  _shoot(slot, id, look) {
    const o = this.outfit;
    for (const k of [...o.worn.keys()]) if (k !== 'under') o._remove(k);
    o.look.hairColor = look.hairColor ?? 'natural';
    o.look.acc = [];
    if (slot === 'acc' || slot === 'hair') o.set('hair', slot === 'hair' ? id : 'straight');
    if (slot !== 'hair') o.set(slot, id);
    const [joint, height, dir, dx = 0, dy = 0] = FRAMES[slot];
    const c = this.body.joint(joint).add(new THREE.Vector3(dx, dy, 0));
    if (slot === 'hair' || slot === 'acc') c.y += 0.04;
    const dist = height / 2 / Math.tan((this.camera.fov * Math.PI) / 360) * 1.1;
    this.camera.position.copy(c).addScaledVector(new THREE.Vector3(...dir).normalize(), dist);
    this.camera.lookAt(c);
    this.body.root.updateMatrixWorld(true);
    this.effect.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL('image/png');
  }
}
