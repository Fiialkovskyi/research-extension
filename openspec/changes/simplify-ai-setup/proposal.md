# Proposal

## Why

Getting from "installed" to "the AI works" takes seven steps nobody is told about: the user has to
find Settings, scroll past device radios, thread counts, Hugging Face repository names, throughput
and network policy to a closed card labelled "optional", install Ollama, paste a `launchctl`
command into Terminal, grant a permission, and then turn on two models with two separate buttons.
After install the extension says "Hello World" and nothing else. The research features depend on
the models, so in practice the setup is not optional — it is just hidden and hard.

## What Changes

- **Ollama is the only model backend, for now.** The in-browser (transformers.js, Hugging Face)
  models are hidden behind one configuration flag that is off. Their code, tests and storage stay;
  nothing is deleted.
- **BREAKING (manifest):** the Hugging Face hosts leave `host_permissions` and the content security
  policy's `connect-src` while the flag is off. The declaration stays in code, marked, so turning the
  flag back on restores it.
- **No Terminal command, if Firefox allows it.** A spike first checks whether the extension can
  rewrite the `Origin` header on its own requests to `http://127.0.0.1:11434` — and only its own —
  so Ollama answers without `OLLAMA_ORIGINS`. If it cannot be scoped that tightly, the
  copy-one-command step stays, as today.
- **No permission dialog for loopback.** `http://127.0.0.1:11434` moves from optional to required
  host permissions. Whether the extension may talk to Ollama is decided by the user having started
  setup, recorded in storage, not by a permission grant — so nothing is sent to Ollama unasked.
- **A setup wizard page.** A new extension page, `setup.html`, shows one step at a time and moves on
  by itself as it observes progress: get Ollama → open it → (allow this extension, only if the
  spike failed) → "Turn on AI" → done.
- **One button, both models.** "Turn on AI" says how much it downloads (~2.8 GB), then pulls,
  registers, checks and activates `nomic-embed-text` and then `qwen3:4b`, with one combined
  progress. Similar pages work as soon as the first is active; summaries follow. Models Ollama
  already has are used without a download.
- **The user is told, not interrupted.** While AI is not set up:
  - one system notification right after install, whose click opens the wizard;
  - a badge on the toolbar icon (and a different one while Ollama is not answering);
  - a banner at the top of the popup — collapsible, not dismissable — leading to the wizard.
  Sessions start and record without AI; nothing is blocked.
- **The options page loses its model workbench.** It shows the AI status and a link to the wizard;
  other Ollama models, measurement and the developer tools sit under a closed "Advanced" section.

## Capabilities

### New Capabilities

- `ai-setup`: how the user is told that AI is not set up (install notification, toolbar badge,
  popup banner) and the setup wizard that takes them from no Ollama to both models active.

### Modified Capabilities

- `model-runtime`: Ollama becomes the only offered backend; in-browser models are flag-gated; the
  options-surface setup requirement is replaced by the wizard; turning on AI installs both families
  in one action; Ollama is contacted only once the user started setup.
- `extension-shell`: permissions (`notifications`, required loopback host permission, no Hugging
  Face hosts), the connection policy, and what the options surface manages.

## Impact

- **Code:** `wxt.config.ts` (permissions, CSP, new `setup` entrypoint); `src/shared/config` (the
  backend flag); `src/app/optionsApp`, `src/app/popupApp`, `src/app/backgroundApp`
  (install hook, badge, "setup started" state, origin rewrite if the spike succeeds);
  `src/features/ollama` (wizard steps reuse the card's model; `isOllamaAccessGranted` changes
  meaning); a new `src/app/setupApp` and `src/entrypoints/setup`.
- **Tests:** the egress e2e must still prove nothing reaches Ollama before setup starts, now that the
  loopback permission is always granted; the manifest assertions change.
- **Not in scope:** the popup's other content, the map, recorded and synthesis pages; choosing a
  smaller generation model for weak machines; deleting the in-browser model code.
