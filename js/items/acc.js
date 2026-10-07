import * as THREE from 'three';
import { blob, bow, flower, skirt, LockBuilder, v3 } from '../geom.js';
import { toon } from '../materials.js';

// Accessories sit on the hair, so they use a slightly larger skull ellipsoid
// than the hair does, and ride on the head bone.
const C = v3(0, 1.525, 0.03), R = v3(0.1, 0.112, 0.118);
const S = (x, y, z, lift = 0.2) => {
  const d = v3(x, y, z).normalize();
  return v3(d.x * R.x, d.y * R.y, d.z * R.z).multiplyScalar(1 + lift).add(C);
};
const mat = (c, o = {}) => toon(c, { outline: 0.002, ...o });

function faceOut(obj, p, roll = 0) {
  obj.quaternion.setFromUnitVectors(v3(0, 0, 1), p.clone().sub(C).normalize());
  obj.rotateZ(roll);
  return obj;
}

function bigBow(ctx) {
  const b = bow(0.13, mat('#ffffff'), { droop: 0.25 });
  b.rotation.set(-0.5, 0, -0.18);
  const pearl = new THREE.Mesh(blob(0.014, 0.014, 0.014, { e: 1, ws: 12, hs: 10 }), mat('#ffc6dc'));
  pearl.position.z = 0.016;
  b.add(pearl);
  ctx.onDefault('head', b, S(0.2, 1, -0.15, 0.16));
}

function headband(ctx) {
  const lb = new LockBuilder();
  const pts = [];
  for (let i = 0; i <= 20; i++) {
    const a = (i / 20) * Math.PI;
    pts.push(S(Math.cos(a), Math.sin(a) * 1.15 + 0.1, 0.3, 0.17));
  }
  lb.add(pts, { w: 0.007, flat: 0.55, taper: () => 1, seg: 60, rad: 10, out: (p) => p.clone().sub(C) });
  const band = new THREE.Mesh(lb.build(), mat('#ffffff'));
  ctx.onDefault('head', band, v3(0, 0, 0));
  const lace = mat('#ffe3ee', { side: THREE.DoubleSide, outline: 0.001 });
  for (let i = 1; i < 20; i++) {
    const a = (i / 20) * Math.PI, p = S(Math.cos(a), Math.sin(a) * 1.15 + 0.1, 0.45, 0.17);
    const sc = new THREE.Mesh(new THREE.CircleGeometry(0.009, 10, 0, Math.PI), lace);
    faceOut(sc, p, a + Math.PI / 2);
    sc.rotateX(-0.9);
    ctx.onDefault('head', sc, p);
  }
  const center = mat('#fff1a8', { outline: 0 });
  [[0.8, 0.55, 0.45, '#ffb0cc', 0.03], [0.6, 0.78, 0.45, '#d9c2ff', 0.022], [-0.85, 0.5, 0.45, '#ffb0cc', 0.026]].forEach(([x, y, z, c, s]) => {
    const p = S(x, y, z, 0.2);
    ctx.onDefault('head', faceOut(flower(s, mat(c), center), p, x), p);
  });
}

function catEars(ctx) {
  const outer = mat('#fbf8fb'), inner = mat('#ffb6cf', { outline: 0 });
  const ear = (w, h, d) => blob(w, h, d, { e: 0.75, shape(p) { const t = (p.y + h / 2) / h; p.x *= 1 - t * 0.85; p.z *= 1 - t * 0.5; p.y += h / 2; } });
  for (const sx of [-1, 1]) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(ear(0.055, 0.06, 0.018), outer));
    const inn = new THREE.Mesh(ear(0.034, 0.04, 0.006), inner);
    inn.position.set(0, 0.004, 0.008);
    g.add(inn);
    g.rotation.set(-0.15, -sx * 0.3, -sx * 0.35);
    ctx.onDefault('head', g, S(sx * 0.55, 0.95, 0.05, 0.1));
  }
}

function cupcake(ctx) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(skirt({ rx: 0.014, rz: 0.014, bx: 0.01, bz: 0.01, len: 0.014, pleats: 10, pleatAmp: 0.18, rows: 3, segs: 40 }), mat('#ff9cc4', { side: THREE.DoubleSide })));
  const frost = mat('#fffaf4');
  [[0.017, 0.003], [0.013, 0.009], [0.009, 0.015], [0.004, 0.019]].forEach(([r, y]) => {
    const t = new THREE.Mesh(new THREE.TorusGeometry(r, 0.005, 8, 20), frost);
    t.rotation.x = Math.PI / 2;
    t.position.y = y;
    g.add(t);
  });
  const cherry = new THREE.Mesh(new THREE.SphereGeometry(0.0055, 12, 10), mat('#ff4d6d'));
  cherry.position.y = 0.026;
  g.add(cherry);
  g.rotation.set(0.1, -0.5, 0.45);
  ctx.onDefault('head', g, S(-0.9, 0.45, 0.35, 0.16));
}

export const ACCESSORIES = [
  { id: 'bow', name: 'Big Bow', swatch: '#ffffff', build: bigBow },
  { id: 'headband', name: 'Flower Headband', swatch: '#ffb0cc', build: headband },
  { id: 'ears', name: 'Kitty Ears', swatch: '#fbf8fb', build: catEars },
  { id: 'cupcake', name: 'Cupcake Clip', swatch: '#ff9cc4', build: cupcake },
];
