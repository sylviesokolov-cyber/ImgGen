# ImgGen — Android text-to-image client for OpenRouter

**Status: plan only. No code written yet.**

A power-user Android client for OpenRouter's image models (Nano Banana 2, Muse Image, and whatever comes next) with the parameter control that first-party apps don't give you — seed locking, reference images, masks, batch, provider routing, real cost tracking, and a fully searchable local library.

## Read in order

| Doc | Contents |
|---|---|
| **[docs/00-landscape.md](docs/00-landscape.md)** | Does a good free app already exist? (Answer: partly — read this before building anything) |
| **[docs/01-api-reference.md](docs/01-api-reference.md)** | OpenRouter's image surface: endpoints, auth, capability discovery, model shortlist |
| **[docs/02-architecture.md](docs/02-architecture.md)** | Stack, module layout, the `ImageBackend` abstraction, job pipeline, memory, security |
| **[docs/03-ui.md](docs/03-ui.md)** | Screens, navigation, the three disclosure tiers, visual design |
| **[docs/04-features.md](docs/04-features.md)** | Feature set ranked in three tiers, plus what we're explicitly not building |
| **[docs/05-setup.md](docs/05-setup.md)** | Toolchain, repo layout, secrets, testing, CI, and the Phase 0 probe |
| **[docs/06-roadmap.md](docs/06-roadmap.md)** | Phases, estimates, risks |

## Executive summary

**Should you build it?** Free apps (Gemini, Copilot) give you frontier quality with near-zero control. Free open-source apps (Local Dream, SDAI) give you deep control with SD1.5-class quality. **Nothing gives you frontier quality *and* deep control *and* your own key.** That gap is real, so yes — but validate the workflow with a $5 top-up and some `curl` first.

**The three decisions that matter:**

1. **Capability-driven parameter UI.** Fetch `supported_parameters` per model+provider from OpenRouter and *generate* the control panel from it. Hardcoding a param panel per model means breaking on every model refresh. This is the structural reason the app is worth building.
2. **One serializable `GenerationRequest`** that doubles as job payload, image sidecar, preset, and share format. Re-roll, fork, compare, and provenance all fall out of it for free.
3. **WorkManager + stream base64 to disk.** Renders are slow and expensive; they must survive a locked screen, and a 4K base64 PNG will OOM you if you decode it naively.

**Stack:** Kotlin · Compose (Material 3 Expressive) · Ktor 3 · Room · Hilt · WorkManager · Coil 3 · Keystore-backed encrypted key storage.

**Effort:** ~7–10 weeks part-time to v1. Ship Phase 1 to your own phone in week one and use it before building anything else.

**Next step:** the Phase 0 probe in [docs/05-setup.md §5.6](docs/05-setup.md) — half a day, resolves every open API question, and produces the test fixtures the whole network layer will use.
