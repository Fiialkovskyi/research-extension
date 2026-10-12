# Spec Delta

## ADDED Requirements

### Requirement: Snapshot text is encrypted at rest

A snapshot's text SHALL be stored only encrypted with the extension's data key, after compression. The snapshot SHALL record which key and cipher encrypted it. Its content hash, length, truncation flag, extractor version and capture time MAY stay unencrypted. The extension SHALL be able to read a snapshot's text back through its own key. A snapshot stored unencrypted by an earlier version SHALL be encrypted the next time the background starts or is updated.

#### Scenario: Stored text is not readable as stored

- **GIVEN** a deep-read page whose text contains `mid-drive motor`
- **WHEN** its snapshot is stored
- **THEN** neither the stored record nor its decompressed bytes contain `mid-drive motor`
- **AND** reading the snapshot through the extension returns the text

#### Scenario: A snapshot from before encryption

- **GIVEN** a snapshot stored compressed but unencrypted by an earlier version
- **WHEN** the background starts
- **THEN** the snapshot is stored encrypted, its hash unchanged
- **AND** reading it returns the same text as before
