# Build plan — the one-field app (Path C)

Only relevant if Local Dream and a ComfyUI client both fell short. See [decision-uncensored.md](decision-uncensored.md).

## The whole app

```
┌─────────────────────────────┐
│                       ⚙  ⧉ │   settings · history
│                             │
│                             │
│          [ image ]          │   tap = fullscreen, long-press = save/share
│                             │
│                             │
│                             │
├─────────────────────────────┤
│ ╭─────────────────────────╮ │
│ │ a storm over black water│ │   prompt. that's it.
│ ╰─────────────────────────╯ │
│  [1:1] [3:4] [16:9]      ▶ │   aspect chips + generate
└─────────────────────────────┘
```

One screen. Type, tap, wait, look. Swipe left/right on the image to move through history. Pull down to re-roll the current prompt with a new seed.

**Aspect ratio is the only exposed control.** Everything else — seed, steps, guidance, sampler, negative prompt — is chosen by the app per model and hidden. Recorded in history, never shown unless you open a result's detail sheet.

## Hidden-but-recorded

Store these on every render even though the UI never asks for them. They cost nothing to keep and they're what makes re-roll, "why was that one good", and provider debugging possible later:

`prompt · model · provider · seed · aspect · steps · guidance · negative · latency · cost · timestamp`

A sensible **default negative prompt** per model, baked in and editable only from Settings, does more for output quality than any control you could expose.

## Architecture

Deliberately small. No Hilt, no multi-module, no capability discovery — that was the old plan's answer to a problem this app doesn't have.

```
:app
  data/
    ImageProvider.kt        ← the interface; everything else is behind it
    NovitaProvider.kt
    WaveSpeedProvider.kt    ← Chroma
    ComfyUiProvider.kt      ← optional: your own box over Tailscale
    HistoryDao.kt           ← Room, one table
    SecureStore.kt          ← EncryptedSharedPreferences, Keystore-backed
  ui/
    GenerateScreen.kt
    HistoryScreen.kt
    SettingsScreen.kt
  work/
    GenerateWorker.kt       ← WorkManager, survives screen-off
```

| Concern | Choice |
|---|---|
| UI | Kotlin + Compose, Material 3 |
| Net | Ktor 3 (OkHttp engine) + kotlinx.serialization |
| DB | Room, one `renders` table |
| DI | none — constructor injection by hand. It's four classes |
| Background | WorkManager |
| Images | Coil 3 |
| Key storage | EncryptedSharedPreferences, Keystore master key |

Three things from the archived plan still matter and are worth carrying over verbatim:

1. **WorkManager, not a ViewModel coroutine.** Renders take 10–40s; people lock their phone. Losing a paid render to a lifecycle event is unacceptable.
2. **Stream base64 straight to disk.** Never `String → ByteArray → Bitmap` on a large PNG — that's three full copies and an OOM on a mid-range device.
3. **Provider behind an interface from commit one.** Permissive hosts change policy. See the provider-independence rule.

## Settings (short by design)

Provider + API key · default model · default negative prompt · default aspect · steps/guidance presets (Fast / Good / Best) · save-to-gallery toggle · **NSFW-safe app icon & hide-from-recents toggle** · export history.

That last one is not a joke — if the point is unfiltered generation, a discreet icon and `FLAG_SECURE` on the viewer are more useful than any generation parameter.

## Phases

| Phase | Deliverable | Est. |
|---|---|---|
| 0 | Sign up with one provider, `curl` it, confirm it actually renders what you want unfiltered. **Before any code.** | 1 hour |
| 1 | One screen, hardcoded provider, prompt → image on screen | 2–3 days |
| 2 | Room history, save to `MediaStore`, swipe-through, re-roll | 2–3 days |
| 3 | WorkManager, notification, error handling (402/429/refusal) | 2 days |
| 4 | Second provider behind the interface, settings, key storage | 2 days |
| 5 | Polish: fullscreen viewer, share, `FLAG_SECURE`, discreet icon | 2 days |
| | **v1** | **~1.5–2 weeks part-time** |

Phase 0 is the one that matters. **Do not write Android code until you've confirmed by `curl` that your chosen provider actually returns what you want.** Every provider's definition of "uncensored" is different, and finding out after you've built a client is an expensive way to learn it.

## Distribution

Google Play will not accept this — its policy bars apps whose primary purpose is generating sexual content, and AI-generated-content apps require a user-facing report mechanism regardless. Plan on **sideloading your own signed APK**, or F-Droid if you open-source it. Which is fine: it's your app, on your phone.
