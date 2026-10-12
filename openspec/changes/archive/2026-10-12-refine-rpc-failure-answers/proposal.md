# Proposal

## Why

The background answered every message it could not handle with `inference.failed`, whatever the
request was about. A message that was not an envelope, a type no feature owns, a payload its schema
refused, and an unexpected error inside a handler all looked the same to a surface — and all looked
like an inference problem. A surface could not tell a protocol refusal from a failed operation, and
the type name misled anyone reading a log of the exchange.

Reviewing the code against the new code guide (`docs/codeGuide/`) surfaced this, together with two
smaller defects fixed in the same change because they sit on the same path.

## What Changes

- Add two **protocol-level answers**, owned by `shared/rpc` rather than by any feature, because they
  can answer any request:
  - `rpc.refused` — the message could not be trusted. Carries the `rejection` (`not-an-envelope`,
    `unsupported-version`, `unknown-type`, `invalid-payload`) and a reason.
  - `rpc.failed` — a trusted request failed in a way its own feature did not answer for. Carries the
    request type and a reason. A bug rather than an expected outcome, still answered so a surface is
    never left waiting.
- `inference.failed` keeps only its own meaning: the capability probe failed.
- The options surface admits both answers and shows their reason as the surface's problem.
- **Activation becomes one transaction.** Recording the activated model and deactivating the other
  models of its family were two writes; a failure between them could leave a family with two active
  models. They now share one `readwrite` transaction.
- A single `getErrorMessage` in `shared/` replaces eight copies of
  `error instanceof Error ? error.message : String(error)`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `extension-shell`: adds the requirement that the background answers every message, and
  distinguishes a refused message from a failed one.

## Impact

- **Modified code:** `src/shared/rpc` (new `schemas.ts`, `RPC_REJECTIONS`), `src/app/backgroundApp`,
  `src/app/optionsApp` and its reducer, `src/features/modelRegistry/model/activateModel`, the four
  sites that read an error message.
- **New code:** `src/shared/getErrorMessage`.
- **Protocol:** two new response types; no request changes; `RPC_VERSION` unchanged, since the
  envelope did not change.
- **Storage:** no schema change.
