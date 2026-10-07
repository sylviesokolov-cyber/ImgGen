import * as THREE from 'three';
import { toon, canvasTexture } from './materials.js';

function gradientBg(stops) {
  const c = document.createElement('canvas');
  c.width = 4; c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  stops.forEach(([o, col]) => g.addColorStop(o, col));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 256);
  return canvasTexture(c);
}

function softShadow() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(0,0,0,0.45)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(1.1, 0.9),
    new THREE.MeshBasicMaterial({ map: canvasTexture(c), transparent: true, depthWrite: false }),
  );
  m.material.userData.outlineParameters = { visible: false };
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.004;
  m.renderOrder = 1;
  return m;
}

// Seeded so the meadow looks the same every visit.
function rng(seed) {
  return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
}

const noOutline = (m) => { m.userData.outlineParameters = { visible: false }; return m; };

function meadow() {
  const g = new THREE.Group();
  const rand = rng(7);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(40, 48), noOutline(new THREE.MeshLambertMaterial({ color: '#16241a' })));
  ground.rotation.x = -Math.PI / 2;
  g.add(ground);

  // Grass: one bent, tapered blade instanced a few thousand times.
  const blade = new THREE.PlaneGeometry(0.035, 0.32, 1, 4);
  blade.translate(0, 0.16, 0);
  const bp = blade.attributes.position;
  for (let i = 0; i < bp.count; i++) {
    const y = bp.getY(i) / 0.32;
    bp.setX(i, bp.getX(i) * (1 - y * 0.9));
    bp.setZ(i, y * y * 0.08);
  }
  blade.computeVertexNormals();
  const N = 6000;
  const grass = new THREE.InstancedMesh(blade, noOutline(new THREE.MeshLambertMaterial({ color: '#ffffff', side: THREE.DoubleSide })), N);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), col = new THREE.Color();
  for (let i = 0; i < N; i++) {
    const r = 0.25 + Math.pow(rand(), 0.7) * 11, a = rand() * Math.PI * 2;
    p.set(Math.sin(a) * r, 0, Math.cos(a) * r);
    const h = r < 1.3 ? 0.25 + rand() * 0.35 : 0.6 + rand() * 1.0;
    q.setFromEuler(new THREE.Euler((rand() - 0.5) * 0.4, rand() * Math.PI * 2, (rand() - 0.5) * 0.4));
    s.set(1, h, 1);
    grass.setMatrixAt(i, m.compose(p, q, s));
    grass.setColorAt(i, col.setHSL(0.3 + rand() * 0.06, 0.45, 0.07 + rand() * 0.09));
  }
  g.add(grass);

  // Rocks and dark trees on the horizon.
  const rockMat = noOutline(new THREE.MeshLambertMaterial({ color: '#2a2e33', flatShading: true }));
  for (let i = 0; i < 9; i++) {
    const a = rand() * Math.PI * 2, r = 3.5 + rand() * 6;
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.5 + rand() * 0.9, 0), rockMat);
    rock.position.set(Math.sin(a) * r, 0.1, Math.cos(a) * r);
    rock.scale.y = 0.55;
    rock.rotation.y = rand() * 6;
    g.add(rock);
  }
  const leaf = noOutline(new THREE.MeshLambertMaterial({ color: '#13301e', flatShading: true }));
  const trunk = noOutline(new THREE.MeshLambertMaterial({ color: '#241a14' }));
  for (let i = 0; i < 22; i++) {
    const a = rand() * Math.PI * 2, r = 9 + rand() * 9;
    const t = new THREE.Group();
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 1.5, 6), trunk);
    tr.position.y = 0.75;
    t.add(tr);
    for (let k = 0; k < 3; k++) {
      const c = new THREE.Mesh(new THREE.ConeGeometry(1.5 - k * 0.35, 1.6, 7), leaf);
      c.position.y = 1.6 + k * 0.85;
      t.add(c);
    }
    t.position.set(Math.sin(a) * r, 0, Math.cos(a) * r);
    t.scale.setScalar(0.8 + rand() * 0.9);
    g.add(t);
  }

  // Fireflies.
  const fp = [];
  for (let i = 0; i < 60; i++) {
    const a = rand() * Math.PI * 2, r = 1.2 + rand() * 7;
    fp.push(Math.sin(a) * r, 0.2 + rand() * 2.2, Math.cos(a) * r);
  }
  const fg = new THREE.BufferGeometry();
  fg.setAttribute('position', new THREE.Float32BufferAttribute(fp, 3));
  const flies = new THREE.Points(fg, new THREE.PointsMaterial({ color: '#c9ff9a', size: 0.06, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
  flies.material.userData.outlineParameters = { visible: false };
  g.add(flies);
  g.userData.tick = (t) => { flies.position.y = Math.sin(t * 0.7) * 0.08; flies.rotation.y = t * 0.02; };

  return {
    group: g,
    background: gradientBg([[0, '#05080d'], [0.6, '#0b1512'], [1, '#101c15']]),
    fog: new THREE.Fog('#0b1411', 6, 22),
    hemi: ['#c8d4ff', '#30402f', 1.5],
  };
}

function studio() {
  const g = new THREE.Group();
  const floor = new THREE.Mesh(new THREE.CircleGeometry(30, 48), noOutline(new THREE.MeshLambertMaterial({ color: '#f7d9e6' })));
  floor.rotation.x = -Math.PI / 2;
  g.add(floor);
  const stage = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.95, 0.06, 48), toon('#ffffff', { outline: 0.002 }));
  stage.position.y = -0.028;
  g.add(stage);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.93, 0.025, 8, 64), toon('#ffb3cf', { outline: 0 }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.005;
  g.add(ring);
  return {
    group: g,
    background: gradientBg([[0, '#e9d7ff'], [0.55, '#ffd9ea'], [1, '#ffeef5']]),
    fog: new THREE.Fog('#ffe6f1', 8, 30),
    hemi: ['#ffffff', '#f3c6d8', 1.8],
  };
}

export const BACKDROPS = { meadow, studio };

export function setupStage(scene) {
  const hemi = new THREE.HemisphereLight('#ffffff', '#444444', 1.5);
  const key = new THREE.DirectionalLight('#fff6ee', 2.2);
  key.position.set(1.5, 3, 3);
  const rim = new THREE.DirectionalLight('#a9c4ff', 1.4);
  rim.position.set(-2, 2.5, -3);
  scene.add(hemi, key, rim, softShadow());

  const built = {};
  let current = null;
  return {
    set(name) {
      if (current) current.group.visible = false;
      current = built[name] ??= BACKDROPS[name]();
      if (!current.group.parent) scene.add(current.group);
      current.group.visible = true;
      scene.background = current.background;
      scene.fog = current.fog;
      hemi.color.set(current.hemi[0]);
      hemi.groundColor.set(current.hemi[1]);
      hemi.intensity = current.hemi[2];
    },
    tick(t) { current?.group.userData.tick?.(t); },
  };
}
