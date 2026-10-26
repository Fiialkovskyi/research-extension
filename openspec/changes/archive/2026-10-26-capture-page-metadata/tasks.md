# Tasks

## 1. Reading the metadata in the page

- [x] 1.1 Add `readPageMetadata` to a new `pageMetadata` feature: reads the fields from a `Document`, cleans and cuts each to its limit, drops a non-`http(s)` canonical link and empty fields, returns `undefined` when nothing is left; verify jsdom specs for each field, `og:` over plain tags, the limits, a bad canonical link, whitespace, and a page with no metadata.
- [x] 1.2 Add the `page.metadata` message and its answer to the observer's request and response schemas, with the limits as bounds; `schemas.ts` carries no spec of its own, so the bounds are verified where they act: the `observePage` specs here and the `backgroundApp` specs for an overlong field in 2.3.
- [x] 1.3 Send it once when `observePage` starts, through the content script's wiring; verify an `observePage` spec that one message is sent, none when the page has no metadata, and that a failed send changes nothing else.

## 2. Storing it

- [x] 2.1 Add the `pageMetadata` store (key `nodeId`, index `sessionId`), `StoredPageMetadata` and database version 25 with a forward-only upgrade step; verify the upgrade and store-list specs.
- [x] 2.2 Add `recordPageMetadata`: seals the description with the data key (no compression), writes one record per node, replacing an earlier one, and fills a blank or address-only node title from the metadata title; verify specs for the sealed field, replacement, a node that no longer exists, and the title rule both ways.
- [x] 2.3 Handle `page.metadata` in `backgroundApp`: for the tab's current node only, otherwise `signal.dropped`; verify specs for a current page, a page the tab left, a tab outside every session and a denylisted page.

## 3. A weak vector for unread pages

- [x] 3.1 Add the `embedPageMetadata` job beside `embedSnapshot` in `snapshotEmbeddings`: text from the title and description, one vector with `chunkId` `metadata:<nodeId>`, skipped when the node has a snapshot; verify specs for the stored vector, a node with a snapshot, no active model, and a job that runs twice.
- [x] 3.2 Queue it from the background when metadata is stored and when an embedding model becomes active, idempotently, and register it in the job runner; verify `backgroundApp` and queue specs.
- [x] 3.3 Make `readPageVectors` skip a node's `metadata:` vector when the node has a chunk vector; verify specs for metadata only, text only, and both.

## 4. Deletion, end to end and docs

- [x] 4.1 Delete metadata in `deleteNode` and `deleteSession`, carry the store in `reattachSession`, and show what was kept (never the description's words) in `readRecordedSession` and the recorded-data view, where the user can see and delete it; verify the specs of each.
- [x] 4.2 Add an e2e: a session page's metadata is stored (read through the extension's database fixture), the description is not readable in the stored record, and a page outside the group stores none; add a fixture page with a head.
- [x] 4.3 Document the feature in `RESEARCH_GRAPH_EXTENSION_SPEC.md`, correct any text that says a node has only title and URL before deep read; verify `openspec validate capture-page-metadata` passes.
- [x] 4.4 Run `npm run verify`; report anything not run.
