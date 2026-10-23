# Spec Delta

## ADDED Requirements

### Requirement: The local inference server is the only offered backend

WHILE the in-extension backend is switched off in configuration, the extension SHALL offer only
models served by the local inference server: no surface SHALL list, install, activate or measure an
in-extension model, and nothing SHALL be fetched from a model host. The in-extension backend's code
SHALL remain in the package's source, so switching the setting back restores it unchanged. The
setting SHALL be off.

#### Scenario: Nothing from the model hosts is offered

- **WHEN** the options and setup pages are opened
- **THEN** neither offers an in-extension model to install or activate

#### Scenario: No model host is contacted

- **WHEN** a session is recorded and AI is set up
- **THEN** the extension sends no request to a model-host origin

### Requirement: The local inference server is contacted only once the user started setup

The extension SHALL send nothing to the local inference server until the user has started setup by
opening the setup page or clicking an action that leads to it, and SHALL record that choice. Having
the browser permission for the server's address SHALL NOT by itself count as that choice.

#### Scenario: Installed and never set up

- **GIVEN** the user installed the extension and never opened the setup page
- **WHEN** the user records a session, opens the popup and opens the options page
- **THEN** no request is sent to `http://127.0.0.1:11434`

#### Scenario: Setup started

- **WHEN** the user opens the setup page
- **THEN** the extension starts checking whether the local inference server answers

## MODIFIED Requirements

### Requirement: A local inference server can serve a registered model

The setup page SHALL let the user use a local inference server, once the user has started setup, and the extension SHALL list the models the server has. The extension SHALL register the recommended models, and have the server download one it lacks, from the user's click only; the extension itself SHALL connect only to the server. A registered model SHALL be inactive until it passes its family's conformance suite run through the server, and SHALL then be usable exactly like a downloaded model. WHEN the server is unreachable, using its model SHALL fail with a reason naming the server, and nothing else SHALL be affected.

#### Scenario: Registering an embedding model

- **GIVEN** the local inference server has `nomic-embed-text` pulled
- **WHEN** the user turns on AI
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
- **AND** the popup says local AI is paused because Ollama is not running, while pages are still recorded

#### Scenario: Server back

- **GIVEN** embedding jobs that stopped because the local inference server did not answer, including ones out of retries
- **WHEN** the server answers again, the next time a page is captured or the setup or options page looks at it
- **THEN** those jobs are queued again with their retries restored, and the pages are embedded
- **AND** the popup no longer says local AI is paused

## REMOVED Requirements

### Requirement: The options surface guides the user through setting up the local inference server

**Reason**: Setup is no longer optional, hidden in a closed options section, or split into two
actions. It moves to a dedicated setup page that advances by itself and turns on both models at
once.
**Migration**: See the `ai-setup` capability — "The setup page shows one step at a time and
advances by itself", "Turning on AI is one action that installs both models" and "Ollama admits the
extension without the user configuring it, where possible". Measuring extraction time moves, with
the other measurements, under the options page's "Advanced" section.
