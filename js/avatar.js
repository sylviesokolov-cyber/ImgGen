import * as THREE from 'three';
import { toon, canvasTexture } from './materials.js';
import { paintSkin, irisTexture } from './textures.js';

export const SKIN_TONES = ['#ffe6da', '#f9d6c3', '#efc0a2', '#d9a07a', '#a8714e', '#71472f'];
export const EYE_COLORS = ['#ff6fae', '#7a4cff', '#3aa7ff', '#2fbf8f', '#c0742e', '#e0383e'];

// The character: skin, anime eyes and lashes on top of the MakeHuman body.
export class Avatar {
  constructor(body) {
    this.body = body;
    this.root = body.root;
    this.skinHex = SKIN_TONES[1];
    this.eyeHex = EYE_COLORS[0];

    this.skinCanvas = document.createElement('canvas');
    this.skinCanvas.width = this.skinCanvas.height = 2048;
    this.skinMat = toon('#ffffff', { map: canvasTexture(this.skinCanvas), outline: 0.0025, ramp: [185, 185, 230, 255] });
    this.skin = body.mesh(body.geometry('body'), this.skinMat);
    this.skin.name = 'skin';
    this.root.add(this.skin);

    const lashMat = toon('#2a1720', { outline: 0, side: THREE.DoubleSide });
    this.lashes = body.mesh(body.geometry('lashes', { offset: 0.0006 }), lashMat);
    this.root.add(this.lashes);

    this.eyeMat = toon('#ffffff', { outline: 0, map: irisTexture(this.eyeHex) });
    this.eyes = {};
    for (const side of ['l', 'r']) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), this.eyeMat);
      this.bone('head').add(e);
      this.eyes[side] = e;
    }
    this._placeEyes();
    this.paint();
    body.onChange(() => this._placeEyes());
  }

  bone(name) { return this.body.bone[name]; }

  // Eyeballs sit behind the lid opening; they ride on the head bone, so only
  // their offset from the head joint matters.
  _placeEyes() {
    const lm = this.body.meta.landmarks, head = this.body.joint('head');
    const r = 0.0128;
    for (const side of ['l', 'r']) {
      const up = lm[side + '-upperlid'], lo = lm[side + '-lowerlid'];
      const c = new THREE.Vector3(up[0], (up[1] + lo[1]) / 2, up[2] - r * 0.8);
      this.eyes[side].position.copy(c.sub(head));
      this.eyes[side].scale.setScalar(r);
    }
  }

  setSkin(hex) { this.skinHex = hex; this.paint(); }

  setEyes(hex) {
    this.eyeHex = hex;
    const old = this.eyeMat.map;
    this.eyeMat.map = irisTexture(hex);
    this.eyeMat.needsUpdate = true;
    old?.dispose();
  }

  paint() {
    paintSkin(this.skinCanvas, this.body, this.skinHex);
    this.skinMat.map.needsUpdate = true;
  }
}
