# Tasks

## 1. The key and its lock

- [ ] 1.1 In `dataProtection`, add a held-key slot (`holdDataKey`, `releaseDataKey`) and `DataLockedError`; make `getDataKey` return the held key or throw `DataLockedError` when a `passphrase-wrap` record exists, and behave as before otherwise; verify specs for no wrap record, a wrap record with and without a held key, and that no key is generated while a wrap record exists.
- [ ] 1.2 Add the `passphrase-wrap` record kind to the key store and its type in `shared/storage` with the migration to the next DB version; verify the migration spec (existing key records untouched, forward-only).
- [ ] 1.3 Add `passphraseLock` key functions, one per directory: derive a wrapping key from a passphrase (NFKC, PBKDF2-SHA-256, 600,000 iterations), wrap and unwrap 32 key bytes, import them as a non-extractable key; verify specs for a round trip, a wrong passphrase failing, the iteration count, salt uniqueness and that the passphrase is not stored.
- [ ] 1.4 Add `getLockState(database)` (`off`, `locked`, `unlocked`, `securing`); verify specs for each.

## 2. Setting, changing, removing

- [ ] 2.1 Add `resealRecords(database, from, to)`: the table of sealed fields per store, batched, one transaction per batch, each record wholly one key, skipping records already on the new key, resumable; verify specs for every store, a mixed start, a failed decrypt leaving both keys, and idempotence.
- [ ] 2.2 Add `enablePassphrase`, `changePassphrase` and `removePassphrase`: validation (length, match, current passphrase), wrap record with `phase: "sealing"` until the pass ends, old key deleted last; verify specs including an interrupted pass that resumes.

## 3. The background

- [ ] 3.1 Add `lock.status`, `lock.unlock`, `lock.lockNow`, `lock.enable`, `lock.change`, `lock.remove` and `lock.erase` messages, the `lock` data topic, and a `keyVault` dependency over `storage.session` (bytes written on unlock, read on wake, cleared on lock); verify `backgroundApp` specs for each message, a wrong passphrase, and a wake that restores the key.
- [ ] 3.2 Gate `handleRequest` (only `lock.status`, `lock.unlock`, `lock.erase` answered while locked or securing; others get `lock.locked`); verify a spec that no handler runs and no data is read while locked.
- [ ] 3.3 Gate recording: `handleContentMessage` answers `signal.dropped` with `stop: false` and stores nothing, and every tab listener's capture work is skipped, while locked; audit every background listener and write a spec per entry point; verify the database stays empty after each.
- [ ] 3.4 Gate the job runner and its alarm while locked; verify queued jobs stay queued and run after unlock.
- [ ] 3.5 Add `lock.erase` over the existing deletion path plus removal of the wrap record; verify it ends in state `off` with no recorded data.
- [ ] 3.6 Declare the `storage` permission in `wxt.config.ts`; verify the `manifest` e2e spec lists it.

## 4. The surfaces

- [ ] 4.1 Add `LockScreen` and a lock reader (status on mount, follows the `lock` topic); verify component specs (wrong passphrase, erase confirmation, nothing but the field shown).
- [ ] 4.2 Render the lock screen from the popup, Options, Summaries, Recorded data and Map roots when the status is not `off` or `unlocked`; verify each root's spec shows no content while locked and the content after unlocking.
- [ ] 4.3 Add the Options "Passphrase" section: set, change, remove, Lock now, the "Securing your data" progress and the text on what is sealed and what is not; verify component specs.

## 5. End to end and docs

- [ ] 5.1 Add an e2e spec: set a passphrase, lock now, see the lock screen, read a page while locked and find nothing stored, unlock, and see the earlier data; run it with `npm run test:e2e` and report. If the browser restart cannot be driven, say so and keep the restart case in the `backgroundApp` spec.
- [ ] 5.2 Document in `RESEARCH_GRAPH_EXTENSION_SPEC.md` (REQ-SEC-006 as built, the limits, roadmap line ticked) and run `openspec validate add-passphrase-lock`.
- [ ] 5.3 Run `npm run verify` and report the result faithfully.
