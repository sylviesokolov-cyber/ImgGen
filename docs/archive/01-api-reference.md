# Part 1 — The OpenRouter image surface

> **Verification status.** `openrouter.ai` is blocked from the sandbox this plan was written in, so the shapes below come from OpenRouter's published docs/blog/skill repo via search, not from a live call. Everything marked **(verify)** must be confirmed against a real request in Phase 0 before any code depends on it. The architecture below is deliberately designed so that being wrong about a parameter name costs one JSON change, not a refactor.

## 1.1 Two transports

OpenRouter exposes image generation two ways. **Support both; prefer the first.**

### Primary — the dedicated Image API

```
POST https://openrouter.ai/api/v1/images
Authorization: Bearer $OPENROUTER_API_KEY
Content-Type: application/json
```

```json
{
  "model": "google/gemini-3.1-flash-image",
  "prompt": "a brass orrery on a walnut desk, raking afternoon light",
  "resolution": "2K",
  "aspect_ratio": "16:9",
  "input_references": ["data:image/png;base64,..."],
  "provider": {
    "order": ["google-ai-studio"],
    "allow_fallbacks": true,
    "options": { "google-ai-studio": { "...": "provider-specific passthrough" } }
  }
}
```

Response:

```json
{
  "created": 1770000000,
  "data": [ { "b64_json": "iVBORw0KGgo...", "media_type": "image/png" } ],
  "usage": {
    "prompt_tokens": 24, "completion_tokens": 1290, "total_tokens": 1314,
    "cost": 0.065
  }
}
```

Key points:
- Images are **base64 in `data[].b64_json`**, not URLs. Plan memory accordingly (a 4K PNG base64 is tens of MB as a string).
- `usage.cost` is the **actual charged cost**. This is what makes a real spend meter possible. Do not estimate when you can read.
- Provider routing (`order`, `only`, `ignore`, `sort`, `allow_fallbacks`) applies to image calls, same as chat.
- Reference images for editing go in **`input_references`** **(verify exact field name + encoding: data-URL vs bare base64 vs remote URL)**.

### Secondary — Chat Completions with image modality

```
POST https://openrouter.ai/api/v1/chat/completions
{ "model": "...", "messages": [...], "modalities": ["image", "text"] }
```

Images come back at `choices[0].message.images[0].image_url.url` as a **data URL** (`data:image/png;base64,...`).

Why keep it: some models are exposed only through chat, and it's the natural path for **conversational / agentic editing** ("now make the sky stormier") where prior turns are context. Muse Image in particular is an agentic model that reasons across a chain of thought — multi-turn refinement is its idiom.

## 1.2 Capability discovery — the load-bearing endpoint

```
GET /api/v1/models?output_modalities=image      # catalog of image-capable models
GET /api/v1/images/models                       # image-capable slugs + supported params
GET /api/v1/images/models/{author}/{slug}/endpoints
```

The per-endpoint response carries: `provider_name`, `provider_slug`, `supported_parameters`, `allowed_passthrough_parameters`, `supports_streaming`, `pricing`.

**This is the single most important design input in the whole project.** Parameter support varies per model *and per provider endpoint*: whether `seed` exists, how many `input_references` are accepted, which aspect ratios and resolutions are legal, whether `n > 1` works. An app that hardcodes a fixed parameter panel will be broken within a month of any model refresh.

**Therefore: the parameter UI is generated from capability discovery, not hand-written per model.** See §2.3.

## 1.3 Auth

Two paths, ship both:

1. **OAuth PKCE** (preferred UX). Send the user to `https://openrouter.ai/auth?callback_url=<deeplink>&code_challenge=<S256>&code_challenge_method=S256`, catch the redirect on an app deep link, then `POST https://openrouter.ai/api/v1/auth/keys` with `{ code, code_verifier, code_challenge_method: "S256" }` to receive a scoped API key. The code is single-use and expires in ~10 minutes. On Android use **Custom Tabs, never a WebView** — a WebView asking for provider credentials is both a phishing pattern and often blocked.
2. **Paste-a-key** fallback for users who'd rather mint a key at `openrouter.ai/keys`.

## 1.4 Account / budget endpoints

- `GET /api/v1/key` → the current key's spend limit: `limit`, `limit_remaining`, `limit_reset`, plus rate-limit info. Drives the in-app balance widget.
- `GET /api/v1/credits` → `total_credits` / `total_usage` for the account (management-key scoped).
- Error handling that matters: **`402`** = out of credit, **`429`** = rate limited (read `X-RateLimit-Limit` / `-Remaining` / `-Reset` headers and back off against `Reset`, not a fixed sleep).

Send `HTTP-Referer` and `X-Title` headers on every call — OpenRouter uses them for app attribution and it costs you nothing.

## 1.5 Model shortlist

Read pricing **live from the API**; never hardcode it. Figures below are indicative only and were sourced from third-party pages.

| Model | Slug | Character | Use it for |
|---|---|---|---|
| **Nano Banana 2** | `google/gemini-3.1-flash-image` | Pro-quality at Flash speed. 512px/1K/2K/4K, 14 aspect ratios incl. ultra-wide (1:4, 4:1, 1:8, 8:1). Invisible SynthID watermark. | **Default workhorse.** |
| Nano Banana 2 Lite | `google/gemini-3.1-flash-lite-image` | ~4s, ~2.7× faster than Flash, cheapest | Exploration, thumbnail sweeps, wildcard batches |
| Nano Banana Pro | `google/gemini-3-pro-image` | Slower, highest quality | Final renders after a seed is locked |
| **Muse Image** (Meta) | `meta/muse-image` | *Agentic*: reasons before rendering, decomposes multi-part prompts, self-refines in chain of thought, invokes web search for factual accuracy. Reference-image conditioning for subject/style consistency across a series. Strong text rendering. ~$0.01/image, 65k ctx | Prompts with **text in the image**, multi-clause briefs, **character/style consistency across a set**, anything needing real-world factual grounding |
| Seedream 4.5 | (per catalog) | Strong alternative renderer | A/B comparison |

**Workflow this implies:** explore wide and cheap on Lite → lock prompt + seed → final render on Pro or Muse. The app should make that ladder a one-tap escalation, not a manual retype. That single feature is most of the reason to build this.
