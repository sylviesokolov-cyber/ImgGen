import * as THREE from 'three';

// Three-step ramp: shadow, mid, lit. Nearest filtering keeps the bands crisp.
const ramps = {};
function gradientMap(steps = [120, 195, 255]) {
  const k = steps.join();
  if (!ramps[k]) {
    const r = new THREE.DataTexture(new Uint8Array(steps), steps.length, 1, THREE.RedFormat);
    r.minFilter = r.magFilter = THREE.NearestFilter;
    r.generateMipmaps = false;
    r.needsUpdate = true;
    ramps[k] = r;
  }
  return ramps[k];
}

const OUTLINE = [0.16, 0.11, 0.17];

// Cel-shaded material with an inverted-hull outline (drawn by OutlineEffect).
// `outline: 0` hides the outline, a number sets its thickness.
export function toon(color, opts = {}) {
  const { outline = 0.0035, outlineColor = OUTLINE, ramp, ...rest } = opts;
  const m = new THREE.MeshToonMaterial({ color, gradientMap: gradientMap(ramp), ...rest });
  m.userData.outlineParameters = outline
    ? { thickness: outline, color: outlineColor, alpha: 1, visible: true }
    : { visible: false };
  return m;
}

export function canvasTexture(canvas) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export function lighten(hex, amt) {
  return '#' + new THREE.Color(hex).lerp(new THREE.Color('#ffffff'), amt).getHexString();
}

export function darken(hex, amt) {
  return '#' + new THREE.Color(hex).lerp(new THREE.Color('#000000'), amt).getHexString();
}
