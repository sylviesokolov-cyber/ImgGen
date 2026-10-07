import * as THREE from 'three';
import { canvasTexture } from './materials.js';

// --- Face painting ---------------------------------------------------------
// The anime face is painted into the body's own UV layout. Features are
// placed in 3D (relative to the eyelid and mouth landmarks), projected along
// +Z onto the face surface, and drawn at the UVs found there — so this works
// without hand-mapping MakeHuman's UV atlas.

class FaceProjector {
  constructor(body, size) {
    this.size = size;
    const vert = body.arr('body.vert'), uv = body.arr('body.uv'), p = body.base;
    // Only vertices on the front of the head matter.
    const lm = body.meta.landmarks;
    const top = lm['head-2'][1] + 0.12, bottom = lm.mouth[1] - 0.09;
    this.pts = [];
    for (let i = 0; i < vert.length; i++) {
      const v = vert[i] * 3, y = p[v + 1], z = p[v + 2];
      if (y > bottom && y < top && z > 0.02) this.pts.push([p[v], y, z, uv[i * 2], uv[i * 2 + 1]]);
    }
  }

  // UV pixel position of the face surface in front of (x, y).
  at(x, y) {
    const near = [];
    for (const q of this.pts) {
      const d = Math.hypot(q[0] - x, q[1] - y);
      if (d < 0.006) near.push([d, q]);
    }
    if (!near.length) return null;
    const zmax = Math.max(...near.map(([, q]) => q[2]));
    let su = 0, sv = 0, sw = 0;
    for (const [d, q] of near) {
      if (q[2] < zmax - 0.004) continue;
      const w = 1 / (d + 0.0005);
      su += q[3] * w; sv += q[4] * w; sw += w;
    }
    return [(su / sw) * this.size, (1 - sv / sw) * this.size];
  }

  path(points) { return points.map(([x, y]) => this.at(x, y)).filter(Boolean); }
}

function strokePath(ctx, pts, width, color) {
  if (pts.length < 2) return;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(...pts[0]);
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
    ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
  }
  ctx.lineTo(...pts[pts.length - 1]);
  ctx.stroke();
}

// Tapered stroke: drawn as overlapping dots so the width can vary along it.
function taperPath(ctx, pts, w0, w1, color) {
  ctx.fillStyle = color;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
    const steps = Math.max(2, Math.ceil(Math.hypot(bx - ax, by - ay) / 1.5));
    for (let s = 0; s < steps; s++) {
      const t = (i + s / steps) / (pts.length - 1);
      const w = w0 + (w1 - w0) * t;
      ctx.beginPath();
      ctx.arc(ax + (bx - ax) * (s / steps), ay + (by - ay) * (s / steps), w / 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

const range = (a, b, n) => Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1));

let projector;
export function paintSkin(canvas, body, skin) {
  const S = canvas.width;
  projector ??= new FaceProjector(body, S);
  const P = projector, lm = body.meta.landmarks;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = skin;
  ctx.fillRect(0, 0, S, S);

  const px = (() => { // texture pixels per meter on the face
    const a = P.at(lm['l-upperlid'][0], lm['l-upperlid'][1] + 0.01), b = P.at(lm['l-upperlid'][0], lm['l-upperlid'][1] + 0.02);
    return a && b ? Math.hypot(a[0] - b[0], a[1] - b[1]) / 0.01 : 4000;
  })();
  const shade = new THREE.Color(skin).multiplyScalar(0.55).getStyle();

  // Parts of MakeHuman's UV layout are mirrored left/right (the eye area is),
  // others aren't. Draw the right side only where it lands somewhere new.
  const mirrored = (pts) => {
    const a = P.path(pts), b = P.path(pts.map(([x, y]) => [-x, y]));
    if (!a.length || a.length !== b.length) return false;
    return a.reduce((s, p, i) => s + Math.hypot(p[0] - b[i][0], p[1] - b[i][1]), 0) / a.length < 3;
  };
  for (const side of [1, -1]) {
    const up = lm[side > 0 ? 'l-upperlid' : 'r-upperlid'], lo = lm[side > 0 ? 'l-lowerlid' : 'r-lowerlid'];
    const cx = up[0], cy = (up[1] + lo[1]) / 2, ry = (up[1] - lo[1]) / 2 + 0.002, rx = 0.0165;
    const draw = (pts, fn) => { if (side > 0 || !mirrored(pts.map(([x, y]) => [-x, y]))) fn(P.path(pts)); };
    // blush
    draw([[cx + side * 0.008, cy - 0.03]], ([b]) => {
      if (!b) return;
      const r = 0.016 * px;
      const g = ctx.createRadialGradient(b[0], b[1], 0, b[0], b[1], r);
      g.addColorStop(0, 'rgba(255,110,140,0.42)');
      g.addColorStop(1, 'rgba(255,110,140,0)');
      ctx.fillStyle = g;
      ctx.fillRect(b[0] - r, b[1] - r, r * 2, r * 2);
    });
    // upper lash line with an outward flick
    const upper = range(-1, 1, 14).map((t) => [cx + side * t * rx, cy + ry * 1.05 * Math.sqrt(1 - t * t * 0.85) + (t > 0 ? -0.0006 : 0)]);
    upper.push([cx + side * rx * 1.22, cy + ry * 1.25], [cx + side * rx * 1.4, cy + ry * 1.55]);
    draw(upper, (p) => taperPath(ctx, p, 0.0036 * px, 0.0016 * px, '#24141c'));
    // lower lash hint
    draw(range(0.2, 0.95, 6).map((t) => [cx + side * t * rx, cy - ry * 1.05 * Math.sqrt(1 - t * t * 0.9)]),
      (p) => strokePath(ctx, p, 0.0008 * px, 'rgba(60,30,40,0.7)'));
    // brow
    const brow = range(-0.85, 1.15, 10).map((t) => [cx + side * t * rx, cy + 0.021 + 0.0028 * Math.cos((t - 0.15) * 1.3) - (t > 0.9 ? (t - 0.9) * 0.008 : 0)]);
    draw(brow, (p) => taperPath(ctx, p, 0.0024 * px, 0.001 * px, 'rgba(110,70,70,0.92)'));
  }

  // lips: soft pink with a little shine
  const my = lm.mouth[1] - 0.027;
  const lips = P.path(range(-1, 1, 12).map((t) => [t * 0.0095, my - 0.0008 * Math.cos(t * 1.6)]));
  strokePath(ctx, lips, 0.0012 * px, '#c9576d');
  const lower = P.path(range(-0.7, 0.7, 8).map((t) => [t * 0.008, my - 0.0035 - 0.0012 * Math.cos(t * 1.8)]));
  strokePath(ctx, lower, 0.0022 * px, 'rgba(240,120,140,0.55)');
  // nose tip shadow
  const nose = P.path(range(-0.5, 0.5, 4).map((t) => [t * 0.004, my + 0.019]));
  strokePath(ctx, nose, 0.0006 * px, shade);
}

// --- Eyes --------------------------------------------------------------
// SphereGeometry front (+Z) is at u = 0.25. 512x256 => ~1.4 px per degree.

export function irisTexture(color) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fbf8fa';
  ctx.fillRect(0, 0, 512, 256);
  const x = 128, y = 124, rx = 58, ry = 66;
  const dark = new THREE.Color(color).multiplyScalar(0.35).getStyle();
  const light = new THREE.Color(color).lerp(new THREE.Color('#ffffff'), 0.45).getStyle();
  const g = ctx.createLinearGradient(0, y - ry, 0, y + ry);
  g.addColorStop(0, dark);
  g.addColorStop(0.5, color);
  g.addColorStop(1, light);
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = dark; ctx.lineWidth = 4; ctx.stroke();
  ctx.fillStyle = dark;
  ctx.beginPath(); ctx.ellipse(x, y + 2, rx * 0.42, ry * 0.46, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.beginPath(); ctx.ellipse(x - 18, y - 22, 14, 17, -0.3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(x + 20, y + 26, 7, 7, 0, 0, Math.PI * 2); ctx.fill();
  return canvasTexture(c);
}

// --- Fabric prints ---------------------------------------------------------

export function patternTexture(draw, size = 256, repeat = [4, 4]) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = canvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...repeat);
  return t;
}
