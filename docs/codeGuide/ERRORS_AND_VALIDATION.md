# 8. Errors and validation

Two questions, answered once for the whole codebase: when may a value be trusted, and what happens
when something goes wrong.

- [8.1 Trust boundaries](#81-trust-boundaries)
- [8.2 Validating with valibot](#82-validating-with-valibot)
- [8.3 Throwing](#83-throwing)
- [8.4 Error messages](#84-error-messages)
- [8.5 Catching](#85-catching)
- [8.6 Errors that cross a boundary](#86-errors-that-cross-a-boundary)
- [8.7 Logging](#87-logging)
- [8.8 Known deviations](#88-known-deviations)

## 8.1 Trust boundaries

A value is **untrusted** from the moment it comes from anywhere the type checker cannot see:

| Source                                              | Typed as           | Becomes trusted through                                                          |
| --------------------------------------------------- | ------------------ | -------------------------------------------------------------------------------- |
| A message from a port or `postMessage`              | `unknown`          | `parseRpcMessage` with the receiver's schema map                                 |
| A network response (`response.json()`)              | `unknown`          | the response's schema (`parseModelTree`, `readModelLimits`)                      |
| A URL or string from outside                        | `string`           | a `parse…` function (`parseHubFileUrl`)                                          |
| A script result from Firefox's chrome context (e2e) | `unknown`          | a `parse…` function with a schema                                                |
| `JSON.parse`                                        | `unknown`          | a schema — never `as T`                                                          |
| A record we wrote to IndexedDB                      | its `Stored…` type | migrations keep it current ([6.6](./STORAGE.md#66-migrations))                   |
| A bundled constant (a profile)                      | its type           | guard specs ([1.7](./PROJECT_STRUCTURE.md#17-constantsts-schemasts-and-typests)) |

**Validate once, at the boundary, then trust.** Code past the boundary works with typed values and
does not re-check them. Code before it reads nothing but the raw value.

## 8.2 Validating with valibot

- **Schemas live in `schemas.ts`** ([1.7](./PROJECT_STRUCTURE.md#17-constantsts-schemasts-and-typests))
  and are named per [2.7](./NAMING.md#27-schemas).
- **`v.safeParse` and a domain error** is the default: the caller gets a sentence about what was
  wrong in its own terms, not valibot's issue list.

```ts
const parsed = v.safeParse(revisionResponseSchema, await response.json());

if (!parsed.success) {
  throw new Error(
    `Could not resolve ${repository}@${reference}: the hub's answer did not carry a commit identifier.`,
  );
}

return parsed.output.sha;
```

- **`v.parse`** (which throws valibot's own error) only where the message does not reach a person —
  e2e helpers, spec setup.
- **Schemas describe only what is used.** A schema for an external response lists the fields the
  code acts on and lets the rest through (`v.looseObject` for a configuration file we read two keys
  from). Validating fields we ignore makes us fragile to changes that do not concern us.
- **Schemas for our own messages are strict**: `v.object`, closed `picklist`s, bounds on numbers.
- **Derive the type from the schema** ([3.5](./TYPESCRIPT_AND_FUNCTIONS.md#35-types-shapes-and-unions));
  never write the shape twice.

## 8.3 Throwing

- **Throw `Error`**, with a message per [8.4](#84-error-messages). A custom subclass only when a
  caller must branch on the kind of failure, and then it carries a discriminant
  (`RpcMessageError.rejection`), sets `name`, and lives in the file of the function that throws it.
- **Never throw a string or a plain object.**
- **Throw at the first point the failure is known**, with the context available there — the
  repository, the path, the status — rather than letting `undefined` travel and fail elsewhere.
- **`assert…` functions** throw and return nothing ([2.3](./NAMING.md#23-the-verb-dictionary)); use
  one when the same check guards several call sites.
- **Document it**: an exported function that can throw says when in `@throws`.
- **Absence is not an error by default.** A lookup returns `undefined`; the caller decides whether
  that is a failure ([3.7](./TYPESCRIPT_AND_FUNCTIONS.md#37-undefined-and-null)).

## 8.4 Error messages

An error message is read by a person — on the options page, in a test failure, in a bug report. It
is written as a sentence that says **what failed, on what, and why**:

```
Could not resolve Xenova/all-MiniLM-L6-v2@main: the hub answered 404.
"config.json" in Xenova/bge-small-en-v1.5 is not valid JSON.
No model is installed under "Xenova/all-MiniLM-L6-v2@751bff37…".
Xenova/foo is gated (manual), so it cannot be installed: access requires accepting terms with an
account, and model downloads carry no credentials.
```

- **Start with what failed**: `Could not <verb> <subject>: <reason>.` is the default shape; a plain
  statement of fact (`No model is installed under …`) when there is no action to name.
- **Name the subject concretely** — the repository, the path, the ref, the message type — in quotes
  when it is an identifier.
- **Give the reason the code knows**, including an HTTP status or the field that was missing.
- **When the cause is a decision of ours, say so**, so nobody "fixes" it: "model downloads carry no
  credentials".
- **A full sentence with a full stop.** No "Error:" prefix, no codes without words, no
  "Something went wrong".
- **Never include content** a user was reading, or anything secret.

## 8.5 Catching

- **Catch only to do something**: convert to a message ([8.6](#86-errors-that-cross-a-boundary)),
  add context, clean up, or recover. A `catch` that only rethrows is removed.
- **Adding context keeps the original**: the new message includes the old one, or the original is
  passed as `cause`.

```ts
try {
  return await response.json();
} catch {
  throw new Error(`"${path}" in ${reference.repository} is not valid JSON.`);
}
```

- **A bare `catch {}`** (no binding) only when the error's content is irrelevant and the comment or
  the next line says what is assumed instead.
- **Narrow before handling**: `if (error instanceof RpcMessageError) { … }`; anything else is
  rethrown — an unexpected error is a bug and must stay loud.
- **The caught value is `unknown`.** Read a message from it with `getErrorMessage(error)` from
  `@/shared/getErrorMessage`, never by repeating `error instanceof Error ? … : String(error)`.
- **Clean up on failure**: a multi-step operation that wrote something removes it before the error
  leaves (`removeStoredFiles`).
- **No swallowed promises**: `.catch(() => null)` only where `null` is then handled on the next line
  as a meaningful case (`getAvailableDevices`: no adapter means no GPU path).

## 8.6 Errors that cross a boundary

An exception does not cross a context boundary. Each boundary converts it:

| Boundary                     | An error becomes                                                                                           |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------- |
| background handler → surface | a `…Failed` response with `reason` ([5.5](./MESSAGING.md#55-answering-and-failing))                        |
| worker → background          | `worker.error` with `requestType` and `reason`, which the worker client turns back into a rejected promise |
| surface → screen             | `state.problem` or the component's failed state, shown as text                                             |
| unparseable incoming message | per receiver ([5.4](./MESSAGING.md#54-receiving-a-message))                                                |

A background handler never lets an exception escape: dispatch has an outer `try` that turns anything
unexpected into `rpc.failed` with the request's type, so a surface never waits for a reply that will
not come.

## 8.7 Logging

- **No `console` in `src/`.** The lint rule `no-console` is an error. A problem a user should know
  about is shown on a surface; one a developer should know about is a failing test.
- `console` is allowed in `scripts/` and in e2e specs, where its output is the point (the network
  spec prints the measured throughput).
- **What the policy refused is collected, not logged**: `collectPolicyViolations` records blocked
  requests, and the options page shows them — a console message nobody reads proves nothing.

## 8.8 Known deviations

Found on 2026-10-09. Fix each when the file is next touched; delete the line when you do.

- `e2e/fixtures/firefoxToolbar/…/parsePopupSnapshot` and `parsePanelState` cast `JSON.parse` instead
  of validating (see [3.11](./TYPESCRIPT_AND_FUNCTIONS.md#311-known-deviations)).
- `src/shared/rpc/parseRpcMessage/index.ts` messages are fragments without a full stop
  (`Message is not an RPC envelope`); the `#root` errors in both `main.tsx` files likewise.
