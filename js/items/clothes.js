import * as THREE from 'three';
import { blob, skirt as tube, bow, flower } from '../geom.js';
import { toon } from '../materials.js';
import { patternTexture } from '../textures.js';
import { cut, alongLimb, ring, section, cylUV, BONES } from './garment.js';

const DS = THREE.DoubleSide;
const fabric = (color, o = {}) => toon(color, { outline: 0.0022, ramp: [150, 215, 255], ...o });
const frill = (color, o = {}) => fabric(color, { side: DS, outline: 0.0015, ...o });
const sides = ['l', 'r'];

// A ruffle / lace ring hanging off a body ring along `dir`.
function trim(ctx, bone, r, { len = 0.02, flare = 1.25, waves = 0, amp = 0, scallop = 0, color = '#fff', pad = 0.004, segs = 64 }) {
  const g = tube({ rx: r.radius + pad, rz: r.radius + pad, bx: (r.radius + pad) * flare, bz: (r.radius + pad) * flare, len, waves, amp, scallop, rows: 3, segs });
  const m = new THREE.Mesh(g, frill(color));
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), r.dir);
  return ctx.on(bone, m, r.center);
}

// Same, around the torso at a rest height (collars, peplums, waistbands).
function torsoTrim(ctx, y, o) {
  const s = section(ctx.body, ['torso'], y, 0.01);
  if (!s) return null;
  const pad = o.pad ?? 0.006;
  const rx = s.rx + pad, rz = s.rz + pad, k = o.flare ?? 1.2;
  const g = tube({ rx, rz, bx: rx * k, bz: rz * k, len: o.len ?? 0.03, waves: o.waves ?? 0, amp: o.amp ?? 0, scallop: o.scallop ?? 0, rows: 3, segs: 96 });
  const m = new THREE.Mesh(g, frill(o.color ?? '#fff'));
  return ctx.on(o.bone ?? 'spine_02', m, new THREE.Vector3(s.cx, s.y + (o.dy ?? 0), s.cz));
}

// A little decoration placed on the front surface of the tights.
function front(ctx, y, obj, { bone = 'spine_03', x = 0, out = 0.006 } = {}) {
  const s = section(ctx.body, ['torso'], y, 0.008);
  obj.lookAt(new THREE.Vector3(0, 0, 1));
  return ctx.on(bone, obj, new THREE.Vector3(x, y, s ? s.cz + s.rz + out : 0.12));
}

// --- Underlayer (always worn) -----------------------------------------------

export function UNDERLAYER(ctx) {
  const { body } = ctx;
  const mat = fabric('#ece4f3');
  cut(ctx, 'tights', { parts: ['torso'], y: [1.075, 1.255] }, mat, { offset: 0.0012 }).name = 'under-top';
  cut(ctx, 'tights', { parts: ['torso', 'thigh'], y: [0.7, 0.935] }, mat, { offset: 0.0012 }).name = 'under-bottom';
}

// --- Tops ------------------------------------------------------------------

function teePrint(base) {
  return patternTexture((x, s) => {
    x.fillStyle = base; x.fillRect(0, 0, s, s);
    x.fillStyle = '#5b3a78';
    x.textAlign = 'center';
    x.font = 'italic 700 46px Georgia, serif';
    x.fillText("I'm a", s / 2, 270);
    x.font = 'italic 700 78px Georgia, serif';
    x.fillText('cutie', s / 2, 340);
    x.fillStyle = '#ff7fb6';
    x.font = '40px sans-serif';
    x.fillText('♥', s / 2 - 120, 320);
    x.fillText('♥', s / 2 + 118, 285);
  }, 512, [1, 1]);
}

function tee(ctx) {
  const { body } = ctx;
  const lav = '#cdb0ec';
  const tex = teePrint(lav);
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  // u: once around the body (front at 0.5); v: height, print sits at the chest.
  const uv = (i, p) => [Math.atan2(p.x, p.z) / (Math.PI * 2) + 0.5, (p.y - 1.13) * 2.4 + 0.5];
  tex.repeat.set(4, 1);
  tex.offset.set(-1.5, 0);
  const t = alongLimb(body, 'upperarm');
  cut(ctx, 'tights', { parts: ['torso', 'upperArm'], y: [0.9, 1.33], clip: [{ f: t, max: 0.12 }] }, fabric('#ffffff', { map: tex }), { offset: 0.0065, uv });
  const white = fabric('#fbf7fc');
  cut(ctx, 'tights', { parts: ['upperArm', 'lowerArm'], clip: [{ f: t, min: 0.1 }] }, white, { offset: 0.0035 });
  // puff sleeves: the upper half of the upper arm, bulging in the middle
  cut(ctx, 'tights', { parts: ['upperArm', 'torso'], y: [0.9, 1.4], test: (i) => Math.abs(body.base[i * 3]) > 0.1, clip: [{ f: t, min: -0.5, max: 0.5 }] }, fabric(lav),
    { offset: (i) => 0.0085 + 0.02 * Math.sin(Math.PI * Math.min(1, Math.max(0, t(i) + 0.08) / 0.58)) });
  for (const s of sides) trim(ctx, 'lowerarm_' + s, ring(body, 'lowerarm_' + s, 0.93), { len: 0.03, waves: 9, amp: 0.15, color: '#fbf7fc' });
  torsoTrim(ctx, 1.335, { len: 0.02, flare: 1.35, color: lav, bone: 'spine_03' });
}

function blouse(ctx) {
  const { body } = ctx;
  const white = fabric('#fffdfd'), pink = fabric('#ff9cc4');
  cut(ctx, 'tights', { parts: ['torso', 'upperArm'], y: [0.94, 1.33], clip: [{ f: alongLimb(body, 'upperarm'), max: 0.1 }] }, white, { offset: 0.007 });
  const t = alongLimb(body, 'upperarm');
  cut(ctx, 'tights', { parts: ['upperArm', 'torso'], y: [0.94, 1.4], test: (i) => Math.abs(body.base[i * 3]) > 0.1, clip: [{ f: t, min: -0.5, max: 0.45 }] }, white,
    { offset: (i) => 0.009 + 0.018 * Math.sin(Math.PI * Math.min(1, Math.max(0, t(i) + 0.08) / 0.53)) });
  for (const s of sides) trim(ctx, 'upperarm_' + s, ring(body, 'upperarm_' + s, 0.43), { len: 0.025, waves: 10, amp: 0.15, color: '#fffdfd', pad: 0.008 });
  torsoTrim(ctx, 1.33, { len: 0.035, flare: 1.55, waves: 14, amp: 0.1, bone: 'spine_03' });
  torsoTrim(ctx, 0.955, { len: 0.06, flare: 1.35, waves: 12, amp: 0.07, bone: 'spine_01', pad: 0.008 });
  front(ctx, 1.27, bow(0.07, pink));
  for (let k = 0; k < 4; k++) front(ctx, 1.21 - k * 0.055, new THREE.Mesh(blob(0.012, 0.012, 0.007, { e: 1, ws: 10, hs: 8 }), pink), { out: 0.003 });
}

function corset(ctx) {
  const { body } = ctx;
  const pink = '#f7b3c8';
  const lacing = patternTexture((x, s) => {
    x.fillStyle = pink; x.fillRect(0, 0, s, s);
    x.strokeStyle = 'rgba(170,70,110,0.45)'; x.lineWidth = 3;
    for (const dx of [0.12, 0.25, 0.75, 0.88]) { x.beginPath(); x.moveTo(dx * s, 0); x.lineTo(dx * s, s); x.stroke(); }
    x.fillStyle = 'rgba(255,255,255,0.85)'; x.fillRect(s * 0.44, 0, s * 0.12, s);
    x.strokeStyle = '#d9547f'; x.lineWidth = 4;
    for (let y = 0; y < s; y += s / 8) { x.beginPath(); x.moveTo(s * 0.45, y); x.lineTo(s * 0.55, y + s / 8); x.moveTo(s * 0.55, y); x.lineTo(s * 0.45, y + s / 8); x.stroke(); }
  }, 256, [1, 1]);
  lacing.wrapS = THREE.ClampToEdgeWrapping;
  lacing.repeat.set(4, 1);
  lacing.offset.set(-1.5, 0);
  cut(ctx, 'tights', { parts: ['torso'], y: [0.9, 1.215] }, fabric('#ffffff', { map: lacing }),
    { offset: 0.007, uv: cylUV(0, 0, 6) });
  torsoTrim(ctx, 1.205, { len: 0.022, flare: 1.08, scallop: 26, bone: 'spine_03', pad: 0.007 });
  torsoTrim(ctx, 0.905, { len: 0.03, flare: 1.15, scallop: 28, bone: 'spine_01', pad: 0.007 });
  front(ctx, 1.19, bow(0.05, fabric('#e0567f')), { out: 0.008 });
  const t = alongLimb(body, 'upperarm');
  cut(ctx, 'tights', { parts: ['upperArm'], clip: [{ f: t, min: 0.12, max: 0.5 }] }, fabric('#fff4f8'),
    { offset: (i) => 0.006 + 0.018 * Math.sin(Math.PI * (t(i) - 0.12) / 0.38) });
  for (const s of sides) trim(ctx, 'upperarm_' + s, ring(body, 'upperarm_' + s, 0.48), { len: 0.018, scallop: 14, pad: 0.006 });
}

// --- Bottoms ---------------------------------------------------------------

function shorts(ctx) {
  const { body } = ctx;
  const denim = fabric('#a9c1ec');
  cut(ctx, 'tights', { parts: ['torso', 'thigh'], y: [0.6, 0.965] }, denim,
    { offset: (i) => 0.004 + (BONES.thigh.includes(body.mainBone(i)) ? Math.max(0, 0.8 - body.restY(i)) * 0.06 : 0) });
  for (const s of sides) {
    const t = 1 - (0.6 + 0.012 - 0.48) / (0.84 - 0.48); // thigh fraction near the hem
    trim(ctx, 'thigh_' + s, ring(body, 'thigh_' + s, t, 0.05), { len: 0.022, scallop: 14, flare: 1.08, pad: 0.012, color: '#fff8f2' });
  }
  const f = flower(0.035, fabric('#ff8fb8', { outline: 0.0012 }), fabric('#fff1a8', { outline: 0 }));
  const r = ring(body, 'thigh_l', 0.6);
  f.lookAt(new THREE.Vector3(0.3, 0, 1));
  ctx.on('thigh_l', f, r.center.clone().add(new THREE.Vector3(0.02, 0, r.radius + 0.012)));
}

// Skirt shell from the helper, cut at `hem` height, flared and pleated by
// pushing vertices out along their normals.
function skirtShell(ctx, mat, { hem, flare, pleats = 0, pleatDepth = 0, waves = 0, waveAmp = 0, phase = 0, uv }) {
  const { body } = ctx;
  const top = 0.95;
  const offset = (i) => {
    const p = body.base, x = p[i * 3], y = p[i * 3 + 1], z = p[i * 3 + 2];
    const d = Math.max(0, top - y) / (top - hem);
    const a = Math.atan2(x, z);
    let o = 0.006 + flare * Math.pow(d, 1.3);
    if (pleats) o += pleatDepth * (0.3 + d) * Math.abs(((pleats * a) / Math.PI) % 2 - 1);
    if (waves) o += waveAmp * d * d * Math.sin(waves * a + phase);
    return o;
  };
  return cut(ctx, 'skirt', { y: [hem, 2] }, mat, { offset, uv });
}

function pleated(ctx) {
  const { body } = ctx;
  const plaid = patternTexture((x, s) => {
    x.fillStyle = '#f59ac0'; x.fillRect(0, 0, s, s);
    x.globalAlpha = 0.35; x.fillStyle = '#c94f86';
    x.fillRect(0, s * 0.4, s, s * 0.22); x.fillRect(s * 0.4, 0, s * 0.22, s);
    x.globalAlpha = 0.9; x.fillStyle = '#fff';
    x.fillRect(0, s * 0.5, s, 3); x.fillRect(s * 0.5, 0, 3, s);
  }, 128, [12, 1]);
  ctx.lining('#e97fae');
  cut(ctx, 'tights', { parts: ['torso'], y: [0.88, 0.965] }, fabric('#e97fae'), { offset: 0.005 });
  skirtShell(ctx, fabric('#ffffff', { map: plaid, side: DS }), { hem: 0.6, flare: 0.07, pleats: 18, pleatDepth: 0.012, uv: cylUV(0, 0, 10) });
}

function tutu(ctx) {
  const { body } = ctx;
  ctx.lining('#ffffff');
  cut(ctx, 'tights', { parts: ['torso'], y: [0.86, 0.965] }, fabric('#ffffff'), { offset: 0.005 });
  [['#ffffff', 0.64, 0.13], ['#bff0e1', 0.68, 0.115], ['#ffc1d9', 0.72, 0.1]].forEach(([c, hem, flare], k) => {
    skirtShell(ctx, frill(c), { hem, flare, waves: 18 + k * 3, waveAmp: 0.018, phase: k * 1.3 });
  });
  const b = bow(0.06, fabric('#ff8fb8'));
  front(ctx, 0.93, b, { bone: 'spine_01', x: 0.06, out: 0.03 });
}

// --- Shoes -----------------------------------------------------------------

const footRule = (body, maxY) => ({ parts: ['foot', 'calf'], y: [-1, maxY] });

function catSlippers(ctx) {
  const { body } = ctx;
  cut(ctx, 'tights', footRule(body, 0.11), fabric('#2a2630'), { offset: (i) => 0.008 + Math.max(0, 0.06 - body.restY(i)) * 0.08 });
  const dark = fabric('#2a2630'), pinkM = fabric('#ffb3cb', { outline: 0 }), white = fabric('#ffffff', { outline: 0 });
  for (const s of sides) {
    const ball = body.joint('ball_' + s);
    for (const ex of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.026, 4), dark);
      ear.rotation.set(-0.25, Math.PI / 4, ex * -0.35);
      ctx.on('ball_' + s, ear, ball.clone().add(new THREE.Vector3(ex * 0.022, 0.04, -0.035)));
      const inner = new THREE.Mesh(new THREE.ConeGeometry(0.007, 0.014, 4), pinkM);
      inner.rotation.copy(ear.rotation);
      ctx.on('ball_' + s, inner, ball.clone().add(new THREE.Vector3(ex * 0.022, 0.038, -0.029)));
      const eye = new THREE.Mesh(blob(0.008, 0.01, 0.004, { e: 1, ws: 8, hs: 6 }), white);
      ctx.on('ball_' + s, eye, ball.clone().add(new THREE.Vector3(ex * 0.012, 0.03, 0.01)));
    }
    const nose = new THREE.Mesh(blob(0.007, 0.005, 0.004, { e: 1, ws: 8, hs: 6 }), pinkM);
    ctx.on('ball_' + s, nose, ball.clone().add(new THREE.Vector3(0, 0.024, 0.018)));
  }
}

function maryJanes(ctx) {
  const { body } = ctx;
  cut(ctx, 'tights', { parts: ['foot', 'calf'], y: [-1, 0.36] }, fabric('#fffafc'), { offset: 0.003 });
  cut(ctx, 'tights', footRule(body, 0.045), fabric('#ffffff'), { offset: 0.007 });
  cut(ctx, 'tights', footRule(body, 0.012), fabric('#ff9cc4'), { offset: 0.009 });
  const pink = fabric('#ff9cc4');
  for (const s of sides) {
    const f = body.joint('foot_' + s);
    const strap = new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.005, 6, 24, Math.PI), pink);
    strap.scale.set(1, 0.75, 1);
    ctx.on('foot_' + s, strap, f.clone().add(new THREE.Vector3(0, -0.03, 0.035)));
    const b = bow(0.03, pink, { tails: false });
    b.rotation.x = -0.9;
    ctx.on('ball_' + s, b, body.joint('ball_' + s).add(new THREE.Vector3(0, 0.03, 0.02)));
    trim(ctx, 'calf_' + s, ring(body, 'calf_' + s, 0.32), { len: 0.022, waves: 10, amp: 0.18, color: '#fffafc', pad: 0.002 });
  }
}

function platformBoots(ctx) {
  const { body } = ctx;
  ctx.lift(0.035);
  cut(ctx, 'tights', { parts: ['foot', 'calf'], y: [-1, 0.4] }, fabric('#ff9fc6'), { offset: 0.006 });
  const deep = fabric('#e0699b'), fur = fabric('#fff7fb');
  for (const s of sides) {
    const f = body.joint('foot_' + s), ball = body.joint('ball_' + s);
    const sole = new THREE.Mesh(blob(0.1, 0.045, 0.27, { e: 0.35 }), deep);
    const mid = f.clone().lerp(ball, 0.5);
    mid.y = -0.012;
    sole.rotation.y = Math.atan2(ball.x - f.x, ball.z - f.z);
    ctx.on('foot_' + s, sole, mid);
    const r = ring(body, 'calf_' + s, 0.26);
    const cuff = new THREE.Mesh(new THREE.TorusGeometry(r.radius + 0.012, 0.016, 10, 32), fur);
    cuff.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), r.dir);
    ctx.on('calf_' + s, cuff, r.center);
  }
}

export const TOPS = [
  { id: 'tee', name: 'Cutie Tee', swatch: '#cdb0ec', build: tee },
  { id: 'blouse', name: 'Frilly Blouse', swatch: '#fffdfd', build: blouse },
  { id: 'corset', name: 'Lace Corset', swatch: '#f7b3c8', build: corset },
];
for (const t of TOPS) { const b = t.build; t.build = (ctx) => { ctx.hide('under-top'); b(ctx); }; }

export const BOTTOMS = [
  { id: 'shorts', name: 'Lace Shorts', swatch: '#a9c1ec', build: shorts },
  { id: 'pleated', name: 'Plaid Skirt', swatch: '#f59ac0', build: pleated },
  { id: 'tutu', name: 'Tulle Skirt', swatch: '#bff0e1', build: tutu },
];

export const SHOES = [
  { id: 'cats', name: 'Kitty Slippers', swatch: '#2a2630', build: catSlippers },
  { id: 'maryjanes', name: 'Mary Janes', swatch: '#fffafc', build: maryJanes },
  { id: 'boots', name: 'Platform Boots', swatch: '#ff9fc6', build: platformBoots },
];

