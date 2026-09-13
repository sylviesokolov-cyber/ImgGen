# Part 2 — The engine

## 2.0 Stack decisions

| Concern | Choice | Why |
|---|---|---|
| Language / UI | **Kotlin + Jetpack Compose**, Material 3 Expressive | Only sane choice for a new Android app in 2026 |
| Min / target SDK | min **26**, target **36** | 26 unlocks ~99% of devices and modern crypto |
| Networking | **Ktor 3 client** (OkHttp engine) + `kotlinx.serialization` | SSE/streaming support, and leaves the door open to KMP/iOS later without rewriting the engine |
| DI | **Hilt** | Android-only today. (Use Koin instead *only* if you commit to KMP in Phase 1.) |
| Async | Coroutines + Flow | — |
| Structured data | **Room** (library, presets, prompt history, jobs) | Needs real querying — "every 16:9 render with seed 4471 that cost < $0.02" is a SQL query, not a file scan |
| Settings | **DataStore (Proto)** | — |
| Secrets | **EncryptedSharedPreferences / Tink, Keystore-backed** | §2.7 |
| Background work | **WorkManager** + expedited jobs | Generation must survive app-kill and screen-off |
| Image loading | **Coil 3** | Compose-native, good downsampling |
| Zoom/pan | `net.engawapg.lib:zoomable` | Don't hand-roll gesture math |

**Module layout** — start as one `:app` module, split at Phase 2 when build times bite:

```
:app                 navigation, DI wiring, theme
:core:network        Ktor client, auth interceptor, error mapping, retry
:core:database       Room entities, DAOs, migrations
:core:datastore      settings, secure key store
:core:designsystem   Material3 theme, shared composables
:core:model          pure Kotlin domain types (no Android deps)
:feature:generate    prompt + params + submit
:feature:gallery     library, search, detail viewer
:feature:canvas      mask paint, crop, outpaint, reference tray
:feature:models      catalog browser, capability inspector
:feature:settings    auth, budget, storage, export
```

## 2.1 The core abstraction

Everything routes through one interface. Two implementations, chosen per model from capability data:

```kotlin
interface ImageBackend {
    suspend fun capabilities(model: ModelId): ModelCapabilities
    fun generate(request: GenerationRequest): Flow<GenerationEvent>
}

sealed interface GenerationEvent {
    data class Progress(val fraction: Float?, val note: String?) : GenerationEvent
    data class Image(val local: Uri, val index: Int) : GenerationEvent
    data class Done(val usage: Usage, val providerSlug: String) : GenerationEvent
    data class Failed(val error: ImgGenError) : GenerationEvent
}
```

`ImagesApiBackend` (→ `/api/v1/images`) and `ChatCompletionsBackend` (→ `modalities:["image","text"]`). A `BackendSelector` picks one from the model's discovered capabilities. The rest of the app never knows which transport ran.

## 2.2 The request model

One serializable object is the unit of everything — it is the job payload, the gallery sidecar, the preset, and the share format. Get this right and features fall out for free.

```kotlin
@Serializable
data class GenerationRequest(
    val model: ModelId,
    val prompt: String,
    val negativePrompt: String? = null,

    val aspectRatio: String? = null,        // "16:9", "4:1", ...
    val resolution: String? = null,         // "512px" | "1K" | "2K" | "4K"
    val width: Int? = null,
    val height: Int? = null,

    val seed: Long? = null,                 // null = server random; captured on return
    val outputCount: Int = 1,

    val references: List<ReferenceImage> = emptyList(),
    val mask: MaskSpec? = null,             // inpaint
    val outpaint: OutpaintSpec? = null,

    val routing: ProviderRouting = ProviderRouting(),
    val passthrough: JsonObject = JsonObject(emptyMap()),  // raw escape hatch

    val clientMeta: ClientMeta = ClientMeta() // app version, preset id, parent render id
)

@Serializable
data class ReferenceImage(
    val uri: String,
    val role: Role,          // STYLE | SUBJECT | COMPOSITION | GENERIC
    val weight: Float? = null
)
```

Serialize this as the **sidecar** next to every saved image and you get, with no extra work: re-roll, fork, "why does this one look better", preset extraction, and bug reports that are reproducible.

## 2.3 Capability-driven parameters — the key idea

**Do not hand-write a parameter panel per model.** Parameter support varies per model *and per provider endpoint* and shifts under you as models get refreshed.

Flow:

1. On first launch (and daily, cached with ETag), fetch `/api/v1/images/models` and per-endpoint capabilities into Room.
2. Ship a **bundled fallback manifest** in `assets/` so the app has a working parameter set offline and on first run before the network settles.
3. Map each discovered parameter to a `ParamSpec` (type, range, enum values, default, label, help text).
4. The Compose param panel **renders from `List<ParamSpec>`**. A new model with a new knob appears automatically; a removed knob disappears.
5. Anything discovered but unmapped falls through to the **Raw JSON editor** (`passthrough` + `provider.options`), so a power user is never blocked waiting on an app update.

Validate client-side against the spec *before* spending money: an illegal aspect ratio should be a greyed-out chip, not a 400 and a wasted call.

## 2.4 Job pipeline

```
UI → GenerationRequest → BudgetGuard → JobRepository (Room, QUEUED)
                                            ↓
                                   WorkManager (unique chain)
                                            ↓
                              ImageBackend.generate() : Flow<GenerationEvent>
                                            ↓
                      base64 → stream-decode to file → thumbnail → Room row
                                            ↓
                          usage.cost → SpendLedger → notification
```

Rules:
- **WorkManager, not a ViewModel coroutine.** A 4K Pro render takes tens of seconds; users lock their phone. Losing a paid render to a lifecycle event is unacceptable.
- Foreground service + notification once a batch exceeds ~15s or ~3 images.
- `QUEUED → RUNNING → SUCCEEDED | FAILED | CANCELLED`, all persisted, resumable across process death.
- Retry with exponential backoff on 5xx and on 429 **honouring `X-RateLimit-Reset`**. Never auto-retry a 402 or a content-policy rejection — that just burns the user's patience and, on 402, does nothing.
- Bounded parallelism (default 2, user-configurable) so a 20-image wildcard sweep doesn't trip rate limits.

## 2.5 Memory — the thing that will crash you

Base64 4K PNGs are the #1 OOM risk in this app.

- **Never** hold `b64_json` as a `String` and then `Base64.decode()` it into a `ByteArray` and then into a `Bitmap`. That's three full copies of a 40MB payload.
- Stream the JSON response (Ktor + `kotlinx.serialization` streaming), pipe the base64 field through a **decoding stream straight to disk**.
- Generate a downsampled thumbnail on write; the grid loads thumbnails only.
- The full-resolution viewer uses `BitmapRegionDecoder` / Coil with explicit size constraints — never decode 4096×4096 at full ARGB_8888 (64MB) into a grid cell.
- Set `android:largeHeap="false"` and fix the real problem instead.

## 2.6 Storage

- Images → app-specific dir during generation; **export to `MediaStore` (`Pictures/ImgGen/`)** on user save so they appear in the system gallery. Scoped storage throughout; no legacy external writes.
- Sidecar `GenerationRequest` JSON stored in Room **and** written into the PNG (`tEXt` chunk) or as a `.json` twin on export, so metadata survives leaving the app.
- Library export/import: a zip of images + `manifest.json`. This is your backup story and your "I switched phones" story.

## 2.7 Security

- API key in **EncryptedSharedPreferences** (or DataStore + Tink), master key in the **Android Keystore**, `setUserAuthenticationRequired` optional behind a biometric toggle.
- **Never** log the key. Add a redacting Ktor logging interceptor and a `detekt` rule; assert it in a unit test.
- No key in `BuildConfig`, no key in the repo, no key in a committed `local.properties`.
- OAuth PKCE via **Custom Tabs**; `code_verifier` held only in memory.
- Optional: certificate pinning on `openrouter.ai`. Weigh it against pin-rotation breakage — probably skip for v1.
- No analytics in v1. If ever added: opt-in, and **prompts never leave the device**.

## 2.8 Errors worth first-class handling

| Condition | Behaviour |
|---|---|
| 402 no credit | Blocking dialog + deep link to top-up. Never retry |
| 429 | Backoff to `X-RateLimit-Reset`, keep job QUEUED, show the countdown |
| Content policy refusal | Show the provider's reason verbatim; offer "edit prompt", not a silent fail |
| Provider timeout / 5xx | Auto-retry ×3, then offer re-route via `provider.order` |
| Model deprecated / 404 slug | Flag the preset, suggest the successor from catalog data |
| Partial batch (3 of 4) | Persist the successes, mark the job PARTIAL. Never discard paid output |
