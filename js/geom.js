import * as THREE from 'three';

const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const spow = (v, e) => Math.sign(v) * Math.pow(Math.abs(v), e);
export const clamp01 = (x) => Math.min(1, Math.max(0, x));
export const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// Average normals of vertices that share a position, so UV seams and poles
// shade smoothly and the outline hull doesn't split open along them.
export function smoothSeams(g) {
  const p = g.attributes.position, n = g.attributes.normal;
  const groups = new Map();
  for (let i = 0; i < p.count; i++) {
    const k = `${p.getX(i).toFixed(4)},${p.getY(i).toFixed(4)},${p.getZ(i).toFixed(4)}`;
    let e = groups.get(k);
    if (!e) groups.set(k, (e = { n: v3(), ids: [] }));
    e.n.x += n.getX(i); e.n.y += n.getY(i); e.n.z += n.getZ(i);
    e.ids.push(i);
  }
  for (const { n: s, ids } of groups.values()) {
    if (ids.length < 2) continue;
    s.normalize();
    for (const i of ids) n.setXYZ(i, s.x, s.y, s.z);
  }
  n.needsUpdate = true;
  return g;
}

// Rounded box ("superellipsoid") — the soft blocky shape every body part,
// clothing shell and accessory is built from. Sphere UVs are kept, with the
// front (+Z) at u = 0.5, so canvas textures map like a world map.
//   e      roundness: 1 = ellipsoid, lower = boxier
//   shape  (pos, dir) => void, deform in place; dir is the unit sphere direction
//   keep   (dir) => bool, drop triangles whose centroid direction fails
export function blob(w, h, d, o = {}) {
  const { e = 0.6, ws = 32, hs = 22, shape, keep, center = [0, 0, 0] } = o;
  const g = new THREE.SphereGeometry(1, ws, hs, -Math.PI / 2);
  const p = g.attributes.position, uv = g.attributes.uv;
  const dirs = [];
  const pos = v3(), dir = v3();
  for (let i = 0; i < p.count; i++) {
    dir.fromBufferAttribute(p, i);
    dirs.push(dir.clone());
    pos.set(spow(dir.x, e) * w / 2, spow(dir.y, e) * h / 2, spow(dir.z, e) * d / 2);
    // Re-derive UVs from the flattened shape so prints and faces aren't
    // stretched across the flat front. Unwrap toward the sphere's own u to
    // keep its back seam intact.
    const nx = pos.x / (w / 2), ny = pos.y / (h / 2), nz = pos.z / (d / 2);
    let u = 0.5 + Math.atan2(nx, nz) / (Math.PI * 2);
    const u0 = uv.getX(i);
    if (u - u0 > 0.5) u -= 1; else if (u0 - u > 0.5) u += 1;
    uv.setXY(i, u, 0.5 + Math.atan2(ny, Math.hypot(nx, nz)) / Math.PI);
    if (shape) shape(pos, dir);
    p.setXYZ(i, pos.x + center[0], pos.y + center[1], pos.z + center[2]);
  }
  if (keep) {
    const idx = g.index.array, out = [];
    const c = v3();
    for (let t = 0; t < idx.length; t += 3) {
      c.copy(dirs[idx[t]]).add(dirs[idx[t + 1]]).add(dirs[idx[t + 2]]).normalize();
      if (keep(c)) out.push(idx[t], idx[t + 1], idx[t + 2]);
    }
    g.setIndex(out);
  }
  g.computeVertexNormals();
  smoothSeams(g);
  return g;
}

// Accumulates tapered, flattened tubes ("locks") into one geometry.
// Hair is ~50–100 of these; ribbons and bow tails use them too.
export class LockBuilder {
  constructor() { this.pos = []; this.nrm = []; this.uv = []; this.idx = []; this.n = 0; }

  // pts: Vector3[] control points. Options:
  //   w      half-width at the root      flat  thickness / width ratio
  //   taper  t => scale (0..1 along lock) out   p => outward Vector3 (flat side faces it)
  add(pts, o = {}) {
    const { w = 0.05, flat = 0.35, seg = 22, rad = 8, taper = (t) => 1 - Math.pow(t, 2.4), out = (p) => p.clone() } = o;
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    const base = this.n;
    const P = v3(), T = v3(), side = v3(), up = v3(), nn = v3(), q = v3();
    for (let i = 0; i <= seg; i++) {
      const t = i / seg;
      curve.getPointAt(t, P);
      curve.getTangentAt(t, T);
      const o2 = out(P);
      side.crossVectors(T, o2);
      if (side.lengthSq() < 1e-8) side.crossVectors(T, v3(0, 0, 1));
      side.normalize();
      up.crossVectors(side, T).normalize();
      const s = Math.max(taper(t), 0.0005);
      const a = w * s, b = Math.max(w * flat * s, 0.0004);
      for (let j = 0; j <= rad; j++) {
        const ang = (j / rad) * Math.PI * 2, c = Math.cos(ang), sn = Math.sin(ang);
        q.copy(P).addScaledVector(side, c * a).addScaledVector(up, sn * b);
        nn.copy(side).multiplyScalar(c / a).addScaledVector(up, sn / b).normalize();
        this.pos.push(q.x, q.y, q.z);
        this.nrm.push(nn.x, nn.y, nn.z);
        this.uv.push(t, j / rad);
      }
    }
    const R = rad + 1;
    for (let i = 0; i < seg; i++) for (let j = 0; j < rad; j++) {
      const a = base + i * R + j, b = a + R;
      this.idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
    this.n += (seg + 1) * R;
    return this;
  }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setIndex(this.idx);
    return g;
  }
}

// Flared tube hanging down from y = 0: skirts, ruffles, cuffs, lace trims.
//   rx,rz        top radii        bx,bz   bottom radii
//   len          length           waves/amp   ruffle on the hem
//   pleats       sharp folds      scallop     lace-style rounded hem cut
//   puff         outward bulge in the middle
export function skirt(o) {
  const {
    rx, rz, bx = rx, bz = rz, len, segs = 72, rows = 10,
    waves = 0, amp = 0, pleats = 0, pleatAmp = 0, scallop = 0, puff = 0, phase = 0,
  } = o;
  const pos = [], uv = [], idx = [];
  for (let r = 0; r <= rows; r++) {
    const t = r / rows;
    for (let s = 0; s < segs; s++) {
      const a = (s / segs) * Math.PI * 2;
      const sx = Math.sin(a), cz = Math.cos(a);
      let k = 1 + puff * Math.sin(Math.PI * t);
      k += amp * Math.sin(waves * a + phase) * Math.pow(t, 1.5);
      if (pleats) k += pleatAmp * (Math.abs(((pleats * a) / Math.PI) % 2 - 1) - 0.5) * (0.3 + t);
      const ex = rx + (bx - rx) * t, ez = rz + (bz - rz) * t;
      let y = -len * t;
      if (scallop && r === rows) y += len * 0.35 * (1 - Math.abs(Math.sin((scallop * a) / 2)));
      pos.push(sx * ex * k, y, cz * ez * k);
      uv.push(s / segs, 1 - t);
    }
  }
  for (let r = 0; r < rows; r++) for (let s = 0; s < segs; s++) {
    const a = r * segs + s, b = r * segs + ((s + 1) % segs);
    const c = a + segs, d = b + segs;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// A bow: two pinched loops, a knot and two ribbon tails. Faces +Z, ~`size` wide.
export function bow(size, mat, { tails = true, droop = 0.2 } = {}) {
  const grp = new THREE.Group();
  const lw = size * 0.5, lh = size * 0.42, ld = size * 0.16;
  for (const sgn of [-1, 1]) {
    const g = blob(lw, lh, ld, {
      e: 0.8,
      shape(p) {
        const x = (p.x + lw / 2) / lw; // 0 at the knot, 1 at the tip
        p.y *= 0.3 + 0.7 * Math.sin(Math.min(1, x * 1.15) * Math.PI * 0.5);
        p.z += ld * 0.6 * Math.sin(x * Math.PI); // loops bulge forward
        p.y -= droop * size * x * x;
        p.x = (p.x + lw / 2) * sgn;
      },
    });
    grp.add(new THREE.Mesh(g, mat));
  }
  grp.add(new THREE.Mesh(blob(size * 0.17, size * 0.2, size * 0.17, { e: 0.8 }), mat));
  if (tails) {
    const lb = new LockBuilder();
    for (const sgn of [-1, 1]) {
      lb.add([v3(0, 0, 0), v3(sgn * size * 0.12, -size * 0.25, 0.02), v3(sgn * size * 0.2, -size * 0.55, 0.01)], {
        w: size * 0.09, flat: 0.18, taper: (t) => 1 - 0.3 * t, out: () => v3(0, 0, 1),
      });
    }
    grp.add(new THREE.Mesh(lb.build(), mat));
  }
  return grp;
}

// Five-petal flower facing +Z.
export function flower(size, petalMat, centerMat) {
  const grp = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const m = new THREE.Mesh(blob(size * 0.42, size * 0.5, size * 0.16, { e: 0.9, ws: 16, hs: 12 }), petalMat);
    m.position.set(Math.sin(a) * size * 0.26, Math.cos(a) * size * 0.26, 0);
    m.rotation.z = -a;
    grp.add(m);
  }
  const c = new THREE.Mesh(blob(size * 0.26, size * 0.26, size * 0.2, { e: 0.9, ws: 12, hs: 10 }), centerMat);
  c.position.z = size * 0.05;
  grp.add(c);
  return grp;
}

export { v3 };
