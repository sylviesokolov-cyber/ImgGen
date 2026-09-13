# Why OpenRouter + Nano Banana is a dead end for this goal

## The blocker

Filtering for hosted models happens **server-side at the model provider**, before OpenRouter ever returns a result:

```
your app  →  OpenRouter (a router, not a filter)  →  Google / Meta
                                                      ↑
                                            the refusal happens HERE
```

Nano Banana 2 is Google's. Muse Image is Meta's. Both apply their own safety policy at inference time. OpenRouter passes your request through — it has no knob to disable someone else's moderation, and neither does any app you build on top of it.

Consequences:
- **No client-side change helps.** Not a parameter, not a system prompt, not a header.
- **Prompt-wrangling is a losing game.** It degrades output quality, breaks on every model refresh, and repeated refusals are exactly the signal that gets an OpenRouter key flagged.
- **Muse Image is the worst fit of all.** It's agentic — it reasons about your prompt before rendering and invokes web search. More reasoning between you and the pixels means more places to refuse.

Also worth knowing even when a hosted model does comply: Nano Banana output carries an invisible **SynthID watermark**, and often C2PA provenance metadata.

**So: if unfiltered output is the requirement, the OpenRouter image API is the wrong dependency.** Not a limitation to work around — the wrong tool.

## What actually produces unfiltered output

Exactly one thing: **open-weight models running somewhere that doesn't filter them.** FLUX.1-dev, SDXL, Chroma, Qwen-Image and Z-Image ship with no safety checker and no prompt scanner in the weights themselves. The filtering in the products you've used is wrapper code, and the wrapper is optional when you control the runtime.

One exception to avoid: **FLUX.2 [dev]**'s licence mandates safety filtering and its reference pipeline ships NSFW and IP filters. Reach for FLUX.1-dev, SDXL, or Chroma instead.

**Chroma** (Chroma1-HD) is the notable one: 8.9B params, **Apache-2.0**, FLUX.1-schnell-based, explicitly uncensored, and good enough that it's the default recommendation for this use case.

## Three paths

### Path A — Local Dream (build nothing, ~10 minutes)

Open source, on-device, Snapdragon NPU accelerated. SD1.5 on Hexagon V68+, **SDXL on Snapdragon 8 Gen 3 and newer**. txt2img, img2img, inpainting, custom checkpoints, LoRA, upscalers, plus a recent "UltraFix" tiled-diffusion detail pass.

- ✅ Free forever, fully offline, **genuinely private — prompts never leave the phone**, zero filtering
- ❌ SDXL-class quality at best; needs a flagship Snapdragon; slow relative to hosted
- Note: releases are published in both filtered and unfiltered builds — take the right one

**Do this first regardless.** It's a ten-minute install and it tells you whether SDXL-class quality is enough for what you actually want. If it is, you're done and you build nothing.

### Path B — Your own ComfyUI + an existing phone client (build nothing, ~2 hours)

Run ComfyUI on a PC with an NVIDIA GPU (or rent one), point an existing Android client at it over Tailscale.

Clients that already exist: **Comfy Portal** (open source, React Native, iOS+Android, connects to LAN or RunPod), **ComfyChair** (native Android, on F-Droid), **Comfy Remote**, **ComfyLink**, **Comfy Mobile**.

- ✅ Total control, any Civitai checkpoint or LoRA, zero per-image cost if you own the GPU, private
- ❌ Needs a GPU and a machine that stays on; ComfyUI is fiddly; **never expose it to the open internet** — Tailscale or a VPN, always
- Rented GPU ≈ $0.34–0.79/hr on RunPod, so it only pencils out in long sessions

### Path C — Build a one-field app over a hosted uncensored API (~1–2 weeks part-time)

No GPU, no server, no parameters. Prompt in, image out.

Indicative pricing — **verify live, these move constantly**:

| Provider | Model | ~Cost/image |
|---|---|---|
| Novita | SDXL / Flux class | ~$0.0015 |
| WaveSpeed | **Chroma** | ~$0.015 |
| fal.ai | Flux schnell / pro | ~$0.025 / ~$0.05 |
| RunPod Serverless | your own container | GPU-second billing |

- ✅ Works on any phone, fast, cheap, no infrastructure
- ❌ **Someone else's server still sees and logs every prompt.** "Uncensored" here means a permissive content policy, not privacy, and not *no* policy — every one of these still bans illegal content and will terminate your account
- ❌ Provider terms change without notice; today's permissive host is next quarter's filtered one

## Recommendation

**A → B → C, in that order, and stop as soon as one works.**

Paths A and B require writing no code at all and cover most of what you're asking for. Only build Path C if you've tried both and specifically want *hosted speed with a one-field UI on any phone*.

The good news: if you do build Path C, "no complex parameters" makes it a genuinely small app — roughly one screen and a history list, **1–2 weeks part-time rather than the 7–10 the archived plan estimated.**

## The provider-independence rule

Whatever you build, **put every provider behind one interface from commit one.** Permissive hosts get acquired, tighten policy, or vanish; open-weight models get superseded every few months. The single highest-value design decision in this project is that swapping providers is a new file, never a refactor.

```kotlin
interface ImageProvider {
    val id: String
    suspend fun generate(prompt: String, aspect: Aspect, seed: Long?): Result<GeneratedImage>
}
```

## One boundary

Unfiltered is a legitimate thing to want — artistic nudity, horror, violence in art, and material that corporate filters flag as "unsafe" for reasons that are really brand-safety. I'll help you build all of it.

Two things I won't help with, and which will get you banned from every hosted provider and prosecuted regardless of platform: **sexual content involving minors**, and **sexual or intimate imagery of real, identifiable people without their consent**. Local generation removes the platform's ability to stop you; it doesn't change the law. Worth saying once, and I won't raise it again.
