# Design

## Decisions

### 1. Latency from the node's own timestamp

The suite runs on the same machine as Firefox, so its `Date.now()` before the navigation command
and the background's `createdAt` share a clock. The difference is therefore the whole path,
including the page load from the local server. Polling the database adds nothing to it, because
`createdAt` is stamped when the node is written.

### 2. Memory as an upper bound

- **The process.** `ChromeUtils.requestProcInfo()` reports memory per process, not per add-on. The
  background lives in the one `extension` process, together with Firefox's built-in add-ons, so
  that process's memory bounds the background's from above.
- **Settled memory.** The suite's own database reads leave garbage there, and freed memory reaches
  the system with a delay. So the suite first calls `minimizeMemoryUsage`, which is about:memory's
  "Minimize memory usage", then takes the least of ten samples a second apart.

## Risks / Trade-offs

- **[Built-in add-ons grow]** A Firefox release could add to the shared process's baseline, which
  is about 62 MB today. → The log prints every sample. If the gate fails without a change of ours,
  the baseline is the first thing to compare.
