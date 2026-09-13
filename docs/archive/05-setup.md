# Part 5 — Project setup

## 5.1 Toolchain

- Android Studio (current stable), **AGP 8.x+**, **Gradle version catalogs** (`gradle/libs.versions.toml`) from commit one — retrofitting them is miserable.
- **Kotlin 2.x** with the Compose compiler plugin (no more `composeOptions` version pinning).
- JDK 17 toolchain, pinned via `kotlin { jvmToolchain(17) }` so CI and local agree.
- `ktlint` + `detekt`, both wired into CI and a pre-commit hook.
- Build variants: `debug` / `release`; flavours `dev` / `prod` only if you end up needing a staging endpoint (you probably won't).

## 5.2 Repository layout

```
ImgGen/
├── app/
├── core/{network,database,datastore,designsystem,model}/
├── feature/{generate,gallery,canvas,models,settings}/
├── docs/                      ← this plan
├── gradle/libs.versions.toml
├── .github/workflows/ci.yml
├── config/{detekt.yml,ktlint}
└── README.md
```

## 5.3 Secrets

`local.properties` is git-ignored and holds **nothing secret** — the user's key is entered at runtime and never touches the build. There is no build-time API key. If you add signing:

```
# ~/.gradle/gradle.properties  (never in the repo)
IMGGEN_KEYSTORE_PATH=...
IMGGEN_KEYSTORE_PASSWORD=...
```

CI signing via GitHub Actions secrets + base64'd keystore, and only on tagged releases.

## 5.4 Testing

| Layer | Tool | What it must cover |
|---|---|---|
| API client | **Ktor MockEngine** / MockWebServer | Request serialization, response parsing, **402/429/5xx paths**, retry + backoff, key redaction in logs |
| Capability mapping | JUnit | Discovery JSON → `List<ParamSpec>`, including unknown-param fallthrough |
| Repos / DB | Room in-memory | Migrations (write them from v1; a library you can't migrate is a library you lose) |
| ViewModels | Turbine + coroutines-test | State machines, cancellation |
| Compose UI | `createAndroidComposeRule` | Param panel renders from spec; a11y semantics present |
| Screenshot | **Roborazzi** | Light/dark, font scale, key screens |

Golden-file tests on real captured OpenRouter responses (with keys scrubbed) are worth more than any mock you invent. Capture them in Phase 0.

## 5.5 CI (GitHub Actions)

On PR: `ktlintCheck` → `detekt` → `testDebugUnitTest` → `assembleDebug` → screenshot verify. On tag: `bundleRelease` + signing + artifact upload. Cache Gradle aggressively; the build will otherwise dominate your iteration time.

## 5.6 Phase 0 — do this before writing app code

**This is the highest-value half-day in the whole project.** Write a throwaway Kotlin/JVM or shell script that:

1. Runs OAuth PKCE end-to-end and prints a key.
2. `GET /api/v1/images/models` and per-endpoint capabilities → **save the raw JSON as test fixtures**.
3. `POST /api/v1/images` on Nano Banana 2: text-to-image, each aspect ratio, each resolution tier.
4. Same with `input_references` for editing — **confirm the exact field name and encoding**.
5. Same via `/api/v1/chat/completions` with `modalities`.
6. `POST` on `meta/muse-image` — check which params it actually honours.
7. Deliberately trigger **402** (spend down a tiny-limit key) and **429**; record the exact error bodies and headers.
8. Confirm whether `seed` and `n > 1` are honoured per model.

Output: a `docs/api-findings.md` plus a fixtures directory. Every **(verify)** marker in Part 1 gets resolved here, and the fixtures make the whole network layer testable offline forever.

## 5.7 Definition of done for v1

- [ ] OAuth PKCE + paste-key both work; key never logged (asserted by test)
- [ ] Capability-driven param panel renders correctly for ≥4 models
- [ ] Text-to-image, image-to-image, inpaint all working on Nano Banana 2
- [ ] Jobs survive app-kill and screen-off
- [ ] Actual cost recorded on every render; budget hard-stop enforced
- [ ] Library search across prompt + params; export/import round-trips
- [ ] Re-roll and fork-params work from any library item
- [ ] No OOM on a 20-image 4K batch (test on a 4GB device)
- [ ] TalkBack pass on Generate and the param panel
- [ ] Play content-policy + data-safety declarations drafted
