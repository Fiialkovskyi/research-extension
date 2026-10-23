# Tasks

## 1. The notification

- [x] 1.1 Add the `data.subscribe` request and the `data.changed` message, with their topic list, to `shared/rpc`'s message set and schemas
- [x] 1.2 In the background, keep a set of data subscribers beside the graph's, and send each a coalesced `data.changed` queued behind the capture writes
- [x] 1.3 Add a single `notifyDataChanged(topic)` and call it where snapshots, vectors, facts and entities, clusters, summaries, questions, job outcomes, active model and Ollama access are written or change
- [x] 1.4 Unit-test coalescing, one notification per burst, a dropped port being removed, and one test per topic that a write notifies a subscriber

## 2. Pages follow

- [x] 2.1 Add a hook that subscribes to topics, re-reads when told and on reconnect, and drops a stale answer; unit-test it with a stub client
- [x] 2.2 "What was recorded" re-reads on `pages`, `snapshots`, `facts` and `models`; remove its 3-second polling
- [x] 2.3 "Synthesis" re-reads summaries, gaps, table and questions on `facts`, `clusters`, `summaries`, `questions` and `models`
- [x] 2.4 The options page re-reads Ollama status on `access` and `models`; keep the retry while Ollama is unreachable
- [x] 2.5 Confirm the map and popup need nothing further; fix any piece of their state that is read once

## 3. The hint under Suggested questions

- [x] 3.1 Show "Turn on page summaries in the settings" only when no model is on; with a model on and no facts say that suggestions need facts from the pages read
- [x] 3.2 Update the component's spec for both cases

## 4. Verify

- [ ] 4.1 Add an e2e check: with Synthesis open, a page read to completion makes its entity appear without a reload
- [x] 4.2 Run `npm run verify`
