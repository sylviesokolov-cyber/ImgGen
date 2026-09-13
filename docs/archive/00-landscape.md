# Part 0 — Does something good enough already exist (and free)?

Short answer: **for casual use, yes. For what you're asking for — deep control, your own OpenRouter key, frontier image models — no. Nothing off-the-shelf fits.**

Try the free options below for a week before writing code. If one of them satisfies you, building is a waste of a month.

## The honest survey

### A. Free, high quality, near-zero control

| App | Model | Free tier | Control depth |
|---|---|---|---|
| Google Gemini (Android) | Nano Banana family | ~100 images/day, 2048px | Prompt + conversational edit. No seed, no negatives, no batch, no params |
| Microsoft Copilot / Designer | GPT-Image / DALL·E | Daily boosts, then slow queue | Prompt + a few style presets |
| Grok (X) | Aurora / partner models | Rate-limited free | Prompt only |

These produce excellent images. They are also closed boxes: you cannot set a seed, cannot pin a provider, cannot batch, cannot see cost, cannot export structured metadata, and your gallery lives on their servers. **Quality: high. Control: near zero.**

### B. Free, deep control, older model quality (on-device)

- **Local Dream** (open source, xororz) — the strongest option in this category. Runs Stable Diffusion **locally** on Qualcomm Snapdragon NPUs (CPU/GPU fallback). Supports txt2img, img2img, inpainting, custom SD 1.5 checkpoints, LoRA, prompt weighting, textual embeddings, and Real-ESRGAN upscalers. Fully offline, zero cost, zero censorship.
- **SDAI / Stable-Diffusion-KMP** (ShiftHackZ, open source, F-Droid + Play) — client for remote A1111/SD backends *and* local execution (ONNX, MediaPipe, stable-diffusion.cpp SDXL).

**Control: excellent. Quality: SD1.5/SDXL-class, i.e. clearly behind Nano Banana 2 / Muse on prompt adherence, text rendering, and composition.** Also needs a flagship Snapdragon to be usable.

### C. BYO-OpenRouter-key image clients on Android

This is the gap. Searching the OpenRouter ecosystem (`awesome-openrouter`, the "works with OpenRouter" directory) turns up chat clients, CLI tools, and web UIs — e.g. `aporb/openrouter-image-gen` (CLI + Streamlit, txt2img/img2img/batch) — but **no mature native Android app for image generation with your own key.**

## Verdict

You want three things at once:

1. Frontier model quality (Nano Banana 2, Muse Image)
2. Deep parameter control (seed, refs, masks, batch, provider routing, cost visibility)
3. Your own API key and your own local library

Category A gives you (1). Category B gives you (2) and (3). **Nothing gives you all three.** That's a real gap, and it justifies building — as long as you accept that you're building a *power-user control surface over a hosted API*, not an image model.

### Cheap pre-build validation (do this first, ~1 hour)

Before committing to an Android build, prove the workflow matters to you:

1. Top up $5 on OpenRouter.
2. Run `curl` against `/api/v1/images` with `google/gemini-3.1-flash-image` — 20 prompts, vary seed and aspect ratio.
3. Ask yourself: did seed-locking, batch, and param control actually change my output quality, or was I just re-prompting?

If the answer is "I was just re-prompting," the Gemini app is your app and you're done. If you found yourself wanting to fork a seed, diff two providers, and keep a searchable library — build it.
