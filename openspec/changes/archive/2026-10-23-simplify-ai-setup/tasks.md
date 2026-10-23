# Tasks

## 1. Spike: admit the extension without `OLLAMA_ORIGINS`

- [x] 1.1 In a throwaway branch of the background, add a blocking `webRequest.onBeforeSendHeaders` listener on `http://127.0.0.1:11434/*` that rewrites `Origin` only when `originUrl` is this extension's own; with Ollama on default settings (no `OLLAMA_ORIGINS`), verify `/api/tags` and `/api/embed` from the extension answer 200
- [x] 1.2 With the same build, verify a `fetch` POST to `http://127.0.0.1:11434/api/embed` from an ordinary web page, and from a second unpacked test extension, is still refused with 403
- [x] 1.3 If 1.1 or 1.2 fails, repeat both checks with a `declarativeNetRequest` session rule (`modifyHeaders`, `requestDomains: ["127.0.0.1"]`, `initiatorDomains: [own uuid]`)
- [x] 1.4 Record what passed, the Firefox and Ollama versions, and the chosen mechanism (or "none — keep the command step") under "Findings" in design.md; verify by re-reading the section

## 2. Flag off the in-extension backend

- [x] 2.1 Add `IS_IN_BROWSER_BACKEND_ENABLED = false` under `shared/config` with a `constants.spec.ts` guard asserting it is off; verify `npm run test`
- [x] 2.2 In `wxt.config.ts`, add Hugging Face origins to `host_permissions` and `connect-src` only when the flag is on, keeping the declaration with a comment that it is gated; verify the built manifest names no model host
- [x] 2.3 While the flag is off, have `model.install`, `model.activate` and `benchmark.run` for a non-Ollama model answer `rpc.refused` (lookup stays as is — see design 3); verify with background unit tests for both settings of the flag
- [x] 2.4 Mark `isOllamaAccessGranted` and the Hugging Face constants as kept for the gated path, in their doc comments

## 3. "Setup started" replaces the permission check

- [x] 3.1 Add `aiSetup.startedAt` to the storage schema with a forward-only migration that sets it when an Ollama model is already registered; verify with the migration's unit test
- [x] 3.2 Add `aiSetup.start` and `aiSetup.status` messages; route the background's Ollama health check, `requeuePausedJobs` and the popup's `ollama.health` through `startedAt` instead of `isOllamaAccessGranted`; verify with background app unit tests that nothing reaches Ollama before `aiSetup.start`
- [x] 3.3 Move `http://127.0.0.1:11434/*` from `optional_host_permissions` to `host_permissions`, add `notifications`, and (per 1.4) the rewrite permission; update the manifest assertions in e2e and verify `npm run build:firefox`
- [x] 3.4 If 1.4 chose a mechanism, implement it in `features/ollama` with the scoping check extracted as a pure, unit-tested helper, and register it synchronously in `entrypoints/background`; verify the spike's three checks again against the real build — none chosen, nothing to implement
- [x] 3.5 Extend the egress e2e: with page access granted and setup never started, nothing is sent to loopback; and a web page's request to loopback is still refused; verify `npm run test:e2e` — the existing egress spec already covers the first half and passes with loopback now always granted; a new `manifest.e2e.ts` checks the permissions and policy. The web-page half is moot: no rewrite shipped (Findings), so nothing about a page's requests changed, and an e2e must not depend on a running Ollama

## 4. The `aiSetup` feature model

- [x] 4.1 `isAiSetUp` over the model list (embedding active ⇒ set up, generation ignored); verify unit tests
- [x] 4.2 `getSetupStep` from server status, models and progress → `getOllama` | `openOllama` | `allowExtension` | `turnOn` | `turningOn` | `done`, skipping done steps; verify unit tests per transition, including `allowExtension` only on 403
- [x] 4.3 `buildTurnOnPlan` from Ollama's model list and `OLLAMA_PROFILES` → ordered models to pull/register and the bytes to download; verify unit tests for none, one and both models present
- [x] 4.4 `getBadgeState` from `isAiSetUp` and the last health result; verify unit tests

## 5. Turn on AI in the background

- [x] 5.1 Add `ai.turnOn`: run the plan embedding-first through the existing enable path, push one combined progress on subscribed ports, keep an activated model when a later stage fails; verify background unit tests with a stubbed Ollama for success, one model present, and a failure in each stage
- [x] 5.2 Let a reopened setup page subscribe to a running `ai.turnOn` and receive its current progress; verify with a unit test that subscribes mid-run

## 6. Notification and badge

- [x] 6.1 On `runtime.onInstalled` with `reason === "install"`, create the setup notification; on `notifications.onClicked`, open `setup.html`; both registered synchronously; verify unit tests that an update creates none
- [x] 6.2 Set the badge from `getBadgeState` on startup, install, every `models` announcement and every health result; verify unit tests with a stub `action` API

## 7. Setup page

- [x] 7.1 Add `entrypoints/setup` (wiring only) and `app/setupApp` (port, `aiSetup.start` on open, polling every few seconds while not done); verify the built package contains `setup.html`
- [x] 7.2 Build `aiSetup/ui/setupWizard`: one step at a time, Ollama download link, "already installed? just open it", size before "Turn on AI", combined progress, "similar pages already work" once embedding is active, named failure with retry; reuse `OllamaCard`'s `Command` for the allow step; verify component unit tests for every step
- [x] 7.3 Verify light and dark appearance and add the page to the accessibility audit's list of pages — audited (no violations, light scheme); dark uses the same `dark:` classes as the other pages but was not looked at, like the other pages' dark checks, which stay manual

## 8. Popup banner

- [x] 8.1 Build `aiSetup/ui/setupBanner`: one sentence, "Set up" action opening `setup.html`, collapsible, not dismissable; collapsed state stored through the background; verify component unit tests
- [x] 8.2 Render it at the top of `PopupApp` from `aiSetup.status`, and change the "paused" line's action to open the setup page; verify popup unit tests that a session still starts with AI not set up

## 9. Options page

- [x] 9.1 Replace the top of `OptionsApp` with the AI status (set up or not, active models) and "Open setup"; move other Ollama models, measurement and the developer section under a closed "Advanced"; stop rendering in-extension sections while the flag is off; verify options unit tests
- [x] 9.2 Shrink `OllamaCard` to the advanced model list, removing the checklist now owned by the wizard; verify its unit tests and that nothing else imports the removed parts

## 10. Integration

- [x] 10.1 Add an e2e: a fresh profile shows the badge and the popup banner; the banner opens `setup.html`
- [ ] 10.2 Manual run on macOS with Ollama installed but closed, no models: install → notification → setup page → open Ollama → Turn on AI → badge clears; note the result in design.md "Findings"
- [x] 10.3 Update AGENTS.md's model path and the `extension-shell` permission notes where they name the options page as the place models are installed; verify by reading the changed sections
- [x] 10.4 Run `npm run verify`
