# Design

## Context

The map and the popup open a port, send `graph.subscribe`, and receive a `graph.snapshot` push
after every capture write (`pushGraphSnapshot`: coalesced, queued behind the writes that called
for it). "What was recorded" and "Synthesis" read once with `recorded.read`, `summaries.read`,
`questions.read`, `gaps.read` and `table.read`; recorded polls every 3 s only while it knows
facts are being extracted. The options page keeps a port but asks `ollama.status` once, and again
every few seconds only while Ollama is unreachable. Derived data is written by jobs
(embedding, facts, summaries, questions) that do not go through `captureAndPush`, so nothing
tells a page when they finish. See proposal.md.

## Goals / Non-Goals

**Goals:**

- Every page is correct without a reload; a change shows within 2 seconds.
- One mechanism, used the same way by every page.
- No extra reads when nothing changed; no polling.

**Non-Goals:**

- Sending the changed data in the push.
- Changing what any page shows or what a request returns.
- Pages in other browsers' sidebars; those use the same components later.

## Decisions

**A notification, not a payload.** The background sends `data.changed` with a list of topics
(`pages`, `snapshots`, `facts`, `clusters`, `summaries`, `questions`, `models`, `access`). A page
answers by calling the request it already has. The alternative, pushing each view as the map
pushes its snapshot, would need a second code path per page that must agree with the request's
and would send decrypted content to pages that did not ask for it.

**One subscription, many topics.** A page sends `data.subscribe` once with the topics it shows,
and is answered with nothing to read; it reads on connect itself. The graph push stays as it is:
the map already works, and folding it in would widen this change for no gain.

**Coalesced like the graph push.** Notifications are queued behind the capture queue, and a
burst of one topic ends in one message. The coalescing is the existing one, extended with a
topic set, so it is tested by the same means.

**Announce where data is written, not where it is asked for.** Each storing function's caller
in the background (snapshot stored, vectors written, facts and entities written, clusters
recomputed, summary or questions stored, job finished or failed, model activated, access
granted) calls one `notifyDataChanged(topic)`. A job's finish is the right place for derived data
because a job can write without any page being involved.

**Pages share one hook.** A React hook subscribes to the topics, re-reads when told and when the
port reconnects, and ignores an answer that arrives after a newer one was asked for. It takes the
client as a dependency, so it is tested without an extension, as the pages are.

**The recorded page's polling is removed** once it subscribes, so there is one way to stay current.

## Risks / Trade-offs

- A write path that forgets to notify leaves one page stale. Mitigation: a test per topic that
  writing through the background's dispatch notifies a subscriber, and a list of topics kept in one
  place.
- A notification storm during heavy extraction re-reads the same view often. Mitigation:
  coalescing, and pages re-read only the topics they show.
- Firefox may unload the background; subscriptions live on the port, which is dropped with it.
  Mitigation: pages reconnect and read afresh, as the spec requires.
