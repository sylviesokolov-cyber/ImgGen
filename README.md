# Dress Up Studio

A 3D anime-style dress-up game that runs in the browser — phone or desktop,
no install, no account. Shape the body with sliders, try on clothes, pick a
pose, and save a picture.

## What's in it

- **Body sliders:** height (150–180 cm), leg length, bust, waist, hips, plus
  skin tone and eye color. Clothes refit to every slider value.
- **Hair:** Sakura Long (with a side braid), Mint Twin Tails, Midnight Waves —
  each in its own colors or any of 8 dye colors.
- **Tops:** Cutie Tee, Frilly Blouse, Lace Corset
- **Bottoms:** Lace Shorts, Plaid Skirt, Tulle Skirt
- **Shoes:** Kitty Slippers, Mary Janes with frilly socks, Platform Boots
- **Extras (wear any mix):** Big Bow, Flower Headband, Kitty Ears, Cupcake Clip
- **Poses:** Stand, Hands on hips, Wave, Peace, Sit, Kneel
- **Outfits:** save three looks and switch between them, 🎲 for a random
  outfit, 📷 to download a picture, 🌙/🌸 to switch between the night meadow
  and the pastel studio. Drag to turn the camera, pinch or scroll to zoom.

The body always wears a plain crop top and shorts underneath; skirts line
them in their own color.

## Put it online (from a phone, no PC needed)

1. On GitHub, open this repo → **Settings** → **Pages**.
2. Set **Source: Deploy from a branch**, pick `main` and **/ (root)**, Save.
3. Open the URL GitHub gives you (`https://<user>.github.io/<repo>/`).
4. Optional: browser menu → **Add to Home screen** for an app icon.

Pushing to `main` updates the live page within a minute or two.

To run it locally instead, serve the folder (ES modules don't load from
`file://`), e.g. `python3 -m http.server` and open <http://localhost:8000>.

## How it's made

- **Body:** the [MakeHuman](http://www.makehumancommunity.org/) base mesh,
  morph targets, "game engine" skeleton and skin weights — all CC0 (public
  domain). `tools/build_body.py` bakes a 25-year-old female body with an
  anime-leaning face, and exports the five slider morphs, skeleton, and
  MakeHuman's fitted-suit / skirt / hair helper shells into `assets/body.bin`
  + `assets/body.json` (~1.5 MB). Re-run it only to change the baked shape:

  ```sh
  git clone --depth 1 https://github.com/makehumancommunity/mpfb2
  python3 tools/build_body.py mpfb2/src/mpfb/data
  ```

- **Clothes** are cut out of those helper shells (`js/items/garment.js`):
  each piece keeps the triangles moved by certain bones and is clipped
  exactly at its hem lines, then pushed out a little along the surface. Because
  they're part of the morphed, skinned body, they follow sliders and poses.
  Ruffles, lace, bows and soles are small rigid meshes riding on bones.
- **Face:** eyebrows, lashes, blush and lips are painted into the body's own
  texture by projecting 3D landmark positions onto the face
  (`js/textures.js`); the eyes are spheres with a painted anime iris.
- **Poses** are written as limb directions (`js/poses.js`), so they hold up
  for every body shape.
- **Rendering:** [three.js](https://threejs.org/) (MIT), vendored in
  `vendor/`, with cel shading and outlines.

## Files

```
index.html, css/style.css     page and layout
js/main.js                    renderer, camera, render loop
js/body.js                    loads the baked body, sliders, skeleton
js/avatar.js                  skin, face, eyes
js/poses.js                   poses and blending
js/outfit.js                  wearing/removing items, saving looks
js/items/                     hair, clothes, accessories
js/ui.js, js/thumbs.js        wardrobe panel and item pictures
js/scene.js                   backdrops and lights
tools/build_body.py           MakeHuman → assets/ converter
```

## Known limits

- Saved outfits and settings live in this browser only (`localStorage`).
- Hair and long skirts don't simulate cloth; very wide poses can clip.
- Thumbnails are rendered on first open of each tab, so they pop in.

## Credits and licenses

- Body mesh, targets, rig and weights: MakeHuman, CC0 1.0 — see
  `assets/LICENSE-MakeHuman.md`.
- three.js: MIT — see `vendor/three-LICENSE`.
