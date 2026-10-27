# Spec Delta

## Purpose

Defines the optional passphrase lock: how a passphrase protects the data key, how the extension is locked and unlocked, how data already stored is carried across, and what the extension records and shows while it is locked.

## ADDED Requirements

### Requirement: A passphrase wraps the data key

WHEN the user sets a passphrase of at least 8 characters, entered twice identically, the extension SHALL make a new data key, store its bytes only sealed under a key derived from the passphrase (PBKDF2-SHA-256, at least 600,000 iterations, a random salt), and use the key for all later sealing. It SHALL NOT store the passphrase or the derived key. A wrong passphrase SHALL unlock nothing and SHALL say so. Changing the passphrase SHALL require the current one, and SHALL re-wrap the same key without touching stored content.

#### Scenario: Setting a passphrase

- **GIVEN** no passphrase is set
- **WHEN** the user enters `correct horse` twice
- **THEN** the lock is on and the extension is unlocked
- **AND** the stored record of the key holds no byte of the passphrase or of the unwrapped key

#### Scenario: Too short or mismatched

- **WHEN** the user enters a passphrase of fewer than 8 characters, or two entries that differ
- **THEN** nothing is set and the page says why

#### Scenario: A wrong passphrase

- **GIVEN** the extension is locked
- **WHEN** a wrong passphrase is entered
- **THEN** it stays locked and says the passphrase is wrong

#### Scenario: Changing the passphrase

- **GIVEN** a passphrase is set and content is stored
- **WHEN** the user changes it, giving the current one
- **THEN** the old passphrase no longer unlocks, the new one does, and the content is read as before

### Requirement: Existing data is carried across

WHEN a passphrase is set, the extension SHALL re-seal everything it had sealed under the old key — snapshots, facts, entities, summaries, saved table columns, open questions, page-metadata descriptions and the denylist — under the new one, and SHALL do the same in reverse when the passphrase is removed. A record SHALL always be wholly under one key. An interrupted pass SHALL resume and SHALL leave the old key in place until no record names it. While it runs, the extension SHALL show "Securing your data" and no stored content.

#### Scenario: Data recorded before the passphrase

- **GIVEN** snapshots, facts and a summary were recorded with no passphrase
- **WHEN** the user sets a passphrase and the pass ends
- **THEN** all of them read back as before and name the new key

#### Scenario: Interrupted pass

- **GIVEN** the pass was interrupted with some records on each key
- **WHEN** the background wakes
- **THEN** it continues, and ends with every record on the new key and the old key removed

#### Scenario: Removing the passphrase

- **GIVEN** a passphrase is set and content is stored
- **WHEN** the user removes it, giving the passphrase
- **THEN** the content reads back as before, under a non-extractable key, and the extension no longer locks

### Requirement: Locked means unlocked once per browser run

While a passphrase is set, the extension SHALL be locked at the start of every browser run and SHALL be unlocked only by the passphrase. After unlocking, the key SHALL be kept only in memory that the browser clears when it closes, so that the background being unloaded and woken does not lock it again. The user SHALL be able to lock the extension at once.

#### Scenario: Locked at start

- **GIVEN** a passphrase is set
- **WHEN** the browser starts
- **THEN** the extension is locked

#### Scenario: The background wakes

- **GIVEN** the extension is unlocked
- **WHEN** the background is unloaded and woken
- **THEN** it is still unlocked and opens content without asking

#### Scenario: Lock now

- **GIVEN** the extension is unlocked
- **WHEN** the user chooses Lock now
- **THEN** it is locked, and entering the passphrase unlocks it again

### Requirement: Nothing is recorded while locked

While locked, the extension SHALL store nothing about browsing: no signal, snapshot, page metadata, node or tab event. Queued background jobs SHALL wait and resume once unlocked. A page read while locked SHALL NOT be recorded afterwards.

#### Scenario: A page read while locked

- **GIVEN** the extension is locked and a session's tab group is open
- **WHEN** a page in the group loads and is read for a while
- **THEN** the database holds no node, signal or snapshot for it

#### Scenario: Jobs wait

- **GIVEN** fact extraction is queued and the extension is locked
- **WHEN** time passes
- **THEN** no job starts, and the queue still holds it after unlocking

### Requirement: Nothing is shown while locked

While locked, the extension's own pages — the popup, Options, Summaries, Recorded data and the Map — SHALL show a lock screen with a passphrase field and no recorded content, and the background SHALL answer every request except unlocking and erasing with a refusal. Unlocking or locking on one page SHALL update the others.

#### Scenario: The popup while locked

- **GIVEN** the extension is locked
- **WHEN** the popup opens
- **THEN** it shows the lock screen and no session title, page or count

#### Scenario: A request while locked

- **GIVEN** the extension is locked
- **WHEN** a page asks the background for recorded data
- **THEN** it is refused and no data is read

#### Scenario: Unlocking updates every page

- **GIVEN** two pages show the lock screen
- **WHEN** the passphrase is entered on one
- **THEN** both show their content

### Requirement: A forgotten passphrase cannot be recovered

The extension SHALL NOT offer a way to open sealed content without the passphrase. The lock screen SHALL offer to erase all recorded data after a confirmation, which SHALL remove the content and the wrapped key and leave the extension with no passphrase. Setting a passphrase SHALL say that a forgotten one loses the data.

#### Scenario: Erasing

- **GIVEN** the extension is locked
- **WHEN** the user confirms erasing everything
- **THEN** no recorded data remains, no passphrase is set and the extension records again

### Requirement: The limits of the lock are stated

The Options page SHALL say that the lock hides recorded data from the extension's screens and seals page text, facts, entities, summaries and settings, and that page addresses, titles and vectors are stored unencrypted.

#### Scenario: The Options text

- **WHEN** the Passphrase section is shown
- **THEN** it names what is sealed and what is not
