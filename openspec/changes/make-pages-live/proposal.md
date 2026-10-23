# Proposal

## Why

Only the map and the popup follow the background. "What was recorded", "Synthesis" and the
options page read once when they open, so what they show goes stale the moment a snapshot, a
vector, a fact or a summary is written: Synthesis kept saying "0 facts" and "Turn on page
summaries in the settings" until it was reloaded, while the model was on and the page had 12
facts. A person doing research should never have to reload a page to see their own data.

## What Changes

- **One change notification.** The background tells every subscribed page what kind of data
  changed — pages, text, vectors, facts, clusters, summaries, questions, models, access — over the
  port the page already holds. It carries no data: the page reads again with the request it
  already has.
- **Every extension page subscribes.** "What was recorded", "Synthesis" and the options page
  re-read when told, instead of reading once. The map and popup keep the graph push they have.
  The recorded page's 3-second polling while facts are extracted is removed.
- **Writes announce themselves.** The places that store a snapshot, vectors, facts, entities,
  clusters, summaries or questions, finish or fail a job, change the active model, or see Ollama
  access granted, each notify. A burst of writes ends in one notification per kind.
- **The misleading hint is fixed.** Under "Suggested questions", "Turn on page summaries in the
  settings" is shown only when no model is on. With a model on and no facts yet it says that
  suggestions need facts from the pages read.

## Capabilities

### New Capabilities

- `live-pages`: what every extension page shows follows the extension's data without a reload.

### Modified Capabilities

None.

## Impact

- `src/app/backgroundApp` (notification, fan-out to subscribers), `src/shared/rpc` (the
  notification message), `src/app/recordedApp`, `src/app/summariesApp`, `src/app/optionsApp`
  (subscribe and re-read), `src/features/openQuestions/ui/suggestedQuestions` (the hint).
- Out of scope: pushing the data itself instead of a notification; live updates inside a content
  script; anything that makes a network request.
