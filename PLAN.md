# ImgGen — uncensored text-to-image on Android

**Status: plan only. No code written.**

Goal: type a prompt, get an image, no filtering, no parameters to fiddle with.

## Start here

**The OpenRouter plan is dead.** Nano Banana 2 and Muse Image are filtered server-side by Google and Meta. OpenRouter is a router, not a filter — it cannot turn off someone else's moderation, and neither can any app built on top of it. No parameter, header, or prompt trick changes this.

Unfiltered output comes from exactly one place: **open-weight models** (FLUX.1-dev, SDXL, **Chroma**, Qwen-Image, Z-Image) running somewhere that doesn't wrap them in a safety checker.

## Three paths, cheapest first

| | Path | Build effort | Cost | Private? |
|---|---|---|---|---|
| **A** | **Local Dream** — on-device, Snapdragon NPU, SDXL on 8 Gen 3+ | **none** | free | ✅ fully |
| **B** | **Your ComfyUI + an existing phone client** (Comfy Portal, ComfyChair) over Tailscale | **none** | free w/ own GPU | ✅ fully |
| **C** | **Build a one-field app** over a hosted uncensored API (Chroma ~$0.015/img, Novita ~$0.0015/img) | 1.5–2 weeks | per image | ❌ host logs prompts |

**Try A, then B, and stop as soon as one works.** Both require writing zero code. Only build C if you've tried both and specifically want hosted speed with a one-field UI on any phone.

## Docs

- **[docs/decision-uncensored.md](docs/decision-uncensored.md)** — why hosted frontier models can't do this, what actually can, the three paths compared, provider pricing, and the provider-independence rule
- **[docs/build-plan.md](docs/build-plan.md)** — if you build Path C: the single-screen design, architecture, phases, distribution
- **[docs/archive/](docs/archive/)** — the superseded OpenRouter deep-control plan

## If you build it

One screen: prompt field, three aspect chips, generate button, image. Swipe for history, pull to re-roll. Seed/steps/guidance/negative are chosen per model, recorded, and never shown.

Carry three things over from the archived plan and drop the rest: **WorkManager** (renders outlive the screen being off), **stream base64 to disk** (or OOM), and **every provider behind one interface from commit one** (permissive hosts change policy; swapping should be a new file, not a refactor).

**Next step:** install Local Dream. Ten minutes, and it answers whether you need to build anything at all.
