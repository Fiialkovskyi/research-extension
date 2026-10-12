# Proposal

## Why

Since `add-engagement-signals`, the readable text of every deep-read page is stored in the
extension's IndexedDB, compressed but in the clear. Anything that can copy the profile's files can
then read it: a backup, a sync tool, another program running as the same user. REQ-SEC-005 requires
snapshot text to be encrypted at rest, and this is the last open privacy gap from that change, now
that the denylist keeps sensitive sites out.

## What Changes

- **A data key.** The extension creates one AES-GCM 256-bit data key on first need. It is a
  non-extractable `CryptoKey` kept in a new `keys` store (database version 8). The key's bytes can
  never be read out by script, including the extension's own.
- **Encrypted at rest.** A snapshot's compressed text is encrypted with that key under a fresh random
  IV, and only the ciphertext is stored. The record names the key and the cipher, so a later rotation
  or passphrase wrap (REQ-SEC-006) can tell old records from new.
- **Hash and length stay in the clear.** The content hash and byte length are not encrypted. They say
  whether two pages are the same text, but not what it is.
- **Reading back.** A new read path decrypts and inflates a snapshot's text, for the indexing work that
  will consume it.
- **Existing snapshots.** Snapshots written before this change are encrypted in place when the
  background next starts or is updated.

## Capabilities

### New Capabilities

- `data-protection`: the extension's data key — how it is created, kept and used to encrypt and
  decrypt stored content. Snapshots are its first user; facts and statements will be next.

### Modified Capabilities

- `page-snapshots`: snapshot text is encrypted at rest and readable only through the extension.

## Impact

- **New code:** `features/dataProtection/` (`getDataKey`, `encryptBytes`, `decryptBytes`).
- **Changed code:**
  - `pageSnapshots/recordSnapshot` encrypts.
  - New `pageSnapshots/readSnapshotText` and `pageSnapshots/sealPlaintextSnapshots`.
  - The background runs the sealing at reconciliation.
- **Storage:**
  - Version 8 adds the `keys` store.
  - `StoredSnapshot` replaces `compressedText` with `encryptedText`, `iv`, `keyId` and `cipher`.
- **Threat model:** this guards against copied profile files and other extensions, not against a full
  compromise of the user account, which can drive the extension itself (target spec §10). Losing the
  `keys` store makes the snapshots unreadable; they are derived data and are captured again on the
  next deep read.
