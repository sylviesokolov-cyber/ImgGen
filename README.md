# ImgGen

Prompt in, image out, stored on your phone. One HTML file, no build step,
runs entirely in your browser.

## How it works

- You paste your own [OpenRouter](https://openrouter.ai/keys) API key into
  Settings. It's saved only in your phone's browser (`localStorage`) and is
  sent to nowhere but `openrouter.ai`.
- Generate calls OpenRouter's dedicated Images endpoint (`/api/v1/images`),
  model `google/gemini-3.1-flash-image` (Nano Banana 2) by default —
  editable under Settings → Advanced.
- Every result is kept in History (also `localStorage`) and can be saved to
  your phone's Downloads from either the Generate screen or the History
  viewer.

No parameters beyond the prompt — the model's own defaults decide
everything else.

**Not Muse Image:** Meta's license for its multimodal models (Muse Image
included) excludes the EU outright — it 403s there with "not available in
your region" no matter what any app sends. That's Meta's licensing, not an
OpenRouter or app bug, and there's no client-side workaround. Switch models
in Settings → Advanced if you want to try it and aren't affected.

## Setup (from your phone, no PC needed)

1. On GitHub (mobile browser or app), open this repo → **Settings** → **Pages**.
2. Under "Build and deployment", set **Source: Deploy from a branch**, pick
   this branch and **/ (root)**, then **Save**.
3. GitHub gives you a URL like `https://<username>.github.io/ImgGen/` —
   open it in Chrome, add your API key in Settings.
4. Optional: Chrome menu → **Add to Home screen** for an app-like icon.

Every time you push a change to `index.html`, the live page updates within
a minute or two — no rebuild, no reinstall.

## Known limits

- **`localStorage` is per-browser, not synced anywhere.** Clearing site
  data or switching browsers loses your history. There's no export yet —
  worth adding if the history grows large enough to matter.
- Images are kept as base64 in `localStorage`, which most mobile browsers
  cap around 5–10MB total. A few dozen generations is fine; a long history
  will eventually need trimming (the app silently drops the oldest half if
  it hits the quota, so nothing crashes) or a move to IndexedDB.
- Whatever the chosen model will or won't render (or where it will or
  won't run) is entirely up to that model's own provider — this app has
  no filtering or region logic of its own to add or remove.
