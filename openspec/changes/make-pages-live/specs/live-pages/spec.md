# live-pages Specification

## Purpose

Keeps what every extension page shows in step with what the extension has recorded and derived,
so that no page has to be reloaded to show current data.

## ADDED Requirements

### Requirement: Open pages follow changes to the data they show

WHILE an extension page is open, the page SHALL show data that agrees with what the extension has
stored, without the user reloading it or acting on it. When a page's data changes in the
background, the page SHALL reflect the change within 2 seconds. The pages are "What was
recorded", "Synthesis", the map, the popup and the options page.

#### Scenario: Facts arrive while Synthesis is open

- **GIVEN** the Synthesis page is open and shows "No entities with facts yet"
- **WHEN** the background finishes extracting facts from a page
- **THEN** the page shows that page's entity and facts without being reloaded
- **AND** "Suggest questions" becomes available

#### Scenario: A page is read while "What was recorded" is open

- **GIVEN** "What was recorded" is open and a page shows "Page text: none kept"
- **WHEN** the background stores that page's text and vectors
- **THEN** the entry shows the text's size and its vector count without being reloaded

#### Scenario: Access to Ollama is granted

- **GIVEN** the options page is open and offers "Set up Ollama"
- **WHEN** the user allows access in the browser's prompt
- **THEN** the card shows the next step without the page being reloaded

### Requirement: A change is announced, not copied

The background SHALL tell open pages that a kind of data changed, and SHALL NOT send the data
itself in the notification. A page SHALL read the data again with its own request, so that what a
page may read stays decided in one place. A burst of changes of one kind SHALL end in one
notification.

#### Scenario: Many pages are extracted in a row

- **WHEN** facts are stored for ten pages within one second
- **THEN** each open page is told once that facts changed, after the last write

### Requirement: A page that was away catches up

WHEN a page connects or reconnects, including after the background was unloaded and woke again,
it SHALL read its data afresh, so that a change announced while it was not listening is not lost.

#### Scenario: The background restarts

- **GIVEN** the Synthesis page is open and the background is unloaded
- **WHEN** the background wakes and the page reconnects
- **THEN** the page reads again and shows the current data

### Requirement: The hint about suggestions names the real reason

The "Suggested questions" section SHALL tell the user to turn on page summaries only when no
model is on. WHEN a model is on and the session has no facts yet, it SHALL say that suggestions
need facts from the pages read.

#### Scenario: A model is on, no facts yet

- **GIVEN** page summaries are on and no facts were extracted
- **THEN** the section does not mention the settings and says it needs facts from pages read
