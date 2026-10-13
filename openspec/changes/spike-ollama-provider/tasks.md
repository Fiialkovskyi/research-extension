# Tasks

## 1. Manifest and policy

- [x] 1.1 Let the manifest schema admit `hub: "ollama"` with a 64-hex digest revision, `format: "local-server"` and no files, keeping the Hugging Face rules unchanged. Update `getModelRef`, and extend the schema and ref specs.
- [x] 1.2 Add `LOCAL_INFERENCE_ORIGINS` and the Ollama profiles to `shared/config`. Add the origin to `connect-src` and to `optional_host_permissions` in `wxt.config.ts`, and verify the built manifest.

## 2. Ollama feature

- [x] 2.1 Add `ollama/model/readOllamaModels`. Its spec covers the listing, unreachable and refused origin.
- [x] 2.2 Add `buildOllamaManifest`. Its spec covers dimensions and context from `/api/show`, the profile prefixes, a model with no profile, and the digest as revision.
- [x] 2.3 Add `createOllamaEmbedder`. Its spec covers:
  - prefixes per role;
  - one request per call;
  - a dimension mismatch failing;
  - a changed digest failing;
  - an unreachable server failing with a reason naming it.

## 3. Background and options

- [x] 3.1 Background: `ollama.status` (the four states), `ollama.register` and `ollama.pull` with progress. Route embedding and conformance by hub, add the `ollamaOrigin` dependency, derive whether local AI is paused from the queue, and hand back paused jobs once Ollama answers again. Add specs for:
  - each status;
  - pausing and resuming;
  - registering;
  - activating through a stubbed server;
  - a snapshot embedded through Ollama;
  - Hugging Face models unaffected.
- [x] 3.2 Options page: the "Local AI (Ollama)" card with the six states from design.md. That includes:
  - the permission request in the click;
  - the download link;
  - the copy buttons;
  - rechecking every 5 s while there is a problem;
  - one-click "Use <model>" (register, conformance, activate);
  - pull with progress.

  Add specs per state.

- [x] 3.3 Popup: the quiet "Local AI is paused" line while local AI is paused (derived from the queue, see design), with an "Open settings" link. Add specs.

## 4. End-to-end and documentation

- [x] 4.1 Decide whether the e2e can point the extension at a fake server (design.md, Tests). Then either add an Ollama-compatible handler with a spec for register and activate, or limit the e2e to the unreachable-server message, and record the decision.
- [x] 4.2 Add an "Ollama" section to the README: install, `ollama pull nomic-embed-text`, connecting, and `OLLAMA_ORIGINS` if needed. Update `RESEARCH_GRAPH_EXTENSION_SPEC.md` for the local provider, the policy and the M0-4 replacement. Verify that `openspec validate spike-ollama-provider --strict` passes.
- [x] 4.3 Run `npm run verify` and confirm that it passes.

## 5. Phase A on a real Ollama (the maintainer's machine)

- [x] 5.1 With Ollama installed and `nomic-embed-text` pulled: connect, register, activate (conformance), and embed a deep-read page. Record the outcomes in Findings.
- [x] 5.2 Record whether the default `OLLAMA_ORIGINS` admit the extension.
- [x] 5.3 Measure embedding throughput with the benchmark and record it against NFR-004. Decide the gate for phase B.

## 5A. Simple setup (phase A2)

- [x] 5A.1 `buildOllamaOriginsCommand(platform, extensionOrigin)`: the persistent command for macOS (LaunchAgent plus `launchctl setenv`, then reopen Ollama), Linux (systemd override) and Windows (`setx`), naming only this extension's origin. Specs.
- [x] 5A.2 Background `ollama.enable`: pull the recommended model if missing, register, run conformance and activate, streaming one progress; share the activation path with `model.activate`. Specs, including a failure at each stage.
- [x] 5A.3 Options: the card inside a closed "optional" section (open once connected), "Set up Ollama" with the permission in the click, then the self-ticking four-step checklist with plain-language text and the "Turn on local AI" button; the model list and commands under "More". Specs.
- [x] 5A.4 Popup: an always-present "Settings" link. Specs.
- [x] 5A.5 README: rewrite the Ollama section for a first-time user. Update the e2e for the closed section. Run `npm run verify`.
- [x] 5A.6 Make each line's state visible at a glance: a shared `StatusDot` (green, red, amber, pulsing blue, grey) on the options page — installed models, checks with a running state and a one-line outcome, throughput with an unmeasured state, the network policy, the Ollama checklist's step circles — and the popup's paused line. Specs.

## Deferred

Not done in this spike, by the maintainer's decision on 2026-10-13; carried to follow-up changes rather than left open here.

- Restart check: restart the Mac and confirm the extension is still admitted (`launchctl getenv OLLAMA_ORIGINS`, and the probe from this extension's origin answering 400). Setting up through the checklist alone is done and recorded in Findings.
- Phase B, generation through Ollama, to its own change (for example `add-ollama-generation`). The gate passed, and the phase B design in `design.md` still holds:
  - `createOllamaGenerator`: streaming, the token limit, cancellation and `stoppedBecause`, restoring the two deferred generation requirements to `model-runtime`;
  - structured output: `format` from a schema, with valibot validation and discard on failure;
  - with a pulled generation model (for example `qwen3:4b`), the five extraction probes, recording the schema-valid rate and the time for a 1,500-word page against NFR-007.
