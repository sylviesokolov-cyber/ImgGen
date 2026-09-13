# Part 6 — Roadmap & risks

Estimates assume **one developer, part-time evenings/weekends**. Halve them for full-time.

| Phase | Deliverable | Est. |
|---|---|---|
| **0. Probe** | Script hits every endpoint; fixtures + `api-findings.md` captured; all **(verify)** markers resolved | 0.5–1 day |
| **1. Walking skeleton** | Compose app, paste-key auth, one hardcoded model, text-to-image, image on screen, saved to disk. **Ugly but end-to-end.** | 1 week |
| **2. Engine** | `ImageBackend` + both transports, capability discovery + `ParamSpec` generation, Room schema, WorkManager pipeline, error taxonomy, streaming base64→disk | 1.5–2 weeks |
| **3. Control surface** | Generated param panel, 3 disclosure tiers, seed control, references, batch + wildcards, provider routing, raw JSON editor | 1.5–2 weeks |
| **4. Library & cost** | Grid, viewer, metadata sheet, FTS search, re-roll/fork, sidecars, spend ledger + budget caps + balance widget | 1.5 weeks |
| **5. Canvas** | Mask painting, inpaint, outpaint, multi-image compose | 1–1.5 weeks |
| **6. Polish** | OAuth PKCE, model browser, comparison mode, presets, adaptive layouts, a11y, screenshot tests, Play compliance | 1.5 weeks |
| | **v1.0** | **~7–10 weeks part-time** |

Ship **Phase 1 to your own phone and actually use it** before starting Phase 2. Two weeks of real use will reorder this entire feature list, and that reordering is worth more than any amount of up-front planning — including this document.

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| API shapes differ from §1 | **Medium** | Low | Phase 0 resolves it in half a day, before any code depends on it |
| Model slugs churn (`-preview` → stable, deprecations) | **High** | Medium | Never hardcode slugs; catalog is fetched + cached. Flag stale presets against live catalog |
| Param support varies per provider endpoint | **High** | High **if hardcoded** | The capability-driven panel (§2.3) is the entire answer. Do not skip it to save a week |
| OOM on 4K base64 | **High** if naive | High | Stream-decode to disk (§2.5). Test on a 4GB device, not your flagship |
| Runaway spend (wildcard sweep on Pro) | Medium | High | Estimate-before-send, hard budget stop, bounded parallelism, confirmation above a threshold |
| Play Store rejection (AI content policy) | Medium | Medium | Disclosure + in-app report mechanism from Phase 6. Or distribute via GitHub/F-Droid and skip Play entirely |
| Scope creep into a Photoshop clone | **High** | High | Tier 3 is explicitly deferred. The app is a *control surface*, not an editor |
| You stop using it after two weeks | Medium | Total | Phase 1 dogfooding is the cheap test. Better to find out in week 1 than week 8 |

## Biggest single call

**Build the capability-driven parameter system (§2.3) in Phase 2, not "later".**

It's the difference between an app that works with whatever OpenRouter offers next quarter and an app that needs a release every time Google renames a resolution tier. It's maybe three extra days up front and it is the entire structural argument for this project existing.

## Recommended first three commits

1. Gradle skeleton + version catalog + CI + detekt/ktlint (no app code).
2. Phase 0 probe script and captured fixtures.
3. `:core:model` — `GenerationRequest` and friends, pure Kotlin, fully unit-tested.

Nothing on screen yet, and that's correct. The data model and the verified API contract are what everything else hangs off.
