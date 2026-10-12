# page-snapshots Specification

## Purpose
Defines how the readable text of a page the user read closely is captured once, bounded, identified
by a content hash and stored locally against its node, for later use by indexing and synthesis.

## Requirements

### Requirement: A deep-read page's text is captured once

WHEN a session node first becomes `deep_read` while its page is still open and observed, the extension SHALL extract the page's readable text, the main content without navigation, scripts or styles, and store it as that node's snapshot. A node SHALL have at most one snapshot; it SHALL NOT be captured again when it stays or becomes `deep_read` again.

#### Scenario: Copying from an article

- **GIVEN** a session page showing an article, observed and not yet deep read
- **WHEN** the user copies text from it
- **THEN** a snapshot holding the article's text is stored for its node
- **AND** the node carries the snapshot's content hash

#### Scenario: A second copy

- **GIVEN** a node that already has a snapshot
- **WHEN** the user copies from its page again
- **THEN** the node still has exactly one snapshot

#### Scenario: Read long enough

- **GIVEN** a session page, observed, scrolled through half of it
- **WHEN** the user's active dwell on it reaches 45 s and the user then selects another tab
- **THEN** a snapshot of its text is stored for its node

#### Scenario: A page that is not deep read

- **WHEN** the user glances at a session page for 10 s without copying from it
- **THEN** no snapshot is stored for its node

### Requirement: Snapshot text is bounded and identified

A snapshot's text SHALL be at most 200 KB of UTF-8; longer text SHALL be cut at that size and the snapshot SHALL record that it was truncated. Each snapshot SHALL record the SHA-256 hash of its stored text, its length, the extractor's version and when it was captured. The text SHALL be stored compressed.

#### Scenario: A very long page

- **GIVEN** a session page whose readable text is 300 KB
- **WHEN** it becomes deep read
- **THEN** its snapshot holds the first 200 KB of the text and is marked truncated

#### Scenario: Same text, same hash

- **GIVEN** two session pages whose readable text is identical
- **WHEN** both become deep read
- **THEN** their snapshots record the same content hash

### Requirement: A page with no readable text gets no snapshot

WHEN a deep-read page yields no readable text, no snapshot SHALL be stored, and the node SHALL NOT be retried for the rest of its page's life.

#### Scenario: An empty page

- **GIVEN** a session page with no readable content
- **WHEN** the user copies from it
- **THEN** no snapshot is stored for its node

### Requirement: Page text leaves the page only for its snapshot

The text SHALL be extracted inside the page and sent only to the extension's background, only for a node becoming deep read, and SHALL NOT be sent anywhere else. Extraction SHALL NOT change the page the user sees.

#### Scenario: Extraction makes no request

- **WHEN** a session page is snapshotted
- **THEN** the extension issues no outbound network request
- **AND** the page's own document is unchanged
