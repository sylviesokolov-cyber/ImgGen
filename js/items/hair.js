import * as THREE from 'three';
import { LockBuilder, smooth, v3 } from '../geom.js';
import { toon, lighten, darken } from '../materials.js';

// Hair = MakeHuman's skinned hair helper (a long, close-fitting hair shell
// that follows the head and back) cropped per style, plus strand locks for
// bangs, braids and twin tails that ride rigidly on the head bone.

const HEAD_C = v3(0, 1.525, 0.03);
const HEAD_R = v3(0.1, 0.112, 0.118);
const rand = (seed) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

// Point on the (ellipsoidal) skull in direction (x, y, z), lifted outward.
const S = (x, y, z, lift = 0.07) => {
  const d = v3(x, y, z).normalize();
  return v3(d.x * HEAD_R.x, d.y * HEAD_R.y, d.z * HEAD_R.z).multiplyScalar(1 + lift).add(HEAD_C);
};

function arc(a, b, n, lift) {
  const A = v3(...a).normalize(), B = v3(...b).normalize(), pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, d = A.clone().lerp(B, t).normalize();
    pts.push(S(d.x, d.y, d.z, typeof lift === 'function' ? lift(t) : lift));
  }
  return pts;
}

function hang(pts, endY, { flare = 0.05, wave = 0, waveLen = 0.12, phase = 0, steps = 8, axis = HEAD_C } = {}) {
  const p0 = pts[pts.length - 1];
  const radial = v3(p0.x - axis.x, 0, p0.z - axis.z);
  const r0 = radial.length();
  radial.normalize();
  const tangent = v3(-radial.z, 0, radial.x);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps, y = p0.y + (endY - p0.y) * t;
    const r = r0 * (1 + flare * t);
    const wv = wave * Math.sin(((p0.y - y) / waveLen) * Math.PI * 2 + phase) * Math.min(1, t * 2);
    pts.push(v3(axis.x + radial.x * r + tangent.x * wv, y, axis.z + radial.z * r + tangent.z * wv).addScaledVector(radial, Math.abs(wv) * 0.5));
  }
  return pts;
}

const outHead = (p) => { const o = p.clone().sub(HEAD_C); if (o.y < 0) o.y *= 0.1; return o; };
const outFrom = (c) => (p) => v3(p.x - c.x, 0, p.z - c.z);
const taperPoint = (t) => 1 - Math.pow(t, 2.4);
const taperBang = (t) => (1 - Math.pow(t, 3)) * (0.75 + 0.25 * Math.sin(Math.PI * Math.min(1, t * 1.4)));

function bangs(b, n, R, { endY, spread = 0.7, w = 0.016, part = 0, wave = 0 }) {
  for (let i = 0; i < n; i++) {
    const s = (i / (n - 1)) * 2 - 1;
    const sweep = part ? Math.sign(s || 1) * 0.12 : 0;
    const pts = arc([s * 0.25 + sweep, 1, 0.1], [s * spread + sweep * 1.3, endY(s) + (R() - 0.5) * 0.05, 1], 7,
      (t) => 0.1 - 0.05 * t + 0.04 * Math.sin(Math.PI * t));
    if (wave) pts[pts.length - 1].x += wave * (R() - 0.5);
    b.add(pts, { w: w * (0.85 + R() * 0.3), flat: 0.3, taper: taperBang, out: outHead });
  }
}

function sideLocks(b, R, { per = 2, endY, w = 0.016, wave = 0 }) {
  for (const sx of [-1, 1]) for (let k = 0; k < per; k++) {
    const pts = arc([sx * 0.5, 0.85, 0.45], [sx, -0.05, 0.62 - k * 0.2], 5, 0.09);
    hang(pts, endY - k * 0.03 + (R() - 0.5) * 0.03, { flare: 0.1, wave, phase: R() * 6 + sx });
    b.add(pts, { w: w * (0.85 + R() * 0.3), flat: 0.3, taper: taperPoint, out: outHead, seg: 28 });
  }
}

function backLocks(b, R, { count, endY, w = 0.022, wave = 0, flare = 0.3, from = 70, to = 290, lift = 0.1 }) {
  for (let k = 0; k < count; k++) {
    const az = ((from + ((to - from) * k) / (count - 1)) * Math.PI) / 180;
    const sx = Math.sin(az), cz = Math.cos(az);
    const pts = arc([sx * 0.35, 1, cz * 0.35], [sx, -0.2, cz], 5, lift);
    hang(pts, endY + (R() - 0.5) * 0.04, { flare, wave, phase: R() * 6, waveLen: 0.11 + R() * 0.03 });
    b.add(pts, { w: w * (0.85 + R() * 0.3), flat: 0.3, taper: taperPoint, out: outHead, seg: 34 });
  }
}

function paint(geo, root, tip, top = 1.62, bottom = 1.0) {
  const p = geo.attributes.position, a = new THREE.Color(root), b = new THREE.Color(tip), c = new THREE.Color();
  const col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    c.copy(a).lerp(b, smooth(top, bottom, p.getY(i)));
    col.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
}

function hairMaterial(root, side = THREE.FrontSide) {
  return toon('#ffffff', {
    vertexColors: true, side, ramp: [140, 210, 255],
    outline: 0.0018, outlineColor: new THREE.Color(darken(root, 0.6)).toArray(),
  });
}

// The skinned shell, cropped to rest heights above `minY`.
function shell(ctx, c, minY, { offset = 0.003, top = 1.62, bottom = 1.0 } = {}) {
  const { body } = ctx;
  // Drop the curtain in front of the face; the style's own locks frame it.
  const face = { f: (i) => (body.base[i * 3 + 2] > 0.06 && body.restY(i) < 1.57 ? 1 : 0), max: 0.5 };
  const geo = body.geometry('hair', { clip: [{ f: (i) => body.restY(i), min: minY }], keep: (a, b, d) => [a, b, d].every((i) => face.f(i) < 0.5), offset });
  paint(geo, c.root, c.tip, top, bottom);
  const m = body.mesh(geo, hairMaterial(c.root, THREE.DoubleSide));
  ctx.add(m);
  return m;
}

function locks(ctx, b, c, top, bottom) {
  const geo = b.build();
  paint(geo, c.root, c.tip, top, bottom);
  const m = new THREE.Mesh(geo, hairMaterial(c.root));
  ctx.onDefault('head', m, v3(0, 0, 0));
  return m;
}

// ---------------------------------------------------------------------------

function straight(ctx, c) {
  const R = rand(11), b = new LockBuilder();
  shell(ctx, c, 0, {});
  bangs(b, 11, R, { endY: (s) => (Math.abs(s) < 0.55 ? 0.3 : 0.3 - (Math.abs(s) - 0.55) * 1.2), part: 1 });
  sideLocks(b, R, { per: 3, endY: 1.08 });
  backLocks(b, R, { count: 12, endY: 1.0, from: 100, to: 260, flare: 0.25 });
  locks(ctx, b, c);
  // side braid on her left
  const braid = new THREE.Group();
  const curve = new THREE.CatmullRomCurve3([S(0.95, 0.35, 0.55, 0.1), S(1, -0.4, 0.6, 0.12), v3(0.1, 1.33, 0.08), v3(0.12, 1.2, 0.1)]);
  const bead = new THREE.SphereGeometry(1, 12, 8);
  bead.scale(0.012, 0.016, 0.01);
  paint(bead, c.root, c.root);
  const mat = hairMaterial(c.root);
  for (let i = 0; i < 14; i++) {
    const t = i / 13, m = new THREE.Mesh(bead, mat);
    m.position.copy(curve.getPointAt(t));
    m.quaternion.setFromUnitVectors(v3(0, 1, 0), curve.getTangentAt(t));
    m.rotateY((i % 2 ? 1 : -1) * 0.5);
    m.translateX((i % 2 ? 1 : -1) * 0.003);
    m.scale.setScalar(1 - t * 0.3);
    braid.add(m);
  }
  const tie = new THREE.Mesh(new THREE.SphereGeometry(0.009, 10, 8), toon('#ff8fb8'));
  tie.position.copy(curve.getPointAt(1)).add(v3(0, -0.008, 0));
  braid.add(tie);
  ctx.onDefault('head', braid, v3(0, 0, 0));
}

function twintails(ctx, c) {
  const R = rand(5), b = new LockBuilder();
  shell(ctx, c, 1.4, { top: 1.62, bottom: 1.4 });
  bangs(b, 13, R, { endY: (s) => 0.32 - Math.pow(Math.abs(s), 3) * 0.45, spread: 0.8, w: 0.015 });
  sideLocks(b, R, { per: 2, endY: 1.38, w: 0.013, wave: 0.006 });
  backLocks(b, R, { count: 12, endY: 1.4, w: 0.024, flare: 0.05 });
  const g = new THREE.Group();
  const tieMat = toon('#ff9cc4');
  for (const sx of [-1, 1]) {
    const anchor = S(sx * 0.85, 0.6, -0.3, 0.12);
    const tie = new THREE.Mesh(new THREE.SphereGeometry(0.018, 14, 10), tieMat);
    tie.position.copy(anchor);
    g.add(tie);
    const axis = v3(anchor.x + sx * 0.06, 0, anchor.z - 0.01);
    for (let k = 0; k < 18; k++) {
      const phi = (k / 18) * Math.PI * 2, rr = 0.012 + R() * 0.012;
      const start = anchor.clone().add(v3(Math.cos(phi) * 0.006, Math.sin(phi) * 0.006, Math.sin(phi) * 0.004));
      const up = anchor.clone().add(v3(sx * 0.04 + Math.cos(phi) * rr, 0.02, Math.sin(phi) * rr));
      const top = v3(axis.x + Math.cos(phi) * (rr + 0.012), anchor.y - 0.05, axis.z + Math.sin(phi) * (rr + 0.012));
      const pts = hang([start, up, top], 0.98 + (R() - 0.5) * 0.08, { axis, flare: 1.4, wave: 0.014, waveLen: 0.1, phase: phi * 2 + R(), steps: 12 });
      const last = pts[pts.length - 1];
      pts.push(last.clone().add(v3(Math.cos(phi) * 0.008, -0.01, Math.sin(phi) * 0.008)), last.clone().add(v3(Math.cos(phi) * 0.016, -0.003, Math.sin(phi) * 0.016)));
      b.add(pts, { w: 0.014 + R() * 0.006, flat: 0.45, taper: taperPoint, out: outFrom(axis), seg: 44 });
    }
  }
  ctx.onDefault('head', g, v3(0, 0, 0));
  locks(ctx, b, c, 1.62, 0.95);
}

function wavy(ctx, c) {
  const R = rand(23), b = new LockBuilder();
  shell(ctx, c, 1.3, { bottom: 1.1 });
  bangs(b, 12, R, { endY: (s) => 0.32 - R() * 0.08 - Math.pow(Math.abs(s), 2.5) * 0.55, spread: 0.78, w: 0.016, wave: 0.01 });
  sideLocks(b, R, { per: 3, endY: 1.12, w: 0.017, wave: 0.012 });
  backLocks(b, R, { count: 16, endY: 1.02, w: 0.025, wave: 0.014, flare: 0.55, from: 75, to: 285 });
  locks(ctx, b, c, 1.62, 1.1);
}

export const HAIR_COLORS = [
  { id: 'natural', name: 'Original' },
  { id: '#f7a8c4', name: 'Pink' },
  { id: '#ffe08a', name: 'Blonde' },
  { id: '#8a5634', name: 'Brown' },
  { id: '#c4a8f5', name: 'Lavender' },
  { id: '#8fc8ff', name: 'Sky' },
  { id: '#f2f2f5', name: 'White' },
  { id: '#2a2228', name: 'Black' },
  { id: '#ff6f7d', name: 'Cherry' },
];

export const HAIR = [
  { id: 'straight', name: 'Sakura Long', root: '#f4b0c6', tip: '#fff3f6', build: straight },
  { id: 'twintails', name: 'Mint Twin Tails', root: '#7fd6bf', tip: '#d6fff2', build: twintails },
  { id: 'wavy', name: 'Midnight Waves', root: '#1f1a20', tip: '#43354a', build: wavy },
];

export function buildHair(ctx, id, color = 'natural') {
  const h = HAIR.find((x) => x.id === id) ?? HAIR[0];
  const c = color === 'natural' ? h : { root: color, tip: lighten(color, color === '#2a2228' ? 0.12 : 0.45) };
  h.build(ctx, c);
}
