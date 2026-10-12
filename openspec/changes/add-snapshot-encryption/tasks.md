# Tasks

## 1. Storage version 8

- [x] 1.1 Add `KEY_STORE` and `StoredDataKey`, and change `StoredSnapshot` to `keyId`, `cipher`, `iv` and `encryptedText`. Raise `DATABASE_VERSION` to 8, with a step that creates `keys`. Extend the `applyDatabaseUpgrade` and `openResearchDatabase` specs:
  - a fresh profile reaches version 8;
  - a version-7 profile keeps its snapshots.

## 2. Data protection

- [x] 2.1 Add `features/dataProtection` with `getDataKey`, `encryptBytes` and `decryptBytes`. The specs cover:
  - the key persists across database handles;
  - the key is not extractable, and exporting it fails;
  - concurrent first needs give one stored key;
  - IVs are 12 bytes and differ per call;
  - a round trip;
  - a changed byte fails;
  - an unknown `keyId` or `cipher` fails.

## 3. Snapshots

- [x] 3.1 `recordSnapshot` encrypts the compressed text. Update its spec:
  - the stored record holds neither the text nor its gzip;
  - it holds `cipher` and `keyId`.
- [x] 3.2 Add `pageSnapshots/model/readSnapshotText`, with `utils/decompressText`. Its spec covers a round trip, a missing snapshot, and a snapshot that fails to decrypt.
- [x] 3.3 Add `pageSnapshots/model/sealPlaintextSnapshots`. Its spec covers:
  - a legacy record becomes encrypted with its hash unchanged, and reads back the same text;
  - running it twice changes nothing;
  - an encrypted record is left alone.
- [x] 3.4 Call `sealPlaintextSnapshots` from `reconcileSession` in `app/backgroundApp`, and add a spec that a legacy snapshot is sealed on start-up.

## 4. End-to-end and documentation

- [x] 4.1 The database reader reports each snapshot's `cipher` and whether a plaintext field remains. `pageSignals.e2e.ts` asserts `cipher: "aes-gcm-256"` and no plaintext.
- [x] 4.2 Update `RESEARCH_GRAPH_EXTENSION_SPEC.md`: REQ-STO-002 and REQ-SEC-005 note what is encrypted, and what stays clear and why.
- [x] 4.3 Run `npm run verify` and confirm that it passes.
