# Proposal

## Why

A page reaches the research graph with only its tab title and URL until the user reads it deeply and its text is extracted. Until then it has no vector, so clustering, summaries and the map cannot place it, and a page that was visited for a minute stays a mute dot. Every page also publishes a few lines about itself in its `<head>`: a description, a cleaner title, the site's name, a type, an author, a date, a canonical address. They cost nothing to read and exist before any deep read, so they give the analysis a first, weak signal for every page and a better label for many.

## What Changes

- The page observer reads, once per page after it loads, `title`, `meta[name=description]`, the `og:title`, `og:description`, `og:type` and `og:site_name` tags, `link[rel=canonical]`, `article:published_time` and a `meta[name=author]` / `article:author`, each cut to a length limit. `og:image` and every other tag are not read.
- The observer sends them to the background in one message; the background stores them on a new `pageMetadata` record for the node, at once, without waiting for deep read. The description is encrypted at rest like a snapshot's text; the rest are stored in the clear like the node's title and URL.
- When the tab's title is blank or is only the page's address, the node takes the page's `og:title` as its title. A later tab-title update still wins, as it does today.
- A node that has no snapshot yet gets one vector from its title and description, in the active embedding space, as a weak fallback. Once the node has text vectors, clustering ignores the metadata vector.
- Deleting a page or a session deletes its metadata and its metadata vector with everything else.

## Capabilities

### New Capabilities

- `page-metadata`: what a page says about itself in its head, how it is read and stored, how it labels a node, and how it stands in for text until a page is read deeply.

### Modified Capabilities

None. The existing capabilities' requirements are not changed; the metadata vector is read only where no text vector exists.

## Impact

- `pageSignals` (observer reads and sends the metadata; request and response schemas), a new `pageMetadata` feature (reader for the page, recorder for the background), `shared/storage` (a `pageMetadata` store, database version 25, forward-only upgrade), `snapshotEmbeddings` (a metadata embedding job beside the snapshot one), `researchClusters` (`readPageVectors` prefers text vectors), `recordedData` (deletes metadata with a page and a session), and the background's job runner and message handling.
- No new permission: the observer is already injected into session tabs only, under the same denylist.
- Data: metadata about a page is as sensitive as the page's text, so the description is sealed with the data key; the node's title and URL already sit in the clear, and the other fields are of the same kind.
- e2e: one spec that a session page's metadata is stored and a page outside the group stores none.
