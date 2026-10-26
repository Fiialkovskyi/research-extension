# Design

## Context

Today the observer sends scroll and copy signals and, once asked, one `content.extracted` message with the page's readable text. The background stores the text as an encrypted snapshot, and embedding works only on snapshots: `runEmbeddingJob` chunks a snapshot's text, and `readPageVectors` averages a node's vectors per space for clustering. `readSpaceCoverage` counts chunks, not vectors. A node's title comes from the tab (`updateTabTitle` on `tabs.onUpdated`). So a page that was never deep read has a title, a URL and no vector. Observed in `observePage`, `recordSnapshot`, `runEmbeddingJob`, `readPageVectors` and `updateTabTitle`.

## Goals / Non-Goals

**Goals:**

- Every page in a session gets a small, structured description of itself as soon as it loads.
- That description gives an unread page a first, weak place on the map and a better label when the tab title is poor.
- It adds no permission, no network, and no way for the page to learn what was stored.

**Non-Goals:**

- JSON-LD / schema.org blocks, `og:image`, Twitter cards, microdata (a follow-up for JSON-LD: richer for products and articles, but a parser and a size problem of its own).
- Reading metadata of a page outside a session, or after a denylisted navigation; the observer's scope is unchanged.
- Re-reading metadata when a single-page app changes its title or tags without a navigation (see Open questions).
- Using metadata for fact extraction. Facts come from the text.

## Decisions

### 1. The page pushes its metadata once; the background does not ask

Text is asked for because it is large and wanted only for deep-read pages. Metadata is a few hundred bytes wanted for every page, so the observer sends it once when it starts, in a `page.metadata` message, without a request. The observer is injected after the document is parsed (`document_idle`), so the head is in place. The background answers `page.metadata` like any observer message: for a page the tab has left it replies `signal.dropped` and stores nothing.

### 2. A new `pageMetadata` store, one record per node

A separate store (`pageMetadata`, key `nodeId`, index `sessionId`, database version 25, forward-only) rather than more fields on the node: the node is read by many surfaces on every change and the metadata is not needed by them, and a node's size and its change notifications stay as they are. Record: `nodeId`, `sessionId`, `capturedAt`, then optional `title`, `siteName`, `type`, `author`, `publishedAt`, `canonicalUrl`, and the sealed description (`keyId`, `cipher`, `iv`, `encryptedDescription`). A second `page.metadata` for the same node replaces the record; there is at most one.

### 3. The description is sealed, the rest is not

A description says what the page says, which is what REQ-SEC-005 protects, so it is encrypted with the data key exactly as snapshot text is (no compression: it is short). The title is already stored in the clear on the node, the URL likewise, and the site name, type, author and dates are of the same kind; sealing them too would hide nothing the node does not already show and would make every label a decryption. This is a judgment about where the line sits, recorded here so a later reader can move it.

### 4. Limits and cleaning in the page, validation in the background

The reader trims whitespace, collapses runs of it and cuts each field: title 300, description 1000, site name 100, type 50, author 200, canonical 2048, published time 64 characters. The message schema repeats the limits as the bound the background trusts, since a page can send anything. A canonical link that is not an `http(s)` URL is dropped. A field that is empty after cleaning is absent, not empty. A page with none of them sends nothing.

### 5. The node's title: only fill a gap

When the tab's title is blank, or equals the page's URL or host, the node takes the metadata title (`og:title`, then the document `title`). Otherwise the tab title stands: it is what the user sees in the tab strip and has been the label so far. After this, `tabs.onUpdated` still writes the tab's title as it does today, so a title that arrives later wins over the fallback. A rule that preferred `og:title` over a good tab title would change labels the user already knows for little gain; it can be added if the fallback proves too timid.

### 6. A weak vector for a node with no text

When a node has metadata and no snapshot, the background queues one `embedPageMetadata` job: the text is the title and the description, the role is `document`, the vector is stored as one `StoredVector` with `chunkId` `metadata:<nodeId>` in the active space. It is a job beside `embedSnapshot` in `snapshotEmbeddings`, using the same session loader and the same queue, so it is retried, checkpointed and bounded like any embedding. `readSpaceCoverage` counts chunks and is unchanged. `readPageVectors` skips a node's `metadata:` vector whenever the node has a vector from a real chunk, so a deep-read page is placed by its text alone and the weak signal never blends into the strong one. A job already done for the same text and space is not queued again, as for snapshots.

### 7. Deletion follows the node

`deleteNode` and `deleteSession` delete the metadata record; the `metadata:` vector is already deleted with the node's other vectors, which they find by node and by session. `reattachSession` and the library's read of a session carry the new store the way they carry snapshots.

## Risks / Trade-offs

- **Bad descriptions.** Marketing text, the same description on every page of a site, empty strings. A vector from a boilerplate description clusters pages by site rather than by topic. Mitigation: it is used only for pages with no text, and only until a text vector exists. The metadata title is part of the input, which usually differs per page. Accepted.
- **Pages that rewrite their head after load.** Single-page apps set `og:*` late. The first read may catch the site's generic tags. Accepted for now; see Open questions.
- **More at rest.** A record per node. Small, and removed with the node.
- **The page could notice nothing new.** The observer already runs there and reads the page's own head; nothing is injected into the page.

## Migration Plan

Database version 25 adds the empty store; nodes recorded earlier have no metadata and get none (the observer reads it on a page's load, and a restored tab's page is read again on its next navigation). Nothing is backfilled. Rolling back leaves an unused store.

## Open Questions

- Should a single-page-app route change or a late head rewrite send metadata again? The observer has no signal for it today; a `MutationObserver` on `<head>` is the likely route, with a debounce and a cap. Left for after use.
- Should the metadata title replace a good tab title in the map when the two differ a lot? Decision 5 says no for now.
- JSON-LD as the next change, once this shows whether metadata moves the clustering at all.
