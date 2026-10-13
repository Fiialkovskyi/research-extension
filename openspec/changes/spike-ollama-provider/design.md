# Design

## Context

- **The provider contract** (`features/inference/types.ts`): `LoadedModel` is either `{ family: "embedding", embed }` or `{ family: "text-generation", generate }`. The background reaches embeddings through `loadEmbeddingSession(model) → { embed(texts, role) }`, and conformance through `runEmbeddingConformance(contract, embed)`.
- **The manifest** (`shared/modelManifest`):
  - `reference: { hub: "huggingface", repository, revision }`, where `revision` is a 40-character commit;
  - `format: "onnx"`;
  - `files` with at least one entry;
  - `contract`.

  `getModelRef` builds `ref` from the repository and revision.

- **Policy.** `wxt.config.ts` builds `connect-src 'self' <model hosts>`. `host_permissions` holds the model hosts, and `optional_host_permissions` holds `<all_urls>` for page access.
- **The options page** lists bundled profiles, installs, activates and benchmarks.
- **Ollama's API, as documented:**
  - `GET /api/version`;
  - `GET /api/tags`, giving the models with `name`, `digest` (sha256) and `details`;
  - `POST /api/show`, giving `model_info` with `<arch>.embedding_length` and `<arch>.context_length`;
  - `POST /api/embed` (`{ model, input: string[] }`, giving `embeddings: number[][]`, L2-normalised);
  - `POST /api/chat`, with `stream`, `options.num_predict` and `format`, a JSON schema.
- **Origin check.** Ollama rejects requests whose `Origin` it does not allow, through `OLLAMA_ORIGINS`. Whether its defaults admit `moz-extension://` is to be confirmed on the real server (task 5.2).

## Goals / Non-Goals

**Goals:**

- Phase A, embeddings through Ollama, behind the existing activation and conformance gates.
- No change to any feature that uses a model: routing is the background's.
- Only loopback is added to the policy, and only after a user grant.

**Non-Goals:**

- Pulling or deleting models in Ollama.
- A configurable host or port: the default port only, with a setting later if needed.
- Phase B before the gate is passed.

## Decisions

### The manifest admits a local server

- **`reference.hub`** becomes `"huggingface" | "ollama"`. For Ollama, `repository` is the model name (`nomic-embed-text:latest`) and `revision` is its `sha256` digest, 64 hex characters.
- **`format`** becomes `"onnx" | "local-server"`.
- **`files`** may be empty for `local-server`.
- `getModelRef` gives `ollama:<name>@<digest prefix>`.

A valibot `variant` on `hub` keeps the Hugging Face rules exactly as they are.

### `features/ollama`

- **`model/readOllamaModels(fetch)`** calls `GET /api/tags`. It throws with "Ollama is not reachable at http://127.0.0.1:11434" on a network failure, and with "Ollama refused this extension's origin; set OLLAMA_ORIGINS=moz-extension://*" on a 403.
- **`model/buildOllamaManifest(fetch, name, profile?)`** calls `POST /api/show` and reads `embedding_length` and `context_length` for the model's architecture. It takes:
  - prefixes from a bundled Ollama profile, or none;
  - `normalize: true`, because `/api/embed` normalises;
  - `similarity: "cosine"`;
  - `pooling` from the profile, defaulting to `"mean"`.

  Its `revision` is the digest from `/api/tags`.

- **`model/createOllamaEmbedder(fetch, manifest)`** returns `embed(texts, role)`. It prefixes the texts per the contract, sends one `POST /api/embed`, checks the answer's length and dimensions against the contract, and returns `Float32Array`s.

  Before embedding, it confirms that `/api/tags` still lists the name with the same digest. If not, it throws "the model changed since it was registered", which keeps the pin real.

- **Profiles.** `shared/config/ollamaProfiles` hold:
  - `nomic-embed-text`, with prefixes `search_query: ` and `search_document: `;
  - `all-minilm`, with none;
  - `mxbai-embed-large`, with the query prefix "Represent this sentence for searching relevant passages: ".

### UX: a "Local AI (Ollama)" card on the options page, and a quiet notice in the popup

The extension can neither install nor launch Ollama: Firefox gives an extension no way to run programs. It can only open a download page, and ask `GET /api/version` whether a server answers. "Not installed" and "not running" look the same from outside (nothing answers), so the card offers both remedies together.

The card's states, checked when the page opens, after every action, and every 5 s while the card shows a problem:

| State                                  | How it is known                                   | What the card shows                                                                                                                                                                                                                                                                                                      |
| -------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Not connected                          | No host permission for the loopback origin        | "Run AI models on this computer with Ollama: faster, and needed for summaries." It has a "Connect to Ollama" button, which asks for the permission in the click.                                                                                                                                                         |
| Not reachable                          | `/api/version` fails or times out (2 s)           | "Ollama isn't running on this computer." It has two lines. "Not installed?" opens ollama.com/download in a tab, which is ordinary navigation, not an extension request. "Installed?" says "open the Ollama app; on Linux, run `ollama serve`", with a copy button. It also has "Check again", and it rechecks every 5 s. |
| Refused                                | `403` from `/api/version`                         | "Ollama is running but refused this extension." It shows the setting to make, per platform, with a copy button: macOS `launchctl setenv OLLAMA_ORIGINS "moz-extension://*"`, then restart Ollama; Linux and Windows set the environment variable for the service.                                                        |
| Running, no suitable model             | `/api/tags` lists no model with a bundled profile | The recommended models, each with its size: `nomic-embed-text` for embeddings, `qwen3:4b` for summaries in phase B. Each has "Download in Ollama", which calls `POST /api/pull` and shows its progress, and the `ollama pull …` command as an alternative.                                                               |
| Running, model present, not registered | the model is listed, but not recorded             | "Use nomic-embed-text". One click registers it, runs conformance and activates it, showing each step.                                                                                                                                                                                                                    |
| Active                                 | registered, conformant, active                    | "Active: nomic-embed-text · 768 dimensions", the last measured throughput, and "Measure speed".                                                                                                                                                                                                                          |

**Downloading through Ollama.** `POST /api/pull` makes Ollama, not the extension, download from its own registry, and only when the user clicks. The extension's own traffic stays on loopback. The maintainer agreed to this on 2026-10-13. The `ollama pull …` command stays shown as an alternative.

**When Ollama stops later.** Nothing breaks. Capture, clusters (structurally), snapshots and the tree carry on, and embedding jobs fail and retry with the queue's backoff.

- Whether local AI is paused is read from the queue, not remembered: it is paused while the active embedding model is Ollama's and a job waits with a failure reason saying Ollama did not answer (`isLocalAiPaused`). A flag would be lost each time the event page unloads; the queue is not.
- A job stopped this way must not burn its retries and end `failed` while Ollama is merely closed. So whenever the background would run jobs — a page is captured, or the options card looks at Ollama — and local AI is paused, it asks Ollama once; if Ollama answers, every such job is handed back due now with its attempts reset (`requeuePausedJobs`). That is what makes "resumes when it's back" true.
- The popup shows one quiet line while it is set: "Local AI is paused: Ollama isn't running. Pages are still recorded; similarity resumes when it's back." It has an "Open settings" link.
- There is no automatic fallback to the in-extension model. Its vectors belong to another space, and switching spaces is the model swap (REQ-LIN-003), not a fallback.

**First run.** With no embedding model at all, the popup shows nothing about AI. The options card is the only entry point, because the extension is fully useful without a model, and a prompt would nag.

### Setup made simple (phase A2)

The first build worked but asked a newcomer for seven steps, two of them in a terminal. The maintainer asked for a setup someone who has never used such tools can follow. Decided on 2026-10-13:

- **Ollama is optional, and looks it.** The card sits in a closed "Advanced: faster local AI with Ollama (optional)" section, open by default only once the server is connected. The extension stays fully usable with an in-extension model.
- **A checklist, not a state screen.** After "Set up Ollama" (which asks for the loopback permission inside the click, since nothing can be observed before it), the card shows four plain-language steps that tick themselves from what the status check sees: _Install Ollama_ (link), _Open Ollama_ ("look for the llama in the menu bar"), _Allow this extension_ (only when refused), _Turn on local AI_ (one button). "Not installed" and "not running" cannot be told apart from the extension, so the first two steps are pending together and both are explained.
- **One button turns it on.** `ollama.enable` pulls the recommended model if the server lacks it, registers it and runs conformance and activation, reporting one progress (`downloading n%` → `checking quality` → done). The separate pull and register messages stay for the model list under "More models".
- **Allowing the extension is honest and persistent.** Rewriting the request's `Origin` so Ollama's check passes was considered and rejected: that check is Ollama's protection against other pages and extensions driving the local server, and an extension that defeats it is bypassing the user's own software (and is a likely add-on review rejection). Instead the step shows one command that admits **only this extension's origin** (`moz-extension://<this installation's id>`, read from `runtime.getURL("")`) rather than `moz-extension://*`, which would admit every extension. On macOS the command also installs a LaunchAgent that sets the variable at each login, since `launchctl setenv` alone is lost on restart, and then reopens Ollama. Linux (systemd override) and Windows (`setx`) get their own command, chosen by `runtime.getPlatformInfo`.
- **The popup links to settings.** A small "Settings" link is always in the popup; the paused notice keeps its own link.

### Background routing

`loadEmbeddingSession(model)` checks `model.manifest.reference.hub`:

- `huggingface` goes to the worker, as now;
- `ollama` goes to `createOllamaEmbedder(fetchResource, manifest)`.

`model.activate`'s conformance follows the same routing. New messages:

| Request           | Answer                                  |
| ----------------- | --------------------------------------- |
| `ollama.list`     | `ollama.models` or `ollama.unreachable` |
| `ollama.register` | `model.installed`                       |

Registering stores the model inactive, `conformance: "pending"`, with `diskBytes` from `/api/tags` `size`. No files are stored.

### Policy and permission

- `wxt.config.ts` adds `http://127.0.0.1:11434` to `connect-src`, from a constant `LOCAL_INFERENCE_ORIGINS`.
- It adds `http://127.0.0.1:11434/*` to `optional_host_permissions`.
- The options page's "Connect to Ollama" calls `permissions.request({ origins: [...] })` synchronously in the click, then sends `ollama.list`.
- The background's `fetchResource` is the extension's own `fetch`, so the policy applies to it.

### Phase B: designed now, built after the gate

- `createOllamaGenerator(fetch, manifest)` implements `generate(request)` as a `GenerationStream` over `POST /api/chat` with `stream: true`:
  - `options.num_predict = maxTokens`;
  - an `AbortSignal` passed to `fetch`;
  - `stoppedBecause` from `done_reason`.
- Structured output sends `format: schema`, and validates the result with valibot, discarding a failure. That holds even though Ollama constrains output, because the requirement says so whenever the runtime's guarantee is not ours.

### Tests

- **Unit.** `fetch` is stubbed with recorded Ollama answers.
- **Background.** The register → conformance → activate → embed → pause → resume path runs in `app/backgroundApp` specs against a fake Ollama behind the `fetchResource` dependency, through the same handlers the extension uses.
- **e2e — decided in 4.1: limited to the card's first state and the policy.** The extension reads no test preference, and its `connect-src` admits only `http://127.0.0.1:11434`, so a fake on the page server's port would be blocked by the policy itself. A fake bound to port 11434 would collide with a real Ollama on the developer's machine and make the suite depend on what else is running. So the e2e checks that the card asks to connect before anything is sent to the server, and that the policy report lists the loopback origin. The run against a real Ollama is manual (tasks 5.x).

## Risks / Trade-offs

- **[Ollama's default origins do not admit `moz-extension://`]** (confirmed) → The checklist's "allow this extension" step gives one copyable command naming only this extension's origin.
- **[The extension's id changes on reinstall, and Ollama may start at login before the LaunchAgent sets the variable]** → Ollama then refuses the extension again; the status check sees it and the checklist shows the step again (for the race: quit and reopen Ollama).
- **[A model re-pulled under the same tag changes its weights]** → The digest check before each use refuses it, and the user registers it again, which makes a new space.
- **[A new connection type in a no-network extension]** → It is loopback only, opt-in through a permission, and enumerated in the policy and the spec. No data leaves the machine.
- **[Speed is the user's hardware's]** → Findings record the measured throughput, and NFR-004 is re-examined against it.

## Open Questions

- Do the default `OLLAMA_ORIGINS` admit `moz-extension://*`? This is answered by task 5.2 on a real install, and changes only the error text and the README.

## Findings

**Ollama 0.40.3 on macOS, installed with `brew install --cask ollama` (2026-10-13).**

- **The default `OLLAMA_ORIGINS` do not admit the extension (task 5.2).** Every request carrying `Origin: moz-extension://…` is answered `403`, `GET` and `POST` alike. The user has to set `OLLAMA_ORIGINS` as the card says.
- **Firefox sends no `Origin` with an extension background's `GET`, only with its `POST`.** So `GET /api/tags` succeeds against a server that refuses the extension, and the first build of the card reported "running" and then failed the download with `HTTP 403`. The status check now also sends `POST /api/show` with an empty model, which Ollama answers `400` when it admits the origin and `403` when it does not. Every `403` from a working request now reads "refused this extension".
- In `npm run dev`, the policy report lists `ws://127.0.0.1:3100` refused by `connect-src`: that is WXT's reload socket, a development-only request, not the extension's.
- **Register, conformance and activation work against a real server (task 5.1, first half).** With `OLLAMA_ORIGINS="moz-extension://*"` set and Ollama restarted, "Download in Ollama" pulled `nomic-embed-text:latest` (274.3 MB, F16), and "Use" registered it pinned to digest `0a109f422b47…`. Every conformance probe passed: 60 vectors for 60 texts, 768 dimensions, unit length, 20 of 20 paraphrase pairs ordered correctly (18 required), and a repeat similarity of 1.00000 (0.999 required). The model is active.
- **Throughput meets NFR-004 (task 5.3).** The benchmark measured 46.5 chunks/s for `nomic-embed-text` through Ollama: a batch of 40 chunks in 0.86 s, with no load cost on the extension's side. That is more than twice the budget of 20 chunks/s, with a 768-dimensional model larger than any the extension runs itself.
- **A real page is embedded end to end (task 5.1, second half).** A product page read for 54 s and scrolled to 100% became deep read; its text (5.6 KB) was kept and split into 3 chunks, and all 3 were embedded through Ollama into the active space.
- **Gate for phase B: passed.** Ollama admits the extension once configured, its model passes conformance, it is more than twice as fast as the budget, and a real page goes from capture to vectors through it.
- **The macOS app refuses a scripted quit (task 5A.6).** The first run of the allow command set the variable and wrote the LaunchAgent, but `osascript -e 'quit app "Ollama"'` failed with "Ollama got an error: User canceled. (-128)", so Ollama kept running with its old environment and still refused the extension. The command now stops the app and its server with `killall Ollama ollama` before reopening it; run by hand on the maintainer's machine, that restarted both and the probe from this extension's origin went from 403 to 400 (admitted).
- **Set up through the checklist alone (task 5A.6, first half).** With the corrected allow command, the card on the maintainer's machine went from "Allow this extension" to "✓ Local AI is on, using nomic-embed-text:latest" with no other step; the model's checks all passed again (20 of 20 pairs, repeat similarity 1.00000). Still to confirm: the setting survives a restart of the Mac.
