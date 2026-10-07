import * as THREE from 'three';
import { OrbitControls } from 'three/addons/OrbitControls.js';
import { OutlineEffect } from 'three/addons/OutlineEffect.js';
import { loadBody } from './body.js';
import { Avatar } from './avatar.js';
import { Poser } from './poses.js';
import { Outfit } from './outfit.js';
import { setupStage } from './scene.js';
import { initUI } from './ui.js';
import { Thumbnailer } from './thumbs.js';

const canvas = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
const effect = new OutlineEffect(renderer, { defaultThickness: 0.003, defaultColor: [0.16, 0.11, 0.17] });

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(26, 1, 0.05, 80);
camera.position.set(0.9, 1.15, 4.3);
const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 0.86, 0);
controls.enablePan = false;
controls.enableDamping = true;
controls.minDistance = 0.5;
controls.maxDistance = 7;
controls.maxPolarAngle = Math.PI * 0.55;
controls.update();

function resize() {
  const { clientWidth: w, clientHeight: h } = canvas.parentElement;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  // Keep the whole body in frame on tall, narrow screens.
  camera.fov = camera.aspect < 0.7 ? 26 * Math.min(1.6, 0.7 / camera.aspect) : 26;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(canvas.parentElement);
resize();

const stage = setupStage(scene);
const body = await loadBody();
const avatar = new Avatar(body);
scene.add(body.root);
const poser = new Poser(body);
const outfit = new Outfit(avatar);

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.1), t = clock.elapsedTime;
  poser.extraY = outfit.lift;
  poser.update(dt, t);
  stage.tick(t);
  controls.update();
  effect.render(scene, camera);
});

function screenshot(name) {
  effect.render(scene, camera);
  canvas.toBlob((blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${name || 'avatar'}-${Date.now()}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }, 'image/png');
}

const app = { body, avatar, poser, outfit, stage, screenshot, renderer, scene, camera, controls };
app.thumbs = new Thumbnailer();
initUI(app);
document.getElementById('loading').hidden = true;
window.__app = app;
