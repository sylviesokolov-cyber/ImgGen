# ImgGen

A single static page that turns a prompt into an image using your own
OpenRouter key. No build step, no server, no account — open the page,
paste a key, generate.

## Features

- **Model picker with live pricing** — the model list and its per-image
  prices are fetched from OpenRouter at runtime, so they don't go stale.
  Falls back to a bundled list when offline.
- **Image context** — attach up to 4 reference images and the prompt
  becomes an edit/composition instruction instead of a fresh generation.
  Any result can be fed straight back in with **Edit**, which is how you
  iterate on one image across several rounds.
- **Aspect ratio** — optional; leave on Auto to take the model's default.
- **Library** — every generation is kept on-device with its prompt,
  model, reference count, cost and timestamp. Save, share, re-roll,
  reuse the prompt, or delete.
- **Cost visibility** — the Generate button shows the price before you
  tap it, and each stored image records what it actually cost.

## How it works

- Calls `POST /api/v1/images` on OpenRouter directly from your browser,
  with `{model, prompt}` plus `aspect_ratio` and `input_references` when
  you've set them.
- Your API key is kept in `localStorage` on this device and sent nowhere
  but `openrouter.ai`.
- Images are stored in **IndexedDB**, not `localStorage` — the latter caps
  out near 5MB, which base64 images exhaust in about a dozen generations.

## Setup (from a phone, no PC needed)

1. On GitHub, open this repo → **Settings** → **Pages**.
2. Set **Source: Deploy from a branch**, pick `main` and **/ (root)**, Save.
3. Open the URL GitHub gives you (`https://<user>.github.io/imggen/`),
   go to Settings in the app, paste your
   [OpenRouter key](https://openrouter.ai/keys).
4. Optional: browser menu → **Add to Home screen** for an app icon.

Pushing a change to `index.html` updates the live page within a minute or
two. No rebuild, no reinstall.

## Model availability

Models are region-gated by their providers, not by this app. Meta's Muse
Image in particular is in a narrow early rollout (US and a handful of
markets) and returns *"not available in your region"* elsewhere — that's
Meta's restriction and no client can work around it. The Google Gemini
image models (Nano Banana 2 and family) are broadly available and are the
default here.

## Known limits

- **Storage is per-browser and per-device.** Nothing syncs. Clearing the
  site's data erases the library, so save anything you care about.
- Generation runs in the page: navigating away mid-request loses it.
- No queue — one image at a time.
- Whatever a model will or won't render is its provider's content policy.
  This app adds no filtering of its own and can remove none.
