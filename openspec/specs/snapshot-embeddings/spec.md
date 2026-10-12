# snapshot-embeddings Specification

## Purpose

Defines how deep-read page text becomes vectors: model-independent chunking, embedding spaces that
say exactly what a vector means, a vector store partitioned by space, the background job that embeds
a snapshot, and the guard against comparing vectors from different spaces.

## Requirements

### Requirement: Snapshot text is chunked by sentence

A snapshot's text SHALL be split into chunks of whole sentences, each about 220 words, by a named, versioned chunker (`chunker@1`); each chunk after the first SHALL begin with the last sentence of the chunk before it. A sentence longer than a chunk SHALL be a chunk of its own. Chunks SHALL be stored as character ranges of their snapshot's text, not as text.

#### Scenario: A long article

- **GIVEN** a snapshot of 1,000 words in sentences of about 20 words
- **WHEN** it is chunked
- **THEN** it yields about five chunks of whole sentences, each about 220 words
- **AND** each chunk after the first starts with the last sentence of the previous one

#### Scenario: A short page

- **GIVEN** a snapshot of 80 words
- **WHEN** it is chunked
- **THEN** it yields one chunk covering the whole text

### Requirement: Every vector belongs to one embedding space

An embedding space SHALL be identified by the SHA-256 of the canonical JSON of the model's repository and commit, its dimensions, pooling, normalisation, similarity and prefixes, the chunker version and the extractor version. Every stored vector SHALL record its space, and the vectors of one space SHALL be readable without reading any other space's.

#### Scenario: Same model, new commit

- **GIVEN** a space for a model at one commit
- **WHEN** the same model at another commit is used
- **THEN** its space has a different id

#### Scenario: Same choices, same space

- **WHEN** the space is derived twice from the same model and versions
- **THEN** both derivations give the same id

### Requirement: Chunks are fitted to the model before embedding

WHEN a chunk's estimated token count, prefix included, exceeds the model's declared input limit, it SHALL be split at word boundaries into consecutive parts that each fit, and each part SHALL get its own vector. A chunk that fits SHALL be embedded whole, with the model's document prefix.

#### Scenario: A model with a short input limit

- **GIVEN** a model declaring 128 input tokens and a 220-word chunk
- **WHEN** the chunk is embedded
- **THEN** it is embedded as two or more parts, each within the limit, covering every word once

### Requirement: Deep-read snapshots are embedded in the background

WHILE an embedding model is active, each snapshot of the active session SHALL be embedded into that model's space by a background job, queued when the snapshot is stored, when the background starts and when an embedding model is activated. The same snapshot and space SHALL be embedded once. The extension SHALL run at most one embedding job at a time, SHALL resume an interrupted job from its last completed batch, and SHALL retry a failed job with backoff. WHEN no embedding model is active, no job SHALL be queued and capture SHALL be unaffected. The session SHALL take the space of its first vectors as its active embedding space.

#### Scenario: A page is deep read

- **GIVEN** an active, conformant embedding model
- **WHEN** a session page's snapshot is stored
- **THEN** vectors for every chunk of it are stored in that model's space
- **AND** the session's active embedding space is that space

#### Scenario: Asked twice

- **GIVEN** a snapshot already embedded in the active space
- **WHEN** the background starts again
- **THEN** no vector is computed again

#### Scenario: No model installed

- **GIVEN** no active embedding model
- **WHEN** a snapshot is stored
- **THEN** no embedding job is queued and the snapshot is stored as before

#### Scenario: Interrupted

- **GIVEN** an embedding job that stored the vectors of its first batch and was then interrupted
- **WHEN** the background starts again
- **THEN** the job resumes after that batch and finishes

### Requirement: Vectors from different spaces are never compared

Comparing two vectors SHALL require them to belong to the same space; comparing vectors of different spaces SHALL fail with an embedding-space mismatch error rather than return a similarity.

#### Scenario: Two models' vectors

- **WHEN** a vector from one space is compared with a vector from another
- **THEN** the comparison fails with an embedding-space mismatch error
