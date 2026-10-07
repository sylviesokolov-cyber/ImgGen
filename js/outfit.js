import { HAIR, HAIR_COLORS, buildHair } from './items/hair.js';
import { TOPS, BOTTOMS, SHOES, UNDERLAYER } from './items/clothes.js';
import { ACCESSORIES } from './items/acc.js';
import { POSES } from './poses.js';
import { SKIN_TONES, EYE_COLORS } from './avatar.js';

export const SLOTS = {
  hair: { items: HAIR },
  top: { items: TOPS, none: true },
  bottom: { items: BOTTOMS, none: true },
  shoes: { items: SHOES, none: true },
  acc: { items: ACCESSORIES, multi: true },
};

export const DEFAULT_LOOK = {
  hair: 'straight', hairColor: 'natural', skin: SKIN_TONES[1], eyes: EYE_COLORS[0],
  top: 'tee', bottom: 'shorts', shoes: 'cats', acc: ['headband'], pose: 'stand',
  body: { height: 0, legs: 0, bust: 0, waist: 0, hips: 0 },
};

const pick = (a) => a[Math.floor(Math.random() * a.length)];

export function randomLook(keepBody) {
  return {
    hair: pick(HAIR).id,
    hairColor: Math.random() < 0.5 ? 'natural' : pick(HAIR_COLORS).id,
    skin: pick(SKIN_TONES), eyes: pick(EYE_COLORS),
    top: pick(TOPS).id, bottom: pick(BOTTOMS).id, shoes: pick(SHOES).id,
    acc: ACCESSORIES.filter(() => Math.random() < 0.3).map((a) => a.id),
    pose: pick(POSES).id,
    body: keepBody,
  };
}

function disposeObj(obj, body) {
  obj.traverse((o) => {
    if (!o.isMesh) return;
    if (o.isSkinnedMesh) body.release(o.geometry); else o.geometry.dispose();
    for (const m of [].concat(o.material)) { m.map?.dispose(); m.dispose(); }
  });
}

// Wears items on the avatar. Items are rebuilt when body sliders change so
// rigid trims (ruffles, bows) re-fit; the skinned pieces refit themselves.
export class Outfit {
  constructor(avatar) {
    this.avatar = avatar;
    this.body = avatar.body;
    this.worn = new Map(); // key -> { build, parts: Object3D[], lift }
    this.look = structuredClone(DEFAULT_LOOK);
    this._wear('under', UNDERLAYER);
  }

  _ctx(rec) {
    const body = this.body, avatar = this.avatar;
    const ctx = {
      body, avatar, look: this.look,
      add(obj) { body.root.add(obj); rec.parts.push(obj); return obj; },
      // Rigid piece riding on a bone; `at` is its rest-pose world position.
      on(bone, obj, at) {
        if (at) obj.position.copy(at).sub(body.joint(bone));
        body.bone[bone].add(obj);
        rec.parts.push(obj);
        return obj;
      },
      // Same, but `at` is in the default body's rest pose (hair and head
      // accessories are modeled once around the default head).
      onDefault(bone, obj, at) {
        obj.position.copy(at).sub(body.defaultJoint(bone));
        body.bone[bone].add(obj);
        rec.parts.push(obj);
        return obj;
      },
      lift(y) { rec.lift = y; },
      hide(what) { rec.hides.push(what); },
      // Skirts tint the underlayer shorts to match, like a built-in lining.
      lining(color) { rec.lining = color; },
    };
    return ctx;
  }

  _wear(key, build) {
    this._remove(key);
    const rec = { build, parts: [], lift: 0, hides: [], lining: null };
    build(this._ctx(rec));
    this.worn.set(key, rec);
    this._visibility();
  }

  _remove(key) {
    const rec = this.worn.get(key);
    if (!rec) return;
    for (const p of rec.parts) { p.removeFromParent(); disposeObj(p, this.body); }
    this.worn.delete(key);
    this._visibility();
  }

  // Some items replace others (e.g. tops cover the underlayer's top).
  _visibility() {
    const hidden = new Set([...this.worn.values()].flatMap((r) => r.hides));
    const under = this.worn.get('under');
    const lining = [...this.worn.values()].map((r) => r.lining).find(Boolean);
    if (under) for (const p of under.parts) {
      p.visible = !hidden.has(p.name);
      if (p.name === 'under-bottom') p.material.color.set(lining ?? '#ece4f3');
    }
  }

  refit() {
    for (const [key, rec] of [...this.worn]) this._wear(key, rec.build);
  }

  set(slot, id) {
    const L = this.look;
    if (slot === 'skin') { L.skin = id; this.avatar.setSkin(id); return; }
    if (slot === 'eyes') { L.eyes = id; this.avatar.setEyes(id); return; }
    if (slot === 'hairColor') { L.hairColor = id; return this.set('hair', L.hair); }
    if (slot === 'acc') {
      const on = L.acc.includes(id);
      L.acc = on ? L.acc.filter((a) => a !== id) : [...L.acc, id];
      if (on) this._remove('acc:' + id);
      else this._wear('acc:' + id, ACCESSORIES.find((a) => a.id === id).build);
      return;
    }
    L[slot] = id;
    if (slot === 'hair') { this._wear('hair', (ctx) => buildHair(ctx, id, L.hairColor)); return; }
    if (!id) { this._remove(slot); return; }
    this._wear(slot, SLOTS[slot].items.find((i) => i.id === id).build);
  }

  apply(look) {
    const L = { ...structuredClone(DEFAULT_LOOK), ...structuredClone(look) };
    L.body = { ...DEFAULT_LOOK.body, ...(look.body ?? {}) };
    for (const k of [...this.worn.keys()]) if (k !== 'under') this._remove(k);
    this.look = { ...L, acc: [] };
    this.body.setAll(L.body); // triggers refit of the underlayer
    this.avatar.setSkin(L.skin);
    this.avatar.setEyes(L.eyes);
    this.set('hair', L.hair);
    for (const s of ['top', 'bottom', 'shoes']) this.set(s, L[s]);
    for (const a of L.acc) this.set('acc', a);
  }

  // While dragging, skinned pieces refit live; rigid trims refit on release.
  setBody(id, v, done) {
    this.look.body[id] = v;
    this.body.set(id, v);
    if (done) this.refit();
  }

  get lift() {
    let y = 0;
    for (const r of this.worn.values()) y = Math.max(y, r.lift);
    return y;
  }

  count() {
    const L = this.look;
    return 1 + ['top', 'bottom', 'shoes'].filter((s) => L[s]).length + L.acc.length;
  }
}

