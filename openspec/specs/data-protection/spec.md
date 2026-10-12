# data-protection Specification

## Purpose

Defines the extension's data key: one non-extractable key, created on first need and kept in the
extension's own storage, with which stored content is encrypted at rest and decrypted for use.

## Requirements

### Requirement: One non-extractable data key encrypts stored content

The extension SHALL create its data key on first need: an AES-GCM key of 256 bits, which cannot be exported. It SHALL keep the key in its own database and use the same key afterwards, across background restarts and browser restarts. It SHALL never write the key's bytes anywhere, and SHALL NOT send the key or anything encrypted with it outside the extension.

#### Scenario: The key outlives the background

- **GIVEN** content was encrypted with the data key
- **WHEN** the background is unloaded and woken again
- **THEN** that content decrypts with the key the background finds

#### Scenario: The key cannot be read out

- **WHEN** the data key is read from the database
- **THEN** it reports itself as not extractable, and exporting it fails

#### Scenario: Two first needs at once

- **WHEN** two pieces of work ask for the data key before one exists
- **THEN** one key is kept, and both pieces of work use it

### Requirement: Each encryption uses a fresh IV

Every piece of content SHALL be encrypted under its own random 96-bit IV, stored beside the ciphertext. Content that fails authentication on decryption SHALL be reported as unreadable, never returned altered.

#### Scenario: The same text twice

- **WHEN** the same bytes are encrypted twice
- **THEN** the two IVs differ and so do the two ciphertexts

#### Scenario: Tampered ciphertext

- **GIVEN** a stored ciphertext with one byte changed
- **WHEN** it is decrypted
- **THEN** decryption fails rather than returning content
