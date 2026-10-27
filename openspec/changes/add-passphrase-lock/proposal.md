# Proposal

## Why

Everything the extension keeps about a user's research is sealed with one data key that sits, unprotected, beside the data: a non-extractable `CryptoKey` in the extension's own database. That stops a copied profile file from being read by another extension, but anyone who sits down at the user's unlocked browser sees every page, fact and summary through the popup and the extension's pages. REQ-SEC-006 lets the user close that: a passphrase that wraps the data key, so that while the extension is locked it records nothing and shows nothing. It is the last open part of the "passphrase lock and denylist editor" roadmap line; the denylist editor is built.

## What Changes

- The Options page gains a **Passphrase** section: set a passphrase (at least 8 characters, entered twice), change it, remove it, and **Lock now**.
- Setting a passphrase makes a new data key whose bytes are wrapped by a key derived from the passphrase (PBKDF2-SHA-256, 600,000 iterations, random salt), and **re-seals everything already stored** under it. Nothing already recorded is lost. A progress state shows while the re-sealing runs.
- Once a passphrase is set the extension starts **locked** in every browser session and is unlocked by entering it; the unlocked key then lives in memory only (`storage.session`) until the browser closes, so the background being unloaded and woken does not ask again.
- While locked the extension **records nothing** (pages, signals, snapshots, metadata, tab events) and **shows nothing**: the popup, Options, Summaries, Recorded data and Map pages each show a lock screen with a passphrase field in place of their content, and queued jobs wait.
- Removing the passphrase re-seals everything under a fresh non-extractable key and returns to today's behaviour. A forgotten passphrase cannot be recovered; the lock screen offers erasing all recorded data to start over.
- The manifest declares the `storage` permission, which keeping the unlocked key in memory across background restarts needs.

## Capabilities

### New Capabilities

- `passphrase-lock`: setting, changing and removing a passphrase; locking and unlocking; re-sealing existing data; what the extension records and shows while locked.

### Modified Capabilities

- `data-protection`: the data key is no longer always a non-extractable key kept beside the data; with a passphrase its bytes are stored wrapped.
- `extension-shell`: the manifest also declares the `storage` permission.

## Impact

- `dataProtection` (a held-key slot, `DataLockedError`, `getDataKey` honouring the lock), a new `passphraseLock` feature (key wrapping and derivation, state, enable/change/remove, re-sealing, lock screen and Options section), `shared/storage` (one new kind of record in the key store, migration to the next DB version), `backgroundApp` (a lock gate in front of requests, the capture queue and the job runner; new `lock.*` messages and a `lock` data topic), every surface's root (lock screen), `wxt.config.ts` (permission), and e2e.
- Not covered: URLs, titles, timestamps and embedding vectors are stored in the clear today (REQ-SEC-005 seals page text, facts, entities, descriptions, summaries, the denylist and saved columns and questions). The passphrase hides them from the extension's own screens but does not encrypt them on disk. Stated in the spec so the lock is not read as more than it is.
- No network behaviour changes; the data never leaves the browser.
