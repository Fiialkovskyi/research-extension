# Spec Delta

## ADDED Requirements

### Requirement: The background answers every message

The background SHALL answer every message a surface sends with exactly one final response. A message it cannot trust SHALL be answered with a refusal that names which check it failed. A trusted request whose handling fails in a way its own feature does not answer for SHALL be answered with a failure that names the request. Neither answer SHALL be presented as the failure of any particular feature.

#### Scenario: A message that is not an envelope

- **WHEN** a surface sends a value that is not an RPC envelope
- **THEN** the background answers `rpc.refused` with the rejection `not-an-envelope`

#### Scenario: A message type no feature owns

- **WHEN** a surface sends an envelope whose type no feature declares
- **THEN** the background answers `rpc.refused` with the rejection `unknown-type`
- **AND** the reason names the type

#### Scenario: A payload its schema refuses

- **WHEN** a surface sends a known type with a payload its schema does not admit
- **THEN** the background answers `rpc.refused` with the rejection `invalid-payload`

#### Scenario: An unexpected failure while handling a trusted request

- **WHEN** handling a trusted request fails and its feature does not answer for that failure
- **THEN** the background answers `rpc.failed` naming the request type and the reason

#### Scenario: A surface shows a refusal

- **WHEN** the options surface receives `rpc.refused` or `rpc.failed`
- **THEN** it shows the reason as the surface's problem and stops reporting itself as busy
