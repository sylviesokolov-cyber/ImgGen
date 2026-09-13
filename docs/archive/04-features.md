# Part 4 — Feature set

Ranked. Everything in **Tier 1** is what "proper control depth" actually means; ship it or don't bother building.

## Tier 1 — the reason this app exists

### 4.1 Prompt system
- Plain prompt + optional **negative prompt** (where the model supports it).
- **Structured builder** (toggleable): Subject · Style · Lighting · Camera/lens · Composition · Colour · Detail · Negative. Assembles into a single prompt; stays editable as raw text. Round-trips both ways.
- **Wildcards**: `{cyberpunk|art deco|brutalist}` expands combinatorially into a batch. `__filename__` pulls from user-defined term lists. Live counter: *"→ 12 images, ~$0.78"*.
- **Prompt library**: save, tag, search, favourite. Auto-captures every prompt you've run.
- **Prompt diff**: on any two library items, show a word-level diff of the prompts and a diff of the params. This is the feature that turns random re-prompting into actual learning.

### 4.2 Seed control
Random / **locked** / reuse-last. Always captured from the response and stored, even when you didn't set it. Seed-locked re-render at higher resolution or on a different model is the core power workflow — expose it as one tap ("Upscale", "Try on Pro").

### 4.3 Reference images & editing
- Up to the model's advertised max refs, each tagged **Style / Subject / Composition** with a weight where supported.
- **Inpaint** with painted masks, **outpaint** by frame expansion, **multi-image composition**.
- **Character/style consistency**: pin a reference set as a "Series"; every generation in that series auto-attaches it. Muse Image's reference conditioning is built for exactly this.

### 4.4 Cost control
- Per-request **estimate before** you spend; **actual `usage.cost` after**.
- Running ledger: session / today / this month, per-model and per-project breakdown.
- **Budget caps** with a real hard stop — the `BudgetGuard` refuses to enqueue past the cap. Soft warn at 80%.
- Live balance from `GET /api/v1/key`.

### 4.5 Batch & queue
Persistent queue surviving app-kill. Bounded parallelism. Cancel individual or all. Offline enqueue that drains on reconnect. Partial-batch results are always kept.

### 4.6 Library with full provenance
Every render — successes *and* failures — stored with its complete `GenerationRequest`, the actual provider used, latency, cost, and timestamp. Full-text search on prompts. Albums/projects. Favourites. Export with sidecars.

### 4.7 Model comparison
Send **one prompt to N models at once**, results land in a comparison grid with cost and latency per model. A/B slider with synced zoom. This is the single most valuable thing a BYO-key client can do that no first-party app will ever offer you.

### 4.8 Presets / recipes
Save any full `GenerationRequest` (minus the prompt, optionally) as a named preset. Per-model defaults. Export/import and share as JSON or a deep link.

## Tier 2 — the polish that makes it daily-driver

- **Draft→final ladder**: explore on Lite → lock seed → escalate to Flash → finalise on Pro/Muse, one tap per rung, prompt and seed carried forward.
- Home-screen widget + quick-settings tile → prompt straight to queue.
- **Share-sheet target**: share any image from any app into ImgGen as a reference or to edit.
- Generation history timeline per image: "this came from that, via these three edits" — a visual lineage graph using `clientMeta.parentRenderId`.
- Local post-processing: crop, rotate, simple adjustments (no round-trip cost).
- Watermark/signature overlay for export.
- Aspect-ratio templates by destination (phone wallpaper, story, 16:9 thumbnail, print sizes).

## Tier 3 — later, if the app earns it

- On-device fallback (Local Dream-style SD via NNAPI/QNN) for offline and free drafts.
- Other backends behind the same `ImageBackend` interface: direct Gemini API, A1111/ComfyUI on the LAN, Replicate.
- Video generation (OpenRouter's unified API covers more modalities).
- Wear OS companion, Android Auto — almost certainly not worth it.
- KMP/iOS — only if the engine stayed Ktor-pure.

## Explicitly NOT doing

- ❌ Own backend/proxy for API keys — BYO-key is the whole point and a proxy makes you liable for content and cost.
- ❌ Accounts, sync, cloud library in v1. Local-first; export is the sync story.
- ❌ Subscriptions or credits — the user pays OpenRouter directly.
- ❌ Ads, analytics, telemetry.
- ❌ Bundling an API key in the APK. (It will be extracted within a day and drained.)

## Compliance notes — read before you publish

- Nano Banana output carries an **invisible SynthID watermark**; C2PA provenance may also be attached. Do not strip it, and say so in About.
- Google Play requires disclosure for apps generating AI content, plus a **user-reachable mechanism to report offensive generated content**. Budget a day for the Play data-safety form and content-policy declaration.
- The app surfaces provider content-policy refusals verbatim rather than filtering independently — but you remain responsible for the Play listing's content rating.
