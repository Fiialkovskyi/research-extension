## ADDED Requirements

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
