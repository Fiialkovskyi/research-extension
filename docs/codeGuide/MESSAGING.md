# 5. Messaging between contexts

The extension runs in several JavaScript contexts that share no memory: the popup, the options
page, the background event page and the inference worker. Everything one asks of another crosses a
boundary as a message, and every message is treated as untrusted on arrival. This section is about
that crossing.

- [5.1 The contexts and their channels](#51-the-contexts-and-their-channels)
- [5.2 The envelope](#52-the-envelope)
- [5.3 Who owns a message](#53-who-owns-a-message)
- [5.4 Receiving a message](#54-receiving-a-message)
- [5.5 Answering, and failing](#55-answering-and-failing)
- [5.6 Ports and one-shot messages](#56-ports-and-one-shot-messages)
- [5.7 The background](#57-the-background)
- [5.8 The worker](#58-the-worker)
- [5.9 Adding a message: checklist](#59-adding-a-message-checklist)
- [5.10 Known deviations](#510-known-deviations)

## 5.1 The contexts and their channels

```
 popup ─┐                                      ┌─ IndexedDB (only writer)
        ├── runtime port ──►  background  ─────┤
options ┘   (RPC envelope)    event page       └─ inference worker
                                  │               (postMessage, RPC envelope,
                                  └──────────────► request/response by id)
```

| Context    | Talks to                  | Over                                   | May use `browser.*` |
| ---------- | ------------------------- | -------------------------------------- | ------------------- |
| popup      | background                | `browser.runtime` port                 | in `main.tsx` only  |
| options    | background                | `browser.runtime` port                 | in `main.tsx` only  |
| background | surfaces, worker, storage | ports, `Worker.postMessage`, IndexedDB | yes                 |
| worker     | background only           | `self.postMessage`                     | **no**              |

Two rules follow from the picture:

- **The background is the only coordinator.** Surfaces never talk to the worker or to each other,
  and never write storage. A surface sends an intent; the background does the work and answers.
- **The worker touches no extension API.** Its whole world is the messages it receives, which keeps
  the browser surface in one context and the worker checkable by reading one file.

## 5.2 The envelope

Every message, on every channel, is the same envelope:

```ts
interface RpcMessage<TType extends string, TPayload> {
  readonly v: typeof RPC_VERSION; // protocol version, currently 1
  readonly type: TType; // "model.install", "worker.pong", …
  readonly id: string; // fresh UUID per message
  readonly payload: TPayload;
}
```

- **Built only by `buildRpcMessage(type, payload)`** from `@/shared/rpc`. A hand-written object
  literal skips the version and the id.
- **Parsed only by `parseRpcMessage(candidate, schemas)`**, which checks the envelope, the version,
  the type and the payload, in that order, and throws `RpcMessageError` with a `rejection` of
  `not-an-envelope`, `unsupported-version`, `unknown-type` or `invalid-payload`.
- **`RPC_VERSION` changes** only when the envelope itself changes, never for a new message type. A
  receiver refuses any other version rather than guessing at its shape.
- **Payloads are plain data**: what survives structured clone. No functions, no class instances, no
  `Date` (use epoch milliseconds), no `Map`. `ArrayBuffer` is allowed and is how model files reach
  the worker.

## 5.3 Who owns a message

**The feature that does the work owns its messages.** It declares them in its `schemas.ts` as two
maps keyed by message type:

```ts
// src/features/modelRegistry/schemas.ts
export const modelRegistryRequestSchemas = {
  "model.list": v.object({}),
  "model.activate": v.object({
    ref: v.pipe(v.string(), v.minLength(1)),
    device: v.optional(v.picklist(INFERENCE_DEVICES)),
  }),
} as const;

export const modelRegistryResponseSchemas = {
  "model.listed": v.object({ models: v.array(installedModelSummarySchema) }),
  "model.activated": v.object({ … }),
  "model.activationFailed": v.object({ ref: v.string(), reason: v.string() }),
} as const;
```

- **`shared/rpc` knows no feature.** It is generic over the schema map; that is what keeps `shared`
  from depending on everything above it.
- **The receiver composes the maps it admits**, by spreading the features' maps, in its composition
  root:

```ts
// src/app/backgroundApp/index.ts
const requestSchemas = {
  ...benchmarkRequestSchemas,
  ...diagnosticsRequestSchemas,
  ...inferenceRequestSchemas,
  ...modelInstallRequestSchemas,
  ...modelRegistryRequestSchemas,
} as const;
```

- **Message types are unique across the extension**, because maps are merged by spreading and a
  duplicate key would silently replace another feature's schema. The `<domain>.` prefix
  ([2.10](./NAMING.md#210-message-types-events-and-test-ids)) is what keeps them apart.
- **Each schema is commented** with what the message asks or reports and why its fields are what they
  are — the schema is the protocol's documentation.
- **Schemas are as strict as the data allows**: `minLength(1)` for identifiers, `integer()` and
  `minValue(0)` for counts, `picklist` for closed sets — derived from the constant that defines the
  set (`INFERENCE_DEVICES`), never a second hand-typed list.

## 5.4 Receiving a message

**Nothing that arrives is trusted.** Another extension, a stale page from an older build, or a bug of
our own can send any shape. So every receiver:

1. **parses** the candidate with the map of messages _it_ admits — before reading any field;
2. **switches on `type`**, exhaustively, with no `default`;
3. handles each case with the payload already typed by its schema.

```ts
let request;

try {
  request = parseRpcMessage(candidate, requestSchemas);
} catch (error) {
  return fail(error instanceof Error ? error.message : String(error));
}

switch (request.type) {
  case "model.list": { … }
  case "model.activate": { … }
  // no default: a new message type without a case stops this function from
  // returning on every path, and the compiler reports it
}
```

**What a receiver does with a message it cannot parse** depends on who is waiting:

| Receiver   | On `RpcMessageError`                                                                                         |
| ---------- | ------------------------------------------------------------------------------------------------------------ |
| background | answers `rpc.refused` with the `rejection` and the reason                                                    |
| worker     | answers `worker.error` under the id it could recover (`readMessageField`), so the caller is not left waiting |
| surface    | drops the message — one malformed answer must not take the surface down                                      |

Any error that is **not** an `RpcMessageError` is rethrown: it is a bug, not a bad message.

`readMessageField` exists for exactly that recovery — reading `id` or `type` from a message that
failed to parse. It is never used to read a payload.

## 5.5 Answering, and failing

- **Protocol-level answers belong to `shared/rpc`** (`rpcResponseSchemas`), because they can answer
  any request: `rpc.refused` when a message could not be trusted (with its `rejection`), and
  `rpc.failed` when a trusted request failed in a way its own feature did not answer for — a bug,
  still answered so the surface is never left waiting. Every surface admits both alongside the
  features' responses.
- **Every request gets exactly one final answer.** Progress may come before it (see
  [5.6](#56-ports-and-one-shot-messages)); nothing comes after it.
- **Failure is a message, not an exception across the boundary.** Each request that can fail has a
  failure response — `<domain>.<verb>Failed` with a `reason` string — and the handler catches and
  converts:

```ts
case "model.install": {
  try {
    const model = await installModel({ … });
    return buildRpcMessage("model.installed", { ref: model.ref, diskBytes: model.diskBytes, … });
  } catch (error) {
    return buildRpcMessage("model.installFailed", {
      repository,
      reason: error instanceof Error ? error.message : String(error),
    });
  }
}
```

- **A `reason` is written for a person.** It is shown on screen as it is, so it says what failed and
  why, in a sentence (see the Errors section).
- **A failure response carries the subject's identity** (`ref`, `repository`), so the surface knows
  which request failed without correlating ids.
- **Correlation by id** is for request/response channels — the worker — where several requests can
  be in flight and answers may arrive out of order. The answer reuses the request's `id`; the caller
  keeps a map of pending requests, each with a timeout (`INFERENCE_REQUEST_TIMEOUT_MS`), and rejects
  them all when the worker crashes or is terminated.
- **Surfaces react by type, not by id.** The background's answers on a port are events the surface's
  reducer folds in; the surface does not wait on a particular reply.

## 5.6 Ports and one-shot messages

| Use a port (`browser.runtime.connect`) when…         | One-shot (`sendMessage`) is enough when… |
| ---------------------------------------------------- | ---------------------------------------- |
| work streams progress before its answer (an install) | the answer is immediate and single       |
| the surface stays open and receives several answers  | a caller asks once and moves on          |
| work must keep the event page alive while it runs    | —                                        |

Both surfaces use a port today. The background serves both through the same `handleMessage`; on a
one-shot message, progress has nowhere to go and is dropped.

The surface side of a port is wrapped in a structural client (`SurfaceClient`: `send`,
`subscribe`) built in `main.tsx`, so the composition root never sees `browser.*` and is tested with
a stub.

## 5.7 The background

- **Listeners are registered synchronously**, at the top of `defineBackground`, before any `await`.
  Firefox runs an MV3 background as an event page and unloads it freely; a listener attached after
  an `await` misses the message that woke the page.
- **Dispatch lives in `app/backgroundApp`**, not in the entrypoint. The entrypoint supplies real
  dependencies (`createInferenceWorker`, `openDatabase`, `fetchResource`, `policyViolations`) and
  forwards `onMessage` / `onConnect` to the app.
- **Expensive resources start on first need** and are kept in the app's closure:
  `worker ??= dependencies.createInferenceWorker()`. An event page wakes often, for messages that
  need neither the worker nor the database.
- **A failed or switched runtime gets a fresh worker.** The model runtime memoises its backend per
  realm, so after a failure, or when the compute device changes, the background discards the worker
  rather than asking the same one again.
- **It is the only writer of IndexedDB.** See the Storage section.

## 5.8 The worker

- **One file of wiring**, `entrypoints/inferenceWorker/index.ts`: parse, switch, call into
  `features/inference`, reply. The logic it calls carries the tests.
- **No `browser.*`, no storage.** The background reads the verified model files and sends them in the
  `model.load` request; the worker never fetches and never reads the database.
- **The model runtime is imported dynamically**, inside the `model.load` case, so a capability probe
  does not pay to load the largest module in the package.
- **One model at a time.** A new load unloads the previous one first.
- **Always reply.** Every path through the handler ends in `reply(…)`, including the `catch`, which
  answers `worker.error` with the request type and reason.

## 5.9 Adding a message: checklist

1. Add the request schema to the owning feature's `…RequestSchemas` in its `schemas.ts`, with a
   comment saying what it asks and why each field is there.
2. Add the success response and, if it can fail, a `…Failed` response with `reason` and the
   subject's identity, to `…ResponseSchemas`.
3. Name both per [2.10](./NAMING.md#210-message-types-events-and-test-ids); check the type is unique.
4. Add the `case` in the receiver's switch — the compiler will tell you where.
5. If a surface sends it, add an intent function in the root that dispatches a local event and sends
   the request; add the response to the root's response map and a reducer case.
6. Test it through the composition root: a spec sends the raw message to `handleMessage` (or the
   surface's stub client) and asserts the answer — including the malformed-payload case.

## 5.10 Known deviations

None found on 2026-10-09.
