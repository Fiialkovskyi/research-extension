# Proposal

## Why

Section 13 makes the NFR budgets release gates. Clustering already has one (REQ-NFR-009, in
`clusterSession`'s spec). Nothing measured the two budgets that hold without any model: how fast a
page becomes a node (REQ-NFR-001), and how much memory the background keeps (REQ-NFR-003).

## What Changes

- **`performance.e2e.ts`.**
  - **Node latency.** The suite starts a session and makes 20 navigations in a session tab. For
    each, it takes the time from the navigation command to the node's `createdAt`, and asserts
    p95 ≤ 1 s. The first runs measured 12–69 ms.
  - **Background memory.** The suite asks every process to minimise memory, as about:memory does,
    then samples the extension process ten times a second apart. It asserts the least sample
    ≤ 150 MB. That process also hosts Firefox's built-in add-ons, so the figure is an upper bound
    on the background's share. The first runs measured 116–123 MB settled; the idle baseline is
    about 62 MB.
- **The `performanceProbe` fixture.**
  - the process-memory and minimise-memory scripts;
  - their parser;
  - a nearest-rank percentile.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `extension-shell`: the suite gates node latency and background memory on their budgets.

## Impact

- **Code:**
  - `e2e/fixtures/performanceProbe/`;
  - `e2e/specs/performance.e2e.ts`.

  The extension itself is not changed.

- **Not gated here:**
  - REQ-NFR-002, content-script cost per event. It needs a profiler marker in the page.
  - REQ-NFR-004 and NFR-007, model throughput. They are measured in the opt-in network run and
    with Ollama by hand.
  - REQ-NFR-008, storage for a typical session. An estimate from the stored shapes is about
    1 MB:
    - 40 snapshots of a few KB, compressed;
    - about 400 chunk vectors of 1.5 KB each;
    - 100 small nodes.

    That is far inside 25 MB, so it is recorded rather than gated.

  - REQ-NFR-010, restore to first paint.
