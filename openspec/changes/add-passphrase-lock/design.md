# Design

## Context

`getDataKey(database)` returns the one non-extractable AES-GCM key (`data-key-1`) kept in `KEY_STORE`; about twenty modules call it to seal or open content, and `decryptBytes` refuses content whose `keyId` is not the key's id. Sealed content: snapshots (`StoredSnapshot`), facts, entities' descriptions, summaries' statements, saved table columns, open questions, page-metadata descriptions and the user's denylist. Nodes' URLs and titles, signals and vectors are plain. The background (`backgroundApp`) is the only writer; it answers every surface through `handleRequest` and every page's observer through `handleContentMessage`, records tab events through listeners, and runs jobs. Firefox unloads the MV3 event page freely. Observed in `getDataKey`, `decryptBytes`, `StoredDataKey`, `backgroundApp`.

## Goals / Non-Goals

**Goals:**

- With a passphrase set, the sealed content cannot be opened without it, even by a script in the extension's own pages that has not been given the key.
- Locked means silent and blind: nothing is recorded and no surface shows data.
- Existing data survives setting, changing and removing the passphrase.
- One unlock per browser run.

**Non-Goals:**

- Encrypting URLs, titles, signals or vectors at rest. A separate, larger change; stated as a limit.
- An auto-lock timer, and unlocking by anything but the passphrase.
- Resisting an attacker who can run code as the extension or read the browser's memory (the threat model already excludes it).
- Protecting against guessing offline: the iteration count is the defence; there is no attempt counter, which an attacker holding the files would bypass anyway.
- Export/import of sessions (deferred to the end of the roadmap).

## Decisions

### 1. A wrapped key, not a derived one, and a key that stays non-extractable in use

A passphrase cannot "wrap" the existing non-extractable key: its bytes cannot be read. So enabling the lock creates a new key `data-key-2`: 32 random bytes, which are (a) imported as a non-extractable AES-GCM key for use, and (b) sealed with AES-GCM under a key-encryption key derived from the passphrase (PBKDF2-SHA-256, 600,000 iterations, 16 random salt bytes), and stored as one `passphrase-wrap` record: `{ id, salt, iterations, iv, wrappedKey, keyId }`. Changing the passphrase re-wraps the same 32 bytes under a new salt and key; no content is touched. Unlocking derives the key, unwraps the bytes and checks them by the AEAD tag; a wrong passphrase fails authentication and nothing else is learned.

### 2. The unlocked key lives in `storage.session`, as bytes

An event page is unloaded within seconds, so a key held only in a variable would ask again constantly. `browser.storage.session` is held in memory, is cleared when the browser closes, is never written to disk and by default is readable only by the extension's trusted contexts (not content scripts). On unlock the background writes the 32 bytes there; on each wake it reads them back and holds the imported key in the `dataProtection` slot. This needs the `storage` permission (declared; no network behaviour). Locking clears the entry and the slot. The unlocked bytes are exposed to code that runs as the extension, which the threat model already excludes.

### 3. `getDataKey` stays the only way to a key, and honours the lock

`dataProtection` gains a held-key slot (`holdDataKey`, `releaseDataKey`) and `DataLockedError`. When a `passphrase-wrap` record exists, `getDataKey` returns the held key or throws `DataLockedError`; with no wrap record it behaves as today. The twenty callers do not change. The slot is filled by the background's gate on wake, before any work runs, so a caller never sees a half-restored state. `getDataKey` still never generates a key while a wrap record exists.

### 4. The background gates at three choke points

- **Requests** (`handleRequest`): while locked, only `lock.status`, `lock.unlock` and `lock.erase` are answered; every other request gets `lock.locked`. No handler runs, so no data is read.
- **Observers** (`handleContentMessage`) and **tab listeners** (the capture queue): while locked the work is skipped, observers are answered `signal.dropped` with `stop: false`, and nothing is stored. Pages read while locked are therefore not recorded, and are not backfilled on unlock.
- **Jobs** (the job runner and its alarm): while locked, no job starts; queued jobs stay queued and resume on unlock.

Every listener is still registered synchronously before any `await`; the gate is inside them.

### 5. Locking is a state with three values

`getLockState(database)` is `off` (no wrap record), `locked` (a wrap record and no held key) or `unlocked`; while re-sealing runs the wrap record carries `phase: "sealing"` and the state is `securing`, which the gate treats like locked and the surfaces show as "Securing your data…". It is derived, not stored, apart from the record's `phase`.

### 6. Re-sealing is one exclusive, resumable pass

Enabling re-seals every sealed record from `data-key-1` to `data-key-2`; removing does the reverse to a new non-extractable `data-key-3`. A table in `passphraseLock` names each store and its sealed fields (snapshots, facts, entities, summaries, table columns, questions, page metadata, blocked sites). The pass runs on the capture queue with the gate closed, in batches of a few dozen records per transaction; each record is decrypted with the old key and re-encrypted with the new one and its `keyId` updated in the same transaction, so a record is always wholly one key. A record whose `keyId` is already the new one is skipped, which makes the pass resumable: if the event page is unloaded mid-way, the next wake sees `phase: "sealing"` and continues. Only when no record names the old key is the old key record deleted and the phase cleared. A decrypt that fails stops the pass with an error and leaves both keys in place, so nothing is lost.

### 7. A new session starts locked, and the first set is the only time it is unlocked for free

Setting a passphrase leaves the extension unlocked (the user just typed it). After that, every browser start is locked until the passphrase is entered.

### 8. The lock screen is one shared component

A `LockScreen` (passphrase field, Unlock button, a "wrong passphrase" message, and a quiet "Forgot it? Erase everything" with a confirmation) is rendered by each surface root in place of its content when `lock.status` is not `off`/`unlocked`. Surfaces read `lock.status` on mount and follow a `lock` data topic push, so unlocking or locking from one page updates the others. Erase deletes all recorded data (the existing deletion path) and the wrap record, ending in state `off`.

### 9. What a passphrase must be

At least 8 characters, entered twice to set; no other rule. Normalised with NFKC before derivation so the same passphrase typed on another keyboard layout form matches.

## Risks / Trade-offs

- **A lost passphrase loses the data.** By design; the screen says so before it is set, and offers erase.
- **Re-sealing a large library takes time.** Batches keep the page responsive and the pass is resumable; the Options section shows progress. Accepted.
- **An interrupted pass leaves two keys for a while.** Records are wholly one key each and the gate stays closed until the pass ends, so no reader meets a mixed state.
- **Pages read while locked are lost.** The alternative, buffering them in plain memory, is exactly what the lock forbids.
- **Plain fields remain readable on disk.** Stated in the spec and the Options text; encrypting them is a follow-up.
- **A new permission.** `storage` grants no network access and no host access.

## Migration Plan

One DB version adds the `passphrase-wrap` kind to the key store (the store already exists, so the change is the record shape and a type; no data moves). Nothing runs until the user sets a passphrase. Rolling back means removing the passphrase first; an older build would not know the wrap record, so the Options text tells the user to remove it before downgrading.

## Open Questions

- Should locking be offered from the popup as well as Options? Left out; Options has it.
- Should an idle auto-lock follow? Left to a later change.
