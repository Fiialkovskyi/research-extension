# model-runtime Delta

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
- **AND** the popup's activity strip says local AI is not answering, while pages are still recorded

#### Scenario: Server back

- **GIVEN** embedding jobs that stopped because the local inference server did not answer, including ones out of retries
- **WHEN** the server answers again, the next time a page is captured, AI is turned on, the popup shows the pause, or the setup or options page looks at it
- **THEN** those jobs are queued again with their retries restored, and the pages are embedded
- **AND** the popup's activity strip no longer shows local AI paused
