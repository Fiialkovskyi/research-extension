# Design

## Context

Every context speaks the RPC envelope from `shared/rpc`, and each feature owns the schemas of its
own messages. The background parses each incoming message against the union of the features'
request schemas and switches on its type. Before this change, one helper answered every failure
outside a feature's own `…Failed` response with `inference.failed`.

## Goals / Non-Goals

**Goals:**

- A surface can tell "your message was refused" from "your request failed unexpectedly", and both
  from a feature's own failure.
- No answer about the protocol is owned by a feature.
- Every request still receives exactly one final answer.

**Non-Goals:**

- Changing the envelope or `RPC_VERSION`.
- Validating outgoing payloads against their request schema (recorded as a known deviation in
  `docs/codeGuide/MESSAGING.md`).

## Decisions

### Protocol answers live in `shared/rpc`

`rpcResponseSchemas` sits beside the parser that produces the refusals. A feature cannot own
them: a refused message may name no feature at all. Surfaces spread `rpcResponseSchemas` into their
response map next to the features' maps.

### `rpc.refused` carries the parser's `rejection`

`RpcRejection` was a type only. It is now derived from `RPC_REJECTIONS`, a constant, because the
refusal travels over the wire and its schema needs the closed set.

### The probe answers for itself

`inference.probe` gained its own `try`, so a worker failure during a probe is still
`inference.failed` — a real inference failure — and only what no case handles reaches the outer
`rpc.failed`.

### Activation writes in one transaction

The conformance suite runs before the transaction opens: it loads a model into the worker, and an
IndexedDB transaction commits as soon as it has no pending request, so awaiting the worker inside
it would end it. The transaction then holds only the writes.

## Risks / Trade-offs

- A surface built before this change does not admit `rpc.*` and drops them as unknown. Both surfaces
  ship in the same package, so no such surface exists.
