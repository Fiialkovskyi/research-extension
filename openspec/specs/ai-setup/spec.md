# ai-setup Specification

## Purpose

Takes a user from a fresh install to working local AI with as few decisions as possible: tells them,
without interrupting, that AI is not set up yet, and walks them through it on one page that
advances by itself.

## Requirements

### Requirement: AI counts as set up once an embedding model is active

The extension SHALL treat AI as set up exactly while an embedding model is active, and as not set up
otherwise. Whether a text-generation model is active SHALL NOT change that, so summaries still
downloading never make AI look unset. This state SHALL be read from what the extension has stored,
without contacting the local inference server.

#### Scenario: Fresh install

- **GIVEN** no model has ever been activated
- **WHEN** any surface asks whether AI is set up
- **THEN** the answer is that it is not
- **AND** nothing has been sent to the local inference server

#### Scenario: Embedding active, summaries still downloading

- **GIVEN** the embedding model is active and the text-generation model is still being downloaded
- **WHEN** any surface asks whether AI is set up
- **THEN** the answer is that it is

### Requirement: The user is notified once after install

When the extension is first installed, it SHALL show one system notification saying that AI needs
setting up and that it takes a few minutes. Clicking it SHALL open the setup page. It SHALL NOT be
shown on an update, on a browser restart, or again after it was dismissed.

#### Scenario: First install

- **WHEN** the extension is installed for the first time
- **THEN** one system notification asks the user to set up AI
- **AND** clicking it opens the setup page in a new tab

#### Scenario: Update

- **GIVEN** the extension was installed before
- **WHEN** it is updated to a new version
- **THEN** no setup notification is shown

### Requirement: The toolbar icon shows when AI needs attention

WHILE AI is not set up, the toolbar icon SHALL carry a badge. WHILE AI is set up but the local
inference server last failed to answer, it SHALL carry a different badge. Otherwise it SHALL carry
none. The badge SHALL change within a few seconds of the state changing, without the popup being
opened.

#### Scenario: Not set up

- **GIVEN** AI is not set up
- **WHEN** the browser starts with the extension installed
- **THEN** the toolbar icon carries the "needs setup" badge

#### Scenario: Setup finishes

- **GIVEN** the toolbar icon carries the "needs setup" badge
- **WHEN** the embedding model becomes active
- **THEN** the badge is removed within a few seconds

#### Scenario: Ollama stops answering

- **GIVEN** AI is set up
- **WHEN** a request to the local inference server fails because the server does not answer
- **THEN** the toolbar icon carries the "paused" badge
- **AND** the badge is removed once the server answers again

### Requirement: The popup leads to setup while AI is not set up

WHILE AI is not set up, the popup SHALL show, above everything else, a banner saying in one
sentence what does not work yet, with one action that opens the setup page. The banner SHALL be
collapsible to a single line, SHALL remember that choice, and SHALL NOT be dismissable while AI is
not set up. It SHALL disappear once AI is set up. Starting and recording a session SHALL NOT depend
on it.

#### Scenario: Banner leads to setup

- **GIVEN** AI is not set up
- **WHEN** the user opens the popup and clicks the banner's action
- **THEN** the setup page opens in a new tab

#### Scenario: Collapsed banner stays collapsed

- **GIVEN** the user collapsed the banner
- **WHEN** the popup is opened again
- **THEN** the banner is shown as one line that can be expanded

#### Scenario: A session starts without AI

- **GIVEN** AI is not set up
- **WHEN** the user starts a session and opens pages in it
- **THEN** the session starts and the pages are recorded
- **AND** their embedding waits until AI is set up

### Requirement: The setup page shows one step at a time and advances by itself

The extension SHALL provide a setup page that shows only the current step, in plain language, and
moves to the next step on its own when it observes that the current one is done, checking again
every few seconds WHILE it is open. The steps SHALL be, in order: get Ollama (with a link to its
download page), open Ollama, allow this extension (shown only when Ollama refuses it), turn on AI,
and done. A step that is already done SHALL be skipped. Commands a user would type SHALL never be
the only way shown.

#### Scenario: Ollama not installed

- **GIVEN** nothing answers on the local inference server's address
- **WHEN** the setup page opens
- **THEN** it shows the "get Ollama" step with a link to Ollama's download page
- **AND** it says that if Ollama is already installed, opening it is enough

#### Scenario: Ollama opened while the page is open

- **GIVEN** the setup page shows the "get Ollama" step
- **WHEN** the user starts Ollama
- **THEN** within a few seconds, without a reload, the page shows the "turn on AI" step

#### Scenario: Already set up

- **GIVEN** AI is set up
- **WHEN** the setup page opens
- **THEN** it shows the "done" step with which models are active

### Requirement: Turning on AI is one action that installs both models

The "turn on AI" step SHALL say how much it will download before the user acts. One click SHALL
then, for the recommended embedding model and then the recommended text-generation model: download
it through the local inference server if the server lacks it, register it, run its conformance
suite and activate it. The page SHALL show one combined progress, SHALL say when similar pages
already work while summaries are still being prepared, and on failure SHALL name the model and
stage that failed and offer to try again.

#### Scenario: Neither model present

- **GIVEN** Ollama is running and has neither recommended model
- **WHEN** the user clicks "Turn on AI"
- **THEN** both models are downloaded, registered, checked and activated, embedding first
- **AND** one progress covers both downloads

#### Scenario: A model is already present

- **GIVEN** Ollama already has the recommended text-generation model
- **WHEN** the user clicks "Turn on AI"
- **THEN** that model is registered and checked without being downloaded again
- **AND** the size announced before the click counts only what will be downloaded

#### Scenario: Embedding ready first

- **GIVEN** the embedding model has been activated and the text-generation model is still downloading
- **WHEN** the user looks at the setup page
- **THEN** it says that similar pages already work and summaries are still being prepared

#### Scenario: A stage fails

- **WHEN** registering, checking or activating either model fails
- **THEN** the page names the model and the stage that failed, with the reason
- **AND** offers to try again, keeping any model that was already activated

#### Scenario: The setup page is closed mid-download

- **GIVEN** "Turn on AI" is in progress
- **WHEN** the user closes the setup page
- **THEN** the downloads and activation continue in the background
- **AND** reopening the page shows their progress

### Requirement: Ollama admits the extension without the user configuring it, where possible

The extension SHALL reach the local inference server without the user changing Ollama's settings,
if the browser lets it do so for its own requests alone. Whatever admits the extension SHALL apply
only to requests the extension itself makes: web pages and other extensions SHALL be refused by
Ollama exactly as before the extension was installed. Where the browser does not allow that, the
setup page SHALL show the "allow this extension" step with one ready-to-copy command that admits only
this extension's origin.

#### Scenario: Ollama answers the extension

- **GIVEN** Ollama runs with its default settings
- **WHEN** the extension sends it a request after setup started
- **THEN** Ollama answers, and the setup page does not show the "allow this extension" step

#### Scenario: A web page is still refused

- **GIVEN** the extension is installed and AI is set up
- **WHEN** an ordinary web page sends a request to `http://127.0.0.1:11434`
- **THEN** Ollama refuses it as it would without the extension

### Requirement: The recommended text-generation model is the one measured best

The recommended text-generation model SHALL be `gemma4:12b`, and the size announced before "Turn on AI" SHALL be computed from the recommended models' approximate sizes. `qwen3:4b` SHALL remain a known model that is not recommended: it SHALL be used where the local inference server already has it and the user enables it, and SHALL NOT be offered for download. A model with the same name and another tag SHALL NOT satisfy a recommendation that names a tag.

#### Scenario: Neither model present

- **GIVEN** Ollama has neither recommended model
- **WHEN** the "turn on AI" step is shown
- **THEN** it announces a download of about 8.0 GB, the embedding model and `gemma4:12b`

#### Scenario: The lighter model is already pulled

- **GIVEN** Ollama has `qwen3:4b` and not `gemma4:12b`
- **WHEN** the user lists the server's models
- **THEN** `qwen3:4b` is listed as pulled and not recommended
- **AND** `gemma4:12b` is offered for download

#### Scenario: Another tag of the recommended model

- **GIVEN** Ollama has `gemma4:4b`
- **WHEN** the models are listed
- **THEN** `gemma4:12b` is still offered for download
