# ImgGen

Prompt in, image out, stored on your phone. One HTML file, no build step,
runs entirely in your browser.

## How it works

- You paste your own [OpenRouter](https://openrouter.ai/keys) API key into
  Settings. It's saved only in your phone's browser (`localStorage`) and is
  sent to nowhere but `openrouter.ai`.
- Generate calls OpenRouter's chat-completions endpoint with the image
  output modality, model `meta/muse-image` (Muse Image) by default —
  editable under Settings → Advanced if the slug ever changes.
- Every result is kept in History (also `localStorage`) and can be saved to
  your phone's Downloads from either the Generate screen or the History
  viewer.

No parameters beyond the prompt — Muse Image's own defaults decide
everything else.

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
- Whatever Muse Image will or won't render is entirely up to OpenRouter/
  Meta's own content policy — this app has no filtering of its own to add
  or remove.
