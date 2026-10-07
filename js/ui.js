import { SLOTS, DEFAULT_LOOK, randomLook } from './outfit.js';
import { HAIR_COLORS } from './items/hair.js';
import { SKIN_TONES, EYE_COLORS } from './avatar.js';
import { POSES } from './poses.js';

const TABS = [
  { id: 'body', name: 'Body', emoji: '🎚️' },
  { id: 'hair', name: 'Hair', emoji: '💇‍♀️' },
  { id: 'top', name: 'Tops', emoji: '👚' },
  { id: 'bottom', name: 'Bottoms', emoji: '👗' },
  { id: 'shoes', name: 'Shoes', emoji: '👟' },
  { id: 'acc', name: 'Extras', emoji: '🎀' },
  { id: 'pose', name: 'Poses', emoji: '💃' },
  { id: 'looks', name: 'Outfits', emoji: '⭐' },
];

// Storage can be missing or throw (private mode, blocked site data); the app
// works without it and simply forgets on reload.
const store = {
  get(k, fallback) {
    try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
  },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } },
};

const h = (tag, attrs = {}, ...kids) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'on') for (const [ev, fn] of Object.entries(v)) el.addEventListener(ev, fn);
    else if (k === 'class') el.className = v;
    else if (k === 'style') el.style.cssText = v;
    else el.setAttribute(k, v);
  }
  for (const kid of kids.flat()) if (kid != null) el.append(kid);
  return el;
};

// Height slider reads in centimeters (the body is 161 cm at 0).
const heightLabel = (v) => `${Math.round(161 + (v > 0 ? v * 19.5 : v * 11))} cm`;

export function initUI(app) {
  const { outfit, poser, stage } = app;
  const tabsEl = document.getElementById('tabs');
  const panel = document.getElementById('panel');
  const countEl = document.getElementById('count');
  const nameEl = document.getElementById('name');
  const toastEl = h('div', { class: 'toast' });
  document.body.append(toastEl);

  let tab = store.get('dressup.tab', 'body');
  if (!TABS.some((t) => t.id === tab)) tab = 'body';
  let backdrop = store.get('dressup.backdrop', 'meadow');
  nameEl.value = store.get('dressup.name', 'My');

  const save = () => store.set('dressup.look', outfit.look);
  const toast = (msg) => {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toast.t);
    toast.t = setTimeout(() => toastEl.classList.remove('show'), 1600);
  };
  const updateCount = () => { countEl.textContent = `Total (${outfit.count()} items)`; };
  const sizeName = () => { nameEl.style.width = Math.max(2, nameEl.value.length + 0.5) + 'ch'; };

  function applyLook(look) {
    outfit.apply(look);
    poser.set(outfit.look.pose);
    save();
    updateCount();
    render();
  }

  function setSlot(slot, id) {
    if (slot === 'pose') { outfit.look.pose = id; poser.set(id); }
    else outfit.set(slot, id);
    save();
    updateCount();
    render();
  }

  function card({ label, img, emoji, swatch, pressed, onClick, multi }) {
    const thumb = h('div', { class: 'thumb' });
    if (img) thumb.append(h('img', { alt: '', src: img, loading: 'lazy' }));
    else if (swatch) thumb.append(h('span', { class: 'swatch', style: `background:${swatch}` }));
    else thumb.textContent = emoji ?? '';
    return h('button', { class: 'card', 'aria-pressed': String(!!pressed), on: { click: onClick } },
      thumb, h('div', { class: 'label' }, label), multi ? h('div', { class: 'check' }, '✓') : null);
  }

  function itemGrid(slot) {
    const def = SLOTS[slot], L = outfit.look;
    const grid = h('div', { class: 'grid' });
    if (def.none) grid.append(card({ label: 'None', emoji: '🚫', pressed: !L[slot], onClick: () => setSlot(slot, null) }));
    for (const it of def.items) {
      const pressed = def.multi ? L.acc.includes(it.id) : L[slot] === it.id;
      grid.append(card({
        label: it.name,
        img: app.thumbs.get(slot, it.id, L),
        swatch: it.swatch ?? it.root,
        pressed, multi: def.multi,
        onClick: () => setSlot(slot, it.id),
      }));
    }
    return grid;
  }

  function chips(list, current, onPick, cls = () => '') {
    return h('div', { class: 'chips' }, list.map(({ id, color, name }) =>
      h('button', {
        class: 'chip ' + cls(id), title: name, 'aria-label': name, 'aria-pressed': String(current === id),
        style: color ? `background:${color}` : '', on: { click: () => onPick(id) },
      })));
  }

  const views = {
    hair: () => [
      itemGrid('hair'),
      h('div', { class: 'section-label' }, 'Hair color'),
      chips(HAIR_COLORS.map((c) => ({ ...c, color: c.id === 'natural' ? '' : c.id })), outfit.look.hairColor,
        (id) => setSlot('hairColor', id), (id) => (id === 'natural' ? 'natural' : '')),
    ],
    top: () => [itemGrid('top')],
    bottom: () => [itemGrid('bottom')],
    shoes: () => [itemGrid('shoes')],
    acc: () => [h('div', { class: 'section-label' }, 'Pick as many as you like'), itemGrid('acc')],
    body: () => [
      h('div', { class: 'sliders' }, app.body.meta.sliders.map((sl) => {
        const val = h('span', { class: 'val' });
        const show = (v) => { val.textContent = sl.id === 'height' ? heightLabel(v) : (v > 0 ? '+' : '') + Math.round(v * 100); };
        const input = h('input', {
          type: 'range', min: '-1', max: '1', step: '0.01', value: String(outfit.look.body[sl.id] ?? 0), 'aria-label': sl.name,
          on: {
            input: (e) => { outfit.setBody(sl.id, +e.target.value); show(+e.target.value); },
            change: (e) => { outfit.setBody(sl.id, +e.target.value, true); save(); },
            dblclick: (e) => { e.target.value = 0; outfit.setBody(sl.id, 0, true); show(0); save(); },
          },
        });
        show(outfit.look.body[sl.id] ?? 0);
        return h('label', { class: 'slider' }, h('span', { class: 'name' }, sl.name), input, val);
      })),
      h('div', { class: 'section-label' }, 'Skin tone'),
      chips(SKIN_TONES.map((c) => ({ id: c, color: c, name: c })), outfit.look.skin, (id) => setSlot('skin', id)),
      h('div', { class: 'section-label' }, 'Eye color'),
      chips(EYE_COLORS.map((c) => ({ id: c, color: c, name: c })), outfit.look.eyes, (id) => setSlot('eyes', id)),
      h('div', { class: 'row-end' }, h('button', { class: 'btn', on: { click: () => { for (const k of Object.keys(outfit.look.body)) outfit.setBody(k, 0); outfit.refit(); save(); render(); } } }, 'Reset body')),
    ],
    pose: () => [h('div', { class: 'grid' }, POSES.map((p) => card({
      label: p.name, emoji: p.icon, pressed: outfit.look.pose === p.id, onClick: () => setSlot('pose', p.id),
    })))],
    looks: () => {
      const slots = store.get('dressup.slots', [null, null, null]);
      const describe = (l) => [l.hair, l.top, l.bottom, l.shoes].filter(Boolean).join(' · ');
      return [
        h('div', { class: 'looks' },
          slots.map((l, i) => h('div', { class: 'look-row' },
            h('div', { class: 'meta' }, h('b', {}, `Outfit ${i + 1}`), h('span', {}, l ? describe(l) : 'Empty')),
            h('button', { class: 'btn', on: { click: () => { slots[i] = structuredClone(outfit.look); store.set('dressup.slots', slots); toast(`Saved to Outfit ${i + 1}`); render(); } } }, 'Save'),
            l ? h('button', { class: 'btn primary', on: { click: () => { applyLook(l); toast(`Wearing Outfit ${i + 1}`); } } }, 'Wear') : null,
          )),
          h('div', { class: 'look-row' },
            h('div', { class: 'meta' }, h('b', {}, 'Start over'), h('span', {}, 'Back to the default look')),
            h('button', { class: 'btn', on: { click: () => applyLook(DEFAULT_LOOK) } }, 'Reset'),
          ),
        ),
      ];
    },
  };

  function render() {
    tabsEl.replaceChildren(...TABS.map((t) => h('button', {
      class: 'tab', role: 'tab', 'aria-selected': String(t.id === tab),
      on: { click: () => { tab = t.id; store.set('dressup.tab', tab); render(); panel.scrollTop = 0; } },
    }, h('span', { class: 'emoji' }, t.emoji), t.name)));
    panel.replaceChildren(...views[tab]());
  }

  function setBackdrop(name) {
    backdrop = name;
    stage.set(name);
    document.getElementById('btn-backdrop').textContent = name === 'meadow' ? '🌸' : '🌙';
    store.set('dressup.backdrop', name);
  }

  document.getElementById('btn-random').onclick = () => { applyLook(randomLook(outfit.look.body)); toast('Surprise outfit!'); };
  document.getElementById('btn-backdrop').onclick = () => setBackdrop(backdrop === 'meadow' ? 'studio' : 'meadow');
  document.getElementById('btn-shot').onclick = () => { app.screenshot(nameEl.value.trim()); toast('Picture saved'); };
  nameEl.addEventListener('input', () => { sizeName(); store.set('dressup.name', nameEl.value); });

  // Re-render the open tab as item pictures arrive.
  let redraw = 0;
  app.thumbs.onReady = () => { if (!SLOTS[tab]) return; cancelAnimationFrame(redraw); redraw = requestAnimationFrame(() => { const top = panel.scrollTop; render(); panel.scrollTop = top; }); };

  setBackdrop(backdrop);
  sizeName();
  applyLook(store.get('dressup.look', DEFAULT_LOOK));
  app.ui = { setSlot, applyLook, setBackdrop, setTab: (t) => { tab = t; render(); } };
}
