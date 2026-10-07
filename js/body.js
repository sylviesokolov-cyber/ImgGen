import * as THREE from 'three';

// Loads the body baked by tools/build_body.py (MakeHuman CC0 assets) and
// drives it: slider morphs are applied on the CPU whenever a slider moves
// (rarely), then every mesh built from the body — skin, clothes, eyes — is
// refreshed, and the skeleton's joints are moved to match.
//
// Bones all have identity rest rotations, so their axes line up with the
// world: +X is her left, +Y up, +Z forward. Poses are written in that frame.

const TYPES = { float32: Float32Array, uint16: Uint16Array, uint8: Uint8Array, int16: Int16Array };

export async function loadBody(base = 'assets/') {
  const [meta, buf] = await Promise.all([
    fetch(base + 'body.json').then((r) => r.json()),
    fetch(base + 'body.bin').then((r) => r.arrayBuffer()),
  ]);
  return new Body(meta, buf);
}

export class Body {
  constructor(meta, buf) {
    this.meta = meta;
    const arr = (name) => {
      const l = meta.layout[name];
      return new TYPES[l.type](buf, l.offset, l.count);
    };
    this.arr = arr;
    this.n = meta.vertexCount;
    this.base = arr('positions');
    this.pos = new Float32Array(this.base);
    this.skinIndex = arr('skinIndex');
    this.skinWeight = arr('skinWeight');
    this.morphs = {};
    for (const s of meta.sliders) for (const sign of ['+', '-']) {
      const k = s.id + sign;
      this.morphs[k] = { index: arr(`morph.${k}.index`), delta: arr(`morph.${k}.delta`) };
    }
    this.values = Object.fromEntries(meta.sliders.map((s) => [s.id, 0]));

    // Skeleton
    this.root = new THREE.Group();
    this.root.name = 'avatar';
    this.bones = meta.bones.map((b) => Object.assign(new THREE.Bone(), { name: b.name }));
    this.bone = Object.fromEntries(this.bones.map((b) => [b.name, b]));
    meta.bones.forEach((b, i) => (b.parent < 0 ? this.root : this.bones[b.parent]).add(this.bones[i]));
    this.heads = meta.bones.map((b) => new THREE.Vector3(...b.head));
    this.skeleton = new THREE.Skeleton(this.bones);
    this.parts = []; // { geo, map, offset } refreshed on slider change
    this.listeners = new Set();
    this._applyBones();
  }

  // Geometry for one of the baked meshes, or a part of it.
  //   keep(a, b, c) => bool   keep a triangle (master vertex indices)
  //   clip: [{ f: master => number, min, max }]   cut exactly along a scalar
  //         field (e.g. rest height) — hems come out straight, not stepped
  //   offset: push vertices out along their normal; number or (master, y) => m
  //   uv: (master, restPosition) => [u, v]   custom UVs, u wrapping at 1
  //
  // Every output vertex is a blend of up to 4 master vertices (cut points
  // lie on edges), refreshed from the morphed body whenever sliders move.
  geometry(name, { keep, clip = [], offset = 0, uv: uvFn } = {}) {
    const src = this.arr(name + '.vert'), srcUV = this.arr(name + '.uv'), srcIdx = this.arr(name + '.index');
    const verts = []; // { w: Map(master -> weight), u, v }
    const keyOf = new Map();
    const original = (i) => {
      const k = 'o' + i;
      if (!keyOf.has(k)) { keyOf.set(k, verts.length); verts.push({ w: new Map([[src[i], 1]]), u: srcUV[i * 2], v: srcUV[i * 2 + 1], k }); }
      return keyOf.get(k);
    };
    const value = (vi, f) => { let s = 0; for (const [m, w] of verts[vi].w) s += f(m) * w; return s; };
    const between = (a, b, t) => {
      const k = [verts[a].k, verts[b].k].sort().join('|') + '@' + t.toFixed(5);
      if (keyOf.has(k)) return keyOf.get(k);
      const A = verts[a], B = verts[b], w = new Map();
      for (const [m, x] of A.w) w.set(m, (w.get(m) ?? 0) + x * (1 - t));
      for (const [m, x] of B.w) w.set(m, (w.get(m) ?? 0) + x * t);
      keyOf.set(k, verts.length);
      verts.push({ w, u: A.u + (B.u - A.u) * t, v: A.v + (B.v - A.v) * t, k });
      return keyOf.get(k);
    };
    // Sutherland–Hodgman against one side of one field.
    const clipPoly = (poly, f, bound, keepAbove) => {
      const out = [];
      for (let i = 0; i < poly.length; i++) {
        const a = poly[i], b = poly[(i + 1) % poly.length];
        const va = value(a, f) - bound, vb = value(b, f) - bound;
        const ina = keepAbove ? va >= 0 : va <= 0, inb = keepAbove ? vb >= 0 : vb <= 0;
        if (ina) out.push(a);
        if (ina !== inb) {
          const t = va / (va - vb);
          // order the key so shared edges dedupe from either side
          out.push(a < b ? between(a, b, t) : between(b, a, 1 - t));
        }
      }
      return out;
    };
    const index = [];
    for (let t = 0; t < srcIdx.length; t += 3) {
      const tri = [srcIdx[t], srcIdx[t + 1], srcIdx[t + 2]];
      if (keep && !keep(src[tri[0]], src[tri[1]], src[tri[2]])) continue;
      // quick reject/accept per field using the master values
      let poly = tri.map(original);
      for (const c of clip) {
        if (c.min !== undefined && poly.length) poly = clipPoly(poly, c.f, c.min, true);
        if (c.max !== undefined && poly.length) poly = clipPoly(poly, c.f, c.max, false);
      }
      for (let k = 1; k + 1 < poly.length; k++) index.push(poly[0], poly[k], poly[k + 1]);
    }
    // Drop unused vertices (originals of fully clipped triangles).
    const used = new Int32Array(verts.length).fill(-1), list = [];
    for (let i = 0; i < index.length; i++) {
      if (used[index[i]] < 0) { used[index[i]] = list.length; list.push(verts[index[i]]); }
      index[i] = used[index[i]];
    }
    let V = list;
    if (uvFn) V = this._customUV(V, index, uvFn);

    const n = V.length, K = 4;
    const g = new THREE.BufferGeometry();
    const mIdx = new Uint16Array(n * K), mW = new Float32Array(n * K), main = new Uint16Array(n);
    const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4), uvs = new Float32Array(n * 2);
    V.forEach((vx, i) => {
      const ws = [...vx.w].sort((a, b) => b[1] - a[1]).slice(0, K);
      const tot = ws.reduce((s, [, w]) => s + w, 0);
      ws.forEach(([m, w], j) => { mIdx[i * K + j] = m; mW[i * K + j] = w / tot; });
      main[i] = ws[0][0];
      uvs[i * 2] = vx.u; uvs[i * 2 + 1] = vx.v;
      const bw = new Map();
      for (const [m, w] of ws) for (let j = 0; j < 4; j++) {
        const b = this.skinIndex[m * 4 + j], x = (this.skinWeight[m * 4 + j] / 255) * (w / tot);
        if (x) bw.set(b, (bw.get(b) ?? 0) + x);
      }
      const top = [...bw].sort((a, b) => b[1] - a[1]).slice(0, 4), ts = top.reduce((s, [, w]) => s + w, 0) || 1;
      top.forEach(([b, w], j) => { si[i * 4 + j] = b; sw[i * 4 + j] = w / ts; });
    });
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
    g.setIndex(index);
    // Vertices that are exactly one master share normals across UV seams.
    const nkey = new Int32Array(n);
    V.forEach((vx, i) => { nkey[i] = vx.w.size === 1 ? main[i] : this.n + i; });
    const part = { geo: g, mIdx, mW, main, nkey, offset };
    this.parts.push(part);
    this._refresh(part);
    return g;
  }

  // Wrapping UVs (e.g. around the waist) need the triangles that straddle
  // the wrap to get their own copies of vertices with u shifted by 1.
  _customUV(V, index, fn) {
    const p = new THREE.Vector3();
    V = V.map((vx) => {
      p.set(0, 0, 0);
      let best = 0, main = 0;
      for (const [m, w] of vx.w) {
        p.x += this.base[m * 3] * w; p.y += this.base[m * 3 + 1] * w; p.z += this.base[m * 3 + 2] * w;
        if (w > best) { best = w; main = m; }
      }
      const [u, v] = fn(main, p);
      return { ...vx, u, v };
    });
    const dup = new Map();
    for (let t = 0; t < index.length; t += 3) {
      const us = [0, 1, 2].map((k) => V[index[t + k]].u);
      if (Math.max(...us) - Math.min(...us) < 0.5) continue;
      for (let k = 0; k < 3; k++) {
        const i = index[t + k];
        if (V[i].u >= 0.5) continue;
        let j = dup.get(i);
        if (j === undefined) { j = V.length; V.push({ ...V[i], u: V[i].u + 1 }); dup.set(i, j); }
        index[t + k] = j;
      }
    }
    return V;
  }

  // Name of the bone with the most influence on a master vertex.
  mainBone(i) {
    return this.meta.bones[this.skinIndex[i * 4]].name;
  }

  // Rest-pose position of a master vertex for the *default* sliders, so
  // garment cut lines don't shift as sliders move.
  restY(i) { return this.base[i * 3 + 1]; }

  // A skinned mesh bound to this body's skeleton.
  mesh(geo, material) {
    const m = new THREE.SkinnedMesh(geo, material);
    m.bind(this.skeleton, new THREE.Matrix4());
    m.frustumCulled = false;
    return m;
  }

  release(geo) {
    this.parts = this.parts.filter((p) => p.geo !== geo);
    geo.dispose();
  }

  set(id, v) {
    this.values[id] = v;
    const p = this.pos;
    p.set(this.base);
    const S = this.meta.deltaScale;
    for (const [sid, val] of Object.entries(this.values)) {
      if (!val) continue;
      const m = this.morphs[sid + (val > 0 ? '+' : '-')], w = Math.abs(val) * S;
      for (let k = 0; k < m.index.length; k++) {
        const i = m.index[k] * 3;
        p[i] += m.delta[k * 3] * w;
        p[i + 1] += m.delta[k * 3 + 1] * w;
        p[i + 2] += m.delta[k * 3 + 2] * w;
      }
    }
    for (const part of this.parts) this._refresh(part);
    this._applyBones();
    for (const fn of this.listeners) fn();
  }

  setAll(values) {
    for (const [k, v] of Object.entries(values)) if (k in this.values) this.values[k] = v;
    this.set(Object.keys(this.values)[0], this.values[Object.keys(this.values)[0]]);
  }

  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }

  // Position of a master vertex (unposed).
  vertex(i, target = new THREE.Vector3()) {
    return target.set(this.pos[i * 3], this.pos[i * 3 + 1], this.pos[i * 3 + 2]);
  }

  // Joint position in the rest pose for the current slider values.
  joint(name, target = new THREE.Vector3()) {
    return target.copy(this.heads[this.meta.bones.findIndex((b) => b.name === name)]);
  }

  defaultJoint(name) {
    return new THREE.Vector3(...this.meta.bones.find((b) => b.name === name).head);
  }

  _applyBones() {
    const { bones: mb, boneDeltas } = this.meta;
    mb.forEach((b, i) => {
      const h = this.heads[i].set(...b.head);
      for (const [sid, val] of Object.entries(this.values)) {
        if (!val) continue;
        const d = boneDeltas[sid + (val > 0 ? '+' : '-')][i], w = Math.abs(val);
        h.x += d[0] * w; h.y += d[1] * w; h.z += d[2] * w;
      }
    });
    mb.forEach((b, i) => {
      const bone = this.bones[i];
      bone.position.copy(this.heads[i]);
      if (b.parent >= 0) bone.position.sub(this.heads[b.parent]);
      this.skeleton.boneInverses[i].makeTranslation(-this.heads[i].x, -this.heads[i].y, -this.heads[i].z);
    });
  }

  // Copy morphed positions into a part's geometry, smooth normals across UV
  // seams (by master vertex), then push clothing out along the normals.
  _refresh({ geo, mIdx, mW, main, nkey, offset }) {
    const pa = geo.attributes.position.array, na = geo.attributes.normal.array, p = this.pos;
    const n = main.length, K = 4;
    for (let i = 0; i < n; i++) {
      let x = 0, y = 0, z = 0;
      for (let j = 0; j < K; j++) {
        const w = mW[i * K + j];
        if (!w) continue;
        const v = mIdx[i * K + j] * 3;
        x += p[v] * w; y += p[v + 1] * w; z += p[v + 2] * w;
      }
      pa[i * 3] = x; pa[i * 3 + 1] = y; pa[i * 3 + 2] = z;
    }
    const acc = new Map();
    const idx = geo.index.array;
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    for (let t = 0; t < idx.length; t += 3) {
      a.fromArray(pa, idx[t] * 3); b.fromArray(pa, idx[t + 1] * 3); c.fromArray(pa, idx[t + 2] * 3);
      c.sub(b); a.sub(b); c.cross(a); // area-weighted face normal
      for (let k = 0; k < 3; k++) {
        const m = nkey[idx[t + k]];
        let s = acc.get(m);
        if (!s) acc.set(m, (s = [0, 0, 0]));
        s[0] += c.x; s[1] += c.y; s[2] += c.z;
      }
    }
    for (let i = 0; i < n; i++) {
      const s = acc.get(nkey[i]);
      if (!s) continue;
      const l = Math.hypot(s[0], s[1], s[2]) || 1;
      na[i * 3] = s[0] / l; na[i * 3 + 1] = s[1] / l; na[i * 3 + 2] = s[2] / l;
      if (offset) {
        const o = typeof offset === 'function' ? offset(main[i], pa[i * 3 + 1]) : offset;
        pa[i * 3] += na[i * 3] * o; pa[i * 3 + 1] += na[i * 3 + 1] * o; pa[i * 3 + 2] += na[i * 3 + 2] * o;
      }
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.normal.needsUpdate = true;
    geo.computeBoundingSphere();
  }
}
