# 10. Security and network policy

The extension makes promises a user cannot check for themselves: it runs only its own code, it
reaches only the hosts it declares, and it keeps what a user reads on their machine. This section is
how the code keeps those promises, and which changes are not ordinary code changes.

- [10.1 The guarantees](#101-the-guarantees)
- [10.2 No remote code](#102-no-remote-code)
- [10.3 No egress beyond declared hosts](#103-no-egress-beyond-declared-hosts)
- [10.4 No collection](#104-no-collection)
- [10.5 Untrusted input](#105-untrusted-input)
- [10.6 Permissions and the manifest](#106-permissions-and-the-manifest)
- [10.7 Dependencies](#107-dependencies)
- [10.8 Changes that need a spec](#108-changes-that-need-a-spec)
- [10.9 Known deviations](#109-known-deviations)

## 10.1 The guarantees

| Guarantee                              | Enforced by                                                                                                                                  |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| The package runs only its own code     | `script-src 'self' 'wasm-unsafe-eval'`; everything bundled                                                                                   |
| It reaches only the declared hosts     | `connect-src 'self'` + loopback Ollama (+ `MODEL_HOST_ORIGINS` only while in-extension models are on); `host_permissions` from the same list |
| Model bytes are what the manifest says | digest checked before storage; runtime remote loading off ([7.2](./MODEL_PIPELINE.md#72-the-two-invariants))                                 |
| It collects nothing                    | `data_collection_permissions: ["none"]`; no content in any stored record                                                                     |
| It sends no identity                   | every request is `credentials: "omit"`; no account, no token                                                                                 |

The enforcement points are **the browser's** wherever possible — the content security policy, not a
check in our code. A check in our code can be forgotten by the next function; the policy cannot.

## 10.2 No remote code

- **Every script, stylesheet, font and binary ships in the package.** No CDN, no `<script src="https://…">`,
  no dynamic `import()` of a URL.
- **No `eval`, `new Function`, or string timers** (`setTimeout("…")`). `wasm-unsafe-eval` in the
  policy permits the bundled ONNX Runtime to compile its own packaged WebAssembly — compilation of
  bytes we ship, not execution of fetched code.
- **Runtime binaries come from `public/ort/`**, copied out of `node_modules` by
  `scripts/syncOnnxRuntime.ts`, and the runtime is pointed at them (`getOnnxRuntimeWasmPaths`).
- **No `innerHTML` / `dangerouslySetInnerHTML`** with anything not written in the source. React's
  escaping is relied on; text from a model, a hub response or a page is always rendered as text.
- **Model files are data, not code.** They reach the runtime only through the verified cache.

## 10.3 No egress beyond declared hosts

- **Ollama on loopback** (`LOCAL_INFERENCE_ORIGINS`) is a required host permission, so setting AI up
  asks for no permission; nothing is sent there until the user starts setup, which the background
  records in storage (`aiSetup`). A grant cannot express that: page access (`<all_urls>`) covers
  loopback too, and the required permission is granted at install.
- **`MODEL_HOST_ORIGINS`** (`shared/huggingFace/constants.ts`) is the single list of model hosts,
  used only while `IS_IN_BROWSER_BACKEND_ENABLED` is on. The manifest's
  `connect-src` and `host_permissions` are built from it in `wxt.config.ts`, and the code that builds
  request URLs uses the same constants — so the policy, the permissions and the requests cannot
  drift apart.
- **URLs are built, not concatenated**: `buildHubUrl`, `getHuggingFaceFileUrl`, `getModelTreeUrl`
  encode each segment and refuse malformed references (a non-commit revision, an empty segment).
- **Every request is explicit and user-initiated.** Nothing fetches on install, on startup or in the
  background on its own; a download happens in answer to a message from a surface.
- **Every request omits credentials** (`credentials: "omit"`) and asks only for what it needs
  (`accept: "application/json"` for metadata).
- **`fetch` is injected** ([3.3](./TYPESCRIPT_AND_FUNCTIONS.md#33-signatures)), so every request site
  is visible as a parameter, and specs prove no unexpected request is made.
- **Refusals are observed**: `collectPolicyViolations` listens for `securitypolicyviolation` in the
  background (where requests are made) and the options page shows what was blocked. An empty list
  is evidence that the declared origins cover every host a download reaches.

## 10.4 No collection

- **Nothing about the user leaves the machine.** No analytics, telemetry, crash reporting or
  "anonymous" pings — none, not opt-in, not in development builds.
- **Content a user reads is never stored or logged.** Records hold counts and timings; the shape has
  no field for text ([6.7](./STORAGE.md#67-what-is-never-stored)).
- **Error messages carry no content** ([8.4](./ERRORS_AND_VALIDATION.md#84-error-messages)).
- **No `console` in `src/`** — logs are a place content could leak to, and no one reads them.

## 10.5 Untrusted input

Everything from outside the type system is validated before use ([8.1](./ERRORS_AND_VALIDATION.md#81-trust-boundaries)).
For security, three sources matter most:

- **Messages from other contexts**: any extension or page can try to message us; `parseRpcMessage`
  with a closed schema map refuses anything not in our protocol.
- **Hub responses**: an unexpected shape could otherwise be recorded as a model's identity, so the
  revision, tree and configuration responses are each parsed.
- **Model files**: checked against the manifest's digest before storage; a mismatch removes
  everything the install wrote.

## 10.6 Permissions and the manifest

- **The manifest is declared in `wxt.config.ts`**, with a comment on every security-relevant entry
  saying why it is there.
- **Permissions are the minimum** for what ships today: host permissions for the model hosts and
  nothing else. A permission is added with the first code that needs it, never in anticipation.
- **No content scripts, no `<all_urls>`, no `tabs`/`webRequest`** until a spec change introduces the
  capability that needs them.
- **`data_collection_permissions: ["none"]`** stays true; changing it is a product decision first.
- The extension id and minimum Firefox version come from `shared/config` and are covered by e2e.

## 10.7 Dependencies

- **A new runtime dependency is a security decision**: it runs with the extension's privileges.
  Prefer the platform, then a small focused package; justify anything large in the pull request.
- **Check what it fetches.** A library that loads models, fonts or code from a CDN by default must be
  configured not to (as the model runtime is), and the configuration commented.
- **Check what it bundles.** A dependency can add tens of megabytes through an export condition
  (`onnxruntime-web` embedded its binary twice until `wxt.config.ts` selected the external build).
  Look at the bundle size after adding one.
- Lockfile changes are reviewed like code.

## 10.8 Changes that need a spec

These are never made as a code change alone. Each needs an OpenSpec change that updates
`extension-shell` (or the relevant capability spec), and a reviewer who reads it as a security
change:

- adding an origin to `MODEL_HOST_ORIGINS`, or any other `connect-src` entry;
- any new permission, host permission or content script;
- relaxing `script-src`, `object-src` or any other policy directive;
- letting the model runtime fetch, or use a cache other than the verified one;
- storing a new kind of data, especially anything derived from page content;
- sending a request that is not in direct answer to a user action;
- any change to `data_collection_permissions`.

## 10.9 Known deviations

None found on 2026-10-09.
