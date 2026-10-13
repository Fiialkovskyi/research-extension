## ADDED Requirements

### Requirement: Generation is bounded and interruptible

A text-generation run SHALL stop at the token limit the caller requested, and SHALL stop promptly when the caller cancels it, releasing the runtime for other work. A run SHALL report why it stopped: the model finished, the limit was reached, or it was cancelled.

#### Scenario: Generation stops at the requested limit

- **WHEN** a generation is requested with a token limit and the model does not stop earlier on its own
- **THEN** generation stops at that limit
- **AND** it reports that it stopped at the limit

#### Scenario: Generation stops when cancelled

- **WHEN** the caller cancels an in-flight generation
- **THEN** generation stops without producing a final result: what it reports is marked cancelled, never complete
- **AND** the runtime becomes available for the next request

### Requirement: Structured output is validated before it is used

A model SHALL declare whether it can constrain its output to a schema, and WHEN it can, the system SHALL ask it to. Whether or not it can, the system SHALL validate generated output against the expected schema and SHALL discard output that fails validation rather than passing it on, since a runtime's constraint is not a guarantee the extension controls.

#### Scenario: Output fails the schema

- **WHEN** a model returns text that does not satisfy the expected schema, whether or not it was asked to constrain its output
- **THEN** that output is discarded and not surfaced as a result
- **AND** the failure says the output did not match the schema

#### Scenario: Valid structured output is accepted

- **WHEN** generated output satisfies the expected schema
- **THEN** it is accepted as a result

### Requirement: A text-generation model passes its conformance suite before use

The conformance suite for the text-generation family SHALL check, through the model as it will be used, that it extracts the expected values from bundled passages into a schema, that a run stops at its token limit, and that a run stops when cancelled. A model SHALL pass when nearly all extraction probes return schema-valid output with the expected values, and both stopping probes pass; otherwise activation SHALL be refused with a reason naming the failed probe. Each probe's result SHALL be shown, as for embedding models.

#### Scenario: A model that extracts correctly passes

- **WHEN** a text-generation model answers the extraction probes in the schema with the expected values, and stops at its limit and when cancelled
- **THEN** it passes and can be activated

#### Scenario: A model that ignores its token limit fails

- **WHEN** a run of a text-generation model does not stop at the token limit it was given
- **THEN** activation is refused with a reason naming the token-limit probe

## MODIFIED Requirements

### Requirement: A local inference server can serve a registered model

The options surface SHALL let the user connect to a local inference server, after granting its permission from that click, and list the models the server has. The user SHALL be able to register one of them, and to have the server download a recommended model it lacks, from the user's click only; the extension itself SHALL connect only to the server. A registered model SHALL be inactive until it passes its family's conformance suite run through the server, and SHALL then be usable exactly like a downloaded model. WHEN the server is unreachable, using its model SHALL fail with a reason naming the server, and nothing else SHALL be affected.

#### Scenario: Registering an embedding model

- **GIVEN** the local inference server has `nomic-embed-text` pulled
- **WHEN** the user connects and registers it
- **THEN** it is recorded inactive, with its dimensions and context length from the server
- **AND** activating it runs the embedding conformance suite through the server

#### Scenario: Registering a text-generation model

- **GIVEN** the local inference server has `qwen3:4b` pulled, and says it serves completions
- **WHEN** it is registered
- **THEN** it is recorded inactive as a text-generation model, with its context window from the server
- **AND** activating it runs the text-generation conformance suite through the server

#### Scenario: Server not running

- **GIVEN** an active embedding model served by the local inference server
- **WHEN** the server is stopped and a snapshot is to be embedded
- **THEN** the embedding job fails with a reason naming the server, and is retried later
- **AND** the popup says local AI is paused because the server is not running, while pages are still recorded

#### Scenario: Server back

- **GIVEN** embedding jobs that stopped because the local inference server did not answer, including ones out of retries
- **WHEN** the server answers again, the next time a page is captured or the options surface looks at it
- **THEN** those jobs are queued again with their retries restored, and the pages are embedded
- **AND** the popup no longer says local AI is paused

### Requirement: The options surface guides the user through setting up the local inference server

The local inference server SHALL be optional and presented as such: the options surface SHALL keep it in a section the user opens, closed by default unless the server is already connected, and the extension SHALL remain fully usable with an in-extension model or none.

Once the user chooses to set it up, the surface SHALL show the setup as a short checklist in plain language whose steps tick themselves as the extension observes them: install Ollama (with a link to its download page), open it, allow this extension (shown only when the server refuses it), and turn on local AI. Turning on SHALL be one action that, from the user's click, downloads the recommended model through the server if it lacks it, registers it, runs conformance and activates it, showing one progress. WHILE a step is not done, the surface SHALL check again every few seconds without the user reloading. Commands a user would type SHALL be secondary to these steps, never the only way shown.

Once local AI is on, the surface SHALL offer page summaries as a further optional step, saying what it downloads and how large it is. Turning them on SHALL likewise be one action that downloads the recommended text-generation model through the server if it lacks it, registers it, runs its conformance suite and activates it, showing one progress and, on failure, which stage failed and why. With summaries on, the surface SHALL let the user measure how long extracting a comparison table from a page of about 1,500 words takes, against the budget for it, and how much of that table is right; WHILE it runs, the surface SHALL show that it is still working.

The setting that admits the extension SHALL name only this extension's own origin, never a wildcard admitting every extension, and SHALL persist across a restart of the computer where the platform allows.

#### Scenario: Optional and closed by default

- **GIVEN** the user never set up the local inference server
- **WHEN** the options surface opens
- **THEN** the local AI section is closed and labelled optional
- **AND** nothing is sent to the server

#### Scenario: Steps tick themselves

- **GIVEN** the user chose to set up the local inference server and granted access
- **WHEN** the user installs and opens Ollama while the surface is open
- **THEN** the install and open steps are marked done within a few seconds, without a reload

#### Scenario: Ollama refuses the extension

- **WHEN** the server answers the extension with a refusal
- **THEN** the checklist shows the "allow this extension" step with one command, ready to copy, that admits only this extension's origin and survives a restart
- **AND** it says in plain language where to paste it and to reopen Ollama afterwards

#### Scenario: Turning on in one action

- **GIVEN** the server is running and admits the extension, and lacks the recommended model
- **WHEN** the user turns on local AI
- **THEN** the model is downloaded through the server, registered, checked and activated, with one progress shown
- **AND** a failure at any stage says which stage failed and why

#### Scenario: Turning on page summaries

- **GIVEN** local AI is on, and the server lacks the recommended text-generation model
- **WHEN** the user turns on page summaries
- **THEN** the model is downloaded through the server, registered, checked and activated, with one progress shown
- **AND** the embedding model stays active beside it

#### Scenario: Measuring extraction time

- **GIVEN** page summaries are on
- **WHEN** the user measures them
- **THEN** the surface shows how many seconds extraction from a page of about 1,500 words took, whether that is within the budget, and how many of the page's values it got right
- **AND** while it runs, the surface shows how long it has been running
