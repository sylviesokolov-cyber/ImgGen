import * as THREE from 'three';

// Poses are written as where each limb segment should *point* (a direction in
// the avatar's frame: +X her left, +Y up, +Z forward), plus small euler tilts
// for the spine, neck and head, and finger curls. The poser turns that into
// bone rotations, so poses survive slider changes and need no rig knowledge.
//
//   dir:   { bone: [x, y, z], ... }       limb aims (left side; `sym` mirrors)
//   tilt:  { bone: [x, y, z] degrees }     spine/neck/head/pelvis rotations
//   curl:  { l: [thumb, index, middle, ring, pinky], r: [...] } degrees
//   y      vertical offset of the whole body (sitting, kneeling)

const D = Math.PI / 180;
const mirrorDir = ([x, y, z]) => [-x, y, z];
const mirrorTilt = ([x, y, z]) => [x, -y, -z];

function sym(p) {
  const out = { ...p, dir: { ...p.dir }, tilt: { ...(p.tilt ?? {}) } };
  for (const [k, v] of Object.entries(p.dir)) {
    const r = k.replace(/_l$/, '_r');
    if (k.endsWith('_l') && !(r in p.dir)) out.dir[r] = mirrorDir(v);
  }
  for (const [k, v] of Object.entries(p.tilt ?? {})) {
    const r = k.replace(/_l$/, '_r');
    if (k.endsWith('_l') && !(r in (p.tilt ?? {}))) out.tilt[r] = mirrorTilt(v);
  }
  if (p.curl?.l && !p.curl.r) out.curl = { l: p.curl.l, r: p.curl.l };
  return out;
}

const RELAX = [10, 12, 16, 20, 24];
const FIST = [40, 85, 90, 90, 90];

export const POSES = [
  sym({
    id: 'stand', name: 'Stand', icon: '🧍‍♀️',
    dir: {
      upperarm_l: [0.22, -1, -0.05], lowerarm_l: [0.12, -1, 0.22], hand_l: [0.05, -1, 0.25],
      thigh_l: [0.02, -1, 0.0], calf_l: [0.0, -1, -0.05], foot_l: [0.1, -0.35, 1],
      thigh_r: [-0.09, -1, 0.02], calf_r: [-0.03, -1, -0.02], foot_r: [-0.25, -0.35, 1],
    },
    tilt: { pelvis: [0, 0, -3], spine_02: [0, 0, 2], spine_03: [0, 0, 2], head: [0, 0, 4] },
    curl: { l: RELAX },
    anim: (t) => ({ spine_03: [Math.sin(t * 1.6) * 0.8, 0, 0], head: [0, Math.sin(t * 0.7) * 2, 0] }),
  }),
  sym({
    id: 'hips', name: 'Hands on hips', icon: '💁‍♀️',
    dir: {
      upperarm_l: [0.75, -0.75, -0.2], lowerarm_l: [-0.65, -0.55, 0.15], hand_l: [-0.6, -0.6, 0.1],
      thigh_l: [0.07, -1, 0.03], calf_l: [0, -1, -0.04], foot_l: [0.18, -0.35, 1],
      thigh_r: [-0.05, -1, 0.12], calf_r: [0.02, -1, 0.02], foot_r: [-0.3, -0.35, 1],
    },
    tilt: { pelvis: [0, 0, 4], spine_02: [0, 0, -3], head: [0, 0, -6] },
    curl: { l: [20, 30, 30, 30, 30] },
  }),
  sym({
    id: 'wave', name: 'Wave', icon: '👋',
    dir: {
      upperarm_l: [0.22, -1, 0], lowerarm_l: [0.12, -1, 0.2], hand_l: [0.05, -1, 0.25],
      upperarm_r: [-0.9, 0.35, 0.15], lowerarm_r: [-0.25, 1, 0.1], hand_r: [-0.15, 1, 0.1],
      thigh_l: [0.03, -1, 0], calf_l: [0, -1, -0.05], foot_l: [0.12, -0.35, 1],
    },
    tilt: { head: [0, 0, -6], spine_03: [0, 0, 2] },
    curl: { l: RELAX, r: [5, 0, 0, 0, 0] },
    anim: (t) => ({ lowerarm_r: [0, 0, Math.sin(t * 6) * 16] }),
  }),
  sym({
    id: 'peace', name: 'Peace', icon: '✌️',
    dir: {
      upperarm_l: [0.22, -1, 0], lowerarm_l: [0.12, -1, 0.2], hand_l: [0.05, -1, 0.25],
      upperarm_r: [-0.55, -0.5, 0.7], lowerarm_r: [0.25, 1, 0.25], hand_r: [0.15, 1, 0.1],
      thigh_l: [0.0, -1, 0.04], calf_l: [0, -1, -0.04], foot_l: [0.1, -0.35, 1],
      thigh_r: [-0.06, -1, 0.1], calf_r: [0.0, -1, -0.12],
    },
    tilt: { head: [4, 0, -10], spine_03: [0, -6, 0], pelvis: [0, 6, 0] },
    curl: { l: RELAX, r: [70, 0, 0, 95, 95] },
    spread: { r: 14 },
  }),
  sym({
    id: 'sit', name: 'Sit', icon: '🪑',
    dir: {
      upperarm_l: [0.3, -1, -0.25], lowerarm_l: [0.15, -1, 0.05], hand_l: [0.1, -1, 0.3],
      thigh_l: [0.02, -0.05, 1], calf_l: [0.05, -0.6, 1], foot_l: [0.1, 0.2, 1],
    },
    tilt: { pelvis: [-6, 0, 0], spine_02: [6, 0, 0], head: [6, 0, 6] },
    curl: { l: RELAX },
    y: -0.4,
  }),
  sym({
    id: 'kneel', name: 'Kneel', icon: '🙇‍♀️',
    dir: {
      upperarm_l: [0.15, -1, 0.3], lowerarm_l: [-0.15, -0.6, 1], hand_l: [-0.1, -0.5, 1],
      thigh_l: [0.12, -0.25, 1], calf_l: [0.03, 0.12, -1], foot_l: [0.0, 0.3, -1],
    },
    tilt: { pelvis: [8, 0, 0], spine_02: [-4, 0, 0], head: [-2, 0, 8] },
    curl: { l: [20, 20, 20, 20, 20] },
    y: -0.37,
  }),
];

const FINGERS = ['thumb', 'index', 'middle', 'ring', 'pinky'];

export class Poser {
  constructor(body) {
    this.body = body;
    this.pose = POSES[0];
    this.y = 0;
    this.extraY = 0;
    this.rest = {};
    for (const b of body.meta.bones) {
      this.rest[b.name] = new THREE.Vector3(...b.tail).sub(new THREE.Vector3(...b.head)).normalize();
    }
    // Palm normals from the rest skeleton: perpendicular to the plane of the
    // knuckles and fingers, facing the body (the palm side).
    const head = (n) => new THREE.Vector3(...body.meta.bones.find((b) => b.name === n).head);
    this.palm = {};
    for (const [side, sgn] of [['l', 1], ['r', -1]]) {
      const across = head('index_01_' + side).sub(head('pinky_01_' + side));
      const n = new THREE.Vector3().crossVectors(across, this.rest['middle_01_' + side]).normalize();
      if (n.x * -sgn < 0) n.negate();
      this.palm[side] = n;
    }
  }

  set(id) {
    this.pose = POSES.find((p) => p.id === id) ?? POSES[0];
  }

  // World-space rotation each bone should end up with, for pose p at time t.
  _targets(p, t) {
    const T = new Map(), bones = this.body.bone, extra = p.anim?.(t) ?? {};
    const worldQ = new Map();
    const eul = new THREE.Euler(), q = new THREE.Quaternion(), qa = new THREE.Quaternion();
    const v = new THREE.Vector3();
    // Walk parents before children (bones are stored that way).
    for (const b of this.body.meta.bones) {
      const name = b.name, parentQ = b.parent >= 0 ? worldQ.get(this.body.meta.bones[b.parent].name) : new THREE.Quaternion();
      let local = new THREE.Quaternion();
      const dir = p.dir[name];
      if (dir) {
        // Aim this segment; twist-free in world space.
        const w = new THREE.Quaternion().setFromUnitVectors(this.rest[name], v.set(...dir).normalize());
        local = parentQ.clone().invert().multiply(w);
      } else {
        const tl = p.tilt?.[name];
        if (tl) local.setFromEuler(eul.set(tl[0] * D, tl[1] * D, tl[2] * D));
        const finger = FINGERS.findIndex((f) => name.startsWith(f));
        if (finger >= 0) {
          const side = name.endsWith('_l') ? 'l' : 'r';
          const c = (p.curl?.[side] ?? RELAX)[finger] * D * (finger === 0 ? 0.6 : 1);
          // Bend toward the palm: around (finger direction × palm normal).
          const handW = worldQ.get('hand_' + side);
          const fingerDir = this.rest[name].clone().applyQuaternion(parentQ);
          const palmN = this.palm[side].clone().applyQuaternion(handW);
          const axis = new THREE.Vector3().crossVectors(fingerDir, palmN).normalize();
          const spread = name.startsWith('index_01') ? 1 : name.startsWith('middle_01') ? -1 : 0;
          qa.setFromAxisAngle(axis, c);
          if (spread && p.spread?.[side]) qa.premultiply(q.setFromAxisAngle(palmN, spread * p.spread[side] * D * (side === 'l' ? 1 : -1)));
          local = parentQ.clone().invert().multiply(qa).multiply(parentQ);
        }
      }
      const ex = extra[name];
      if (ex) local.multiply(q.setFromEuler(eul.set(ex[0] * D, ex[1] * D, ex[2] * D)));
      T.set(name, local);
      worldQ.set(name, parentQ.clone().multiply(local));
    }
    return T;
  }

  update(dt, t) {
    const k = 1 - Math.exp(-dt * 8);
    const T = this._targets(this.pose, t);
    for (const [name, q] of T) this.body.bone[name].quaternion.slerp(q, k);
    this.y += ((this.pose.y ?? 0) - this.y) * k;
    this.body.root.position.y = this.y + this.extraY + Math.sin(t * 1.8) * 0.0015;
  }

  // Jump straight to the pose (thumbnails, screenshots).
  snap(t = 0) {
    const T = this._targets(this.pose, t);
    for (const [name, q] of T) this.body.bone[name].quaternion.copy(q);
    this.y = this.pose.y ?? 0;
    this.body.root.position.y = this.y + this.extraY;
  }
}
