# Spec Delta

## MODIFIED Requirements

### Requirement: One non-extractable data key encrypts stored content

The extension SHALL create its data key on first need: an AES-GCM key of 256 bits, which cannot be exported. It SHALL keep the key in its own database and use the same key afterwards, across background restarts and browser restarts. Unless the user has set a passphrase (see the `passphrase-lock` capability), it SHALL never write the key's bytes anywhere, and SHALL NOT send the key or anything encrypted with it outside the extension. When a passphrase is set, the key's bytes SHALL be stored only sealed under the passphrase, and the key in use SHALL still be non-extractable.

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

#### Scenario: A locked extension has no key to give

- **GIVEN** a passphrase is set and the extension is locked
- **WHEN** work asks for the data key
- **THEN** it is told the data is locked, and no key is made
