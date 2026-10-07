import * as THREE from 'three';

// Garments are cut out of MakeHuman's helper meshes ("tights", a fitted
// full-body suit, and "skirt", a long skirt shell). A cut keeps the triangles
// whose vertices all pass a rule; rules test which bone mainly moves a vertex
// and its rest height. Because the pieces are part of the morphed, skinned
// body, they fit every slider value and follow every pose.

export const BONES = {
  torso: ['pelvis', 'spine_01', 'spine_02', 'spine_03', 'clavicle_l', 'clavicle_r', 'neck_01'],
  upperArm: ['upperarm_l', 'upperarm_r'],
  lowerArm: ['lowerarm_l', 'lowerarm_r'],
  hand: ['hand_l', 'hand_r'],
  thigh: ['thigh_l', 'thigh_r'],
  calf: ['calf_l', 'calf_r'],
  foot: ['foot_l', 'foot_r', 'ball_l', 'ball_r'],
};

// A garment piece spec:
//   parts: keys of BONES — keep triangles mainly moved by these bones
//   y: [min, max] rest height, cut exactly (straight hems)
//   clip: extra exact cuts [{ f: master => number, min, max }]
//   test: (master, body) => bool, extra per-vertex filter
export function piece(body, { parts, y, clip = [], test }) {
  const set = parts && new Set(parts.flatMap((p) => BONES[p] ?? [p]));
  const ok = (i) => (!set || set.has(body.mainBone(i))) && (!test || test(i, body));
  const clips = [...clip];
  if (y) clips.push({ f: (i) => body.restY(i), min: y[0], max: y[1] });
  return { keep: (a, b, c) => ok(a) && ok(b) && ok(c), clip: clips };
}

// Skinned garment piece from a helper mesh ('tights' or 'skirt').
//   offset: meters along the normal, or (master, y) => meters
export function cut(ctx, mesh, spec, material, { offset = 0.0015, uv } = {}) {
  const { body } = ctx;
  const geo = body.geometry(mesh, { ...piece(body, spec), offset, uv });
  const m = body.mesh(geo, material);
  ctx.add(m);
  return m;
}

// Cross-section of the tights around a bone at a rest height, used to size
// rigid trims (ruffles, cuffs, lace) that ride on that bone.
export function section(body, parts, y, band = 0.012, side = 0) {
  const vert = body.arr('tights.vert');
  const set = new Set(parts.flatMap((p) => BONES[p] ?? [p]));
  let n = 0;
  const c = new THREE.Vector3(), min = new THREE.Vector3(1e9, 1e9, 1e9), max = new THREE.Vector3(-1e9, -1e9, -1e9), v = new THREE.Vector3();
  const seen = new Set();
  for (const i of vert) {
    if (seen.has(i)) continue;
    seen.add(i);
    if (Math.abs(body.restY(i) - y) > band || !set.has(body.mainBone(i))) continue;
    body.vertex(i, v);
    if (side && Math.sign(v.x) !== side) continue;
    c.add(v); min.min(v); max.max(v); n++;
  }
  if (!n) return null;
  c.divideScalar(n);
  return { center: c, rx: (max.x - min.x) / 2, rz: (max.z - min.z) / 2, cx: (max.x + min.x) / 2, cz: (max.z + min.z) / 2, y: c.y };
}

// Position of a vertex along a bone (0 at the joint, 1 at the bone's tail),
// in the default rest pose.
const boneCache = new Map();
export function along(body, bone, i) {
  let c = boneCache.get(bone);
  if (!c) {
    const b = body.meta.bones.find((x) => x.name === bone);
    const h = new THREE.Vector3(...b.head), d = new THREE.Vector3(...b.tail).sub(h);
    boneCache.set(bone, (c = { h, d: d.divideScalar(d.lengthSq()) }));
  }
  const p = body.base;
  return (p[i * 3] - c.h.x) * c.d.x + (p[i * 3 + 1] - c.h.y) * c.d.y + (p[i * 3 + 2] - c.h.z) * c.d.z;
}

// Field along the arm/leg of whichever side the vertex is on; vertices not
// mainly moved by that limb read as -1 (so torso pieces aren't cut by it).
export const alongLimb = (body, limb) => (i) => {
  const b = `${limb}_${body.base[i * 3] > 0 ? 'l' : 'r'}`;
  return body.mainBone(i) === b ? Math.max(0, along(body, b, i)) : -1;
};

// Ring-shaped cross-section of the tights across a bone at fraction t, for
// sizing and orienting rigid trims (cuffs, hems, sock tops).
export function ring(body, bone, t, band = 0.06) {
  const b = body.meta.bones.find((x) => x.name === bone);
  const head = body.joint(bone);
  const tailRest = new THREE.Vector3(...b.tail), headRest = new THREE.Vector3(...b.head);
  const dir = tailRest.clone().sub(headRest);
  const len = dir.length();
  dir.normalize();
  const center = head.clone().addScaledVector(dir, t * len);
  const vert = new Set(body.arr('tights.vert'));
  let r = 0, n = 0;
  const v = new THREE.Vector3();
  for (const i of vert) {
    if (body.mainBone(i) !== bone) continue;
    const a = along(body, bone, i);
    if (Math.abs(a - t) > band) continue;
    body.vertex(i, v).sub(center);
    r += v.addScaledVector(dir, -v.dot(dir)).length();
    n++;
  }
  return { center, dir, radius: n ? r / n : 0.04 };
}

// Cylindrical UVs around a vertical axis: u wraps once around, v = height.
export const cylUV = (cx = 0, cz = 0, vScale = 1) => (i, p) => [Math.atan2(p.x - cx, p.z - cz) / (Math.PI * 2) + 0.5, p.y * vScale];
