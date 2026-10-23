# Design

## Context

See proposal.md for why. What the code does today, and that this design builds on:

- **Two backends.** In-extension models (`modelInstall`, `inference`, `inferenceBenchmark`, profiles
  in `shared/config/modelProfiles`, hosts in `shared/huggingFace`) and Ollama (`features/ollama`).
  Background dispatch branches on `manifest.reference.hub === "ollama"`; feature code reaches a
  model only through `modelRegistry/getActiveModel(db, family)`.
- **Ollama setup lives in `OllamaCard`** (`features/ollama/ui/ollamaCard`, ~830 lines), a closed
  `<details>` on the options page. Its checklist already ticks itself by polling, and
  `ollama.enable` already pulls, registers, checks and activates one model with progress.
- **"Connected" means "permission granted".** `isOllamaAccessGranted` reads the granted origins;
  the background uses it to decide whether it may contact Ollama at all. Commit b10c077 made this
  strict because `<all_urls>` covers loopback and caused unasked polling.
- **The 403.** Ollama checks the `Origin` header against `OLLAMA_ORIGINS`; Firefox sends
  `moz-extension://<uuid>` on the extension's requests, which the default list does not admit.
  `buildOllamaOriginsCommand` writes the platform command that fixes it.
- **Manifest** permissions are hand-listed in `wxt.config.ts`; `host_permissions` and the CSP's
  `connect-src` are derived from `MODEL_HOST_ORIGINS` and `LOCAL_INFERENCE_ORIGINS`.
- The main `extension-shell` spec lists six API permissions, but the code also declares `alarms`.
  The delta fixes the list to what the code declares, plus `notifications`.

## Goals / Non-Goals

**Goals:**
- One page, one button, no Terminal when Firefox permits it.
- Keep every in-extension model path compiling and tested, switchable by one constant.
- Keep the "nothing reaches Ollama unasked" guarantee after the permission stops expressing it.

**Non-Goals:**
- Redesigning the popup beyond the banner, or any other page.
- Detecting the machine's memory to pick a smaller generation model.
- Starting Ollama for the user (an extension cannot launch an app).

## Decisions

### 1. Admit the extension by rewriting `Origin`, decided by a spike

Two candidates, both checked in the spike before anything else is built:

- **Blocking `webRequest.onBeforeSendHeaders`**, filtered to `http://127.0.0.1:11434/*`, rewriting
  `Origin` to `http://127.0.0.1:11434` only when `details.originUrl` starts with this extension's
  own `runtime.getURL("")`. The scoping is an explicit check in code, which makes it easy to test
  and to read. Needs `webRequest` and `webRequestBlocking`. The listener is registered synchronously
  in the background, as every listener is, so the event page wakes for it.
- **`declarativeNetRequest` `modifyHeaders`**, with a session rule whose condition is
  `requestDomains: ["127.0.0.1"]` and `initiatorDomains: [<own uuid>]`. Needs
  `declarativeNetRequestWithHostAccess`. Declarative, no listener, but whether Firefox matches a
  `moz-extension` initiator, applies rules to the extension's own requests, and allows setting
  `Origin` are all unverified.

The spike answers, in Firefox as shipped, for each candidate: does Ollama with default settings
answer the extension; is a request from a web page to the same address still refused; is a request
from a second test extension still refused. The first candidate that passes all three is used;
webRequest is tried first because its scoping is visible in code. **If neither passes**, the
"allow this extension" step stays exactly as `OllamaCard` has it today — the wizard simply shows it
when Ollama answers 403 — and no rewrite permission is declared. The spike's result is written into
this file under "Findings", as `spike-event-page-lifetime` did.

Rejected: removing `Origin` altogether (a missing Origin is accepted by Ollama, but stripping it
from every loopback request would also apply to web pages unless scoped the same way, so it is no
simpler); a native messaging host (a second install for the user — the opposite of the goal).

### 2. "Setup started" is stored state, not a permission

Loopback moves to required `host_permissions`, so the grant no longer says anything. A record in the
background's database, `aiSetup.startedAt`, does: written when the setup page opens or any action
that leads to it is clicked. Everything that may contact Ollama — the health check in
`entrypoints/background`, `requeuePausedJobs`, the popup's `ollama.health` — asks for it instead of
`isOllamaAccessGranted`. `isOllamaAccessGranted` stays (the in-extension-off path no longer calls
it) and is marked as kept for the permission-based path.

A forward-only storage migration sets `startedAt` for an installation that already has an Ollama
model registered, so a developer profile that is already set up stays set up.

Rejected: keeping loopback optional and requesting it from the wizard's first click — it works, but
it is a browser dialog in the middle of a flow whose point is having none, and the egress guarantee
is about whether the user asked, which a stored choice expresses directly.

### 3. One flag for the in-extension backend

`IS_IN_BROWSER_BACKEND_ENABLED = false` in `shared/config` (its own topic directory, per the config
layout). It is read in three places:

- `wxt.config.ts`: Hugging Face origins are added to `host_permissions` and `connect-src` only when
  it is on. The `MODEL_HOST_ORIGINS` line stays, commented to say it is gated, not removed.
- the background: `model.install` and `benchmark.run` for a non-Ollama model answer `rpc.refused`
  with a reason naming the setting; `modelRegistry/getActiveModel` ignores non-Ollama models while
  it is off, so an in-extension model left active in a developer profile is not used.
- the options page: the in-extension sections are not rendered.

A `constants.spec.ts` guard asserts the flag is off, since turning it on silently re-adds two host
permissions to the manifest — the kind of costly invariant the guide allows a guard for.

### 4. A new `aiSetup` feature, and a setup surface

```
features/aiSetup/
  model/isAiSetUp         active embedding model exists (pure, over the model list)
  model/getSetupStep      server status + models + progress → current step
  model/getBadgeState     isAiSetUp + last health → "needsSetup" | "paused" | none
  model/buildTurnOnPlan   Ollama's model list + profiles → what to pull, in order, and its size
  ui/setupWizard          the one-step-at-a-time view
  ui/setupBanner          the popup banner
app/setupApp              composition root: port, polling while open, dispatch
entrypoints/setup         wiring only
```

`getSetupStep` replaces the checklist logic inside `OllamaCard`; the card's step rendering and
`Command` are reused by the wizard rather than copied. `OllamaCard` itself shrinks to the options
page's "Advanced → Ollama models" list (register another model, measure speed and extraction).

### 5. "Turn on AI" runs in the background as one job

A new `ai.turnOn` message starts, in the background, the sequence `ollama.enable` already performs,
once per model in `buildTurnOnPlan` order (embedding first). Progress is pushed on the setup page's
port as one stream with a combined fraction: Ollama's pull reports `completed/total` per layer, and
the plan knows each model's expected size, so the fraction is bytes done over bytes planned. Because
it runs in the background, closing the page does not stop it; reopening subscribes to the same
progress. Before the click the size comes from `OllamaProfile.approximateSize` for models Ollama
lacks — Ollama cannot report a remote model's size before pulling.

The event page may unload during a multi-minute pull; the pull is a streaming fetch the background
holds open, which keeps it alive (the same reason `ollama.enable` works today). If it is unloaded
anyway, the plan is idempotent: running it again skips what is active and resumes Ollama's pull.

### 6. Notification, badge, banner

- **Notification:** `runtime.onInstalled` with `reason === "install"` creates it;
  `notifications.onClicked` opens `setup.html`. Both listeners register synchronously.
- **Badge:** the background computes `getBadgeState` on `runtime.onStartup`, on install, whenever it
  announces the `models` topic, and after each Ollama health result, and sets it with
  `action.setBadgeText` / `setBadgeBackgroundColor` (no permission needed). The badge does not
  survive a browser restart, hence `onStartup`.
- **Banner:** the popup asks `aiSetup.status` (answered from the database, never from Ollama).
  Its collapsed state is a preference the background writes — surfaces do not write storage
  themselves.

## Risks / Trade-offs

- [The spike fails for both candidates] → The Terminal step stays; everything else in the change
  still holds. The wizard only shows it when Ollama actually answers 403.
- [A rewrite rule too broad would expose Ollama to every web page] → The spike's second and third
  checks are the acceptance test, and they become an e2e: a page in the test profile posts to
  loopback and must be refused.
- [`webRequestBlocking` reads as a powerful permission at review] → It is filtered to one loopback
  URL pattern; the manifest comment says so. If AMO objects, DNR is the fallback.
- [~2.8 GB download on one click] → The size is stated before the click; embedding finishes first so
  the core works within a minute or two.
- [Required loopback host permission shows in the install prompt] → It names `127.0.0.1` only and no
  data leaves the machine; the egress e2e keeps proving nothing is sent before setup starts.
- [A developer profile with an active in-extension model loses it] → Data and vectors stay;
  switching the flag back restores it.

## Migration Plan

One storage migration (`aiSetup.startedAt` from an existing Ollama registration). No user data is
moved or deleted. Rollback is flipping the flag and reverting the manifest lines.

## Findings

_To be filled by the spike (tasks 1.x)._
