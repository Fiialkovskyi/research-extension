# Design

## Context

- **What a snapshot stores today.** `pageSnapshots/recordSnapshot` hashes the text, gzips it (`utils/compressText`) and, in one transaction over `nodes` and `snapshots`, stores `StoredSnapshot.compressedText` and sets the node's `snapshotId` and `contentHash`. Nothing reads the text back yet.
- **Database version 7.** Migrations are synchronous steps inside the version-change transaction. Web Crypto is asynchronous, and an IndexedDB transaction commits as soon as it has no pending request, so a step cannot encrypt existing records.
- **Key storage works.** Firefox stores a `CryptoKey` in IndexedDB by structured clone, and so does the unit runner's `fake-indexeddb`. A probe confirmed that a stored non-extractable key decrypts what the original encrypted.
- **Wake-up hook.** The background's `reconcileSession` runs on `runtime.onStartup` and `runtime.onInstalled`, which includes an update.

## Goals / Non-Goals

**Goals:**

- No snapshot text at rest in the clear, including text stored before this change.
- A key no script can read out.
- A record format that allows a passphrase wrap or a key rotation later without guessing.

**Non-Goals:**

- **Passphrase lock** (REQ-SEC-006) and key rotation.
- **Encrypting facts and statements.** They do not exist yet; they will use the same functions.
- **Encrypting hashes, lengths and timestamps.** The hash reveals only equality between pages, which deduplication needs.
- **Protection against code running as the extension, or a compromised account.** This is out of scope by the target spec's threat model.

## Decisions

### A `dataProtection` feature owns the key and the cipher

`features/dataProtection/model/`:

- **`getDataKey(database) → { id, key }`**
  1. It reads `DATA_KEY_ID` from the `keys` store.
  2. If the key is missing, it generates one: `{ name: "AES-GCM", length: 256 }`, `extractable: false`, usages `encrypt` and `decrypt`.
  3. It stores the key with `add`. If the `add` fails because another caller won the race, it reads again and returns the stored key.

  Generation happens between transactions, because a transaction cannot wait on `crypto.subtle`. The `add` is what makes the first-need race safe.

- **`encryptBytes(dataKey, bytes) → { keyId, cipher: "aes-gcm-256", iv, ciphertext }`**, with a fresh `crypto.getRandomValues(new Uint8Array(12))` per call.
- **`decryptBytes(dataKey, sealed) → ArrayBuffer`.** It throws on an authentication failure, and on a `keyId` or `cipher` it does not know.

It is a feature rather than `shared/`, because it has behaviour and will gain more (a passphrase wrap). The key record lives in `shared/storage` like every other stored shape:

```ts
StoredDataKey { id: string; key: CryptoKey; algorithm: "AES-GCM"; createdAt: number }
```

**Rejected alternative:** deriving the key from a constant or the extension id. That would be readable by anyone who reads the package, and adds nothing over plain text.

### Snapshots store ciphertext of the gzip

`StoredSnapshot` drops `compressedText` and gains:

- `keyId`;
- `cipher: "aes-gcm-256"`;
- `iv: Uint8Array`;
- `encryptedText: ArrayBuffer`.

`recordSnapshot` hashes the plain text, compresses, gets the key and encrypts, all **before** opening its transaction. The transaction is unchanged apart from the record's fields.

The text is compressed before it is encrypted because ciphertext does not compress.

`readSnapshotText(database, snapshotId) → string | undefined` reads the record, decrypts with `getDataKey`, and gunzips with a new `utils/decompressText`. It returns `undefined` for a missing snapshot, and throws if the snapshot cannot be decrypted.

### Existing snapshots are sealed at reconciliation, not in the migration

- **Version 8** only creates the `keys` store, keyed by `id`.
- **`pageSnapshots/sealPlaintextSnapshots(database)`**:
  1. reads all snapshots;
  2. for each record that still has `compressedText` and no `encryptedText`, encrypts the compressed bytes and rewrites the record, one `put` each, deleting `compressedText`.

  It is idempotent, and safe to interrupt: a record is either old or new, never half.

- **When it runs:** the background calls it in `reconcileSession`, on the capture queue, before reconciling tabs.

The scan reads every snapshot. It runs only on start-up or update, and the store holds a few dozen records per session.

**Rejected alternative:** dropping old snapshots in the migration. That loses text the user cannot get back when the page has changed.

### Tests

- **Unit, on `fake-indexeddb` with Node's Web Crypto:**
  - the key persists across database handles;
  - the key is not extractable;
  - two concurrent first needs produce one key;
  - IVs are unique;
  - tampered ciphertext fails;
  - a snapshot record does not contain the plain or the compressed text;
  - a round trip through `readSnapshotText`;
  - sealing a legacy record, and sealing twice.
- **The existing `pageSignals` e2e** already stores a snapshot. Its database reader gains `cipher` and `hasPlaintext`, and the spec asserts `cipher: "aes-gcm-256"` and no plaintext field.

## Risks / Trade-offs

- **[Losing the `keys` store loses every snapshot's text]** → Snapshots are derived from pages, and are captured again on the next deep read. Export (REQ-STO-007) will carry its own passphrase-encrypted copy.
- **[A bug in sealing could corrupt the one copy of old text]** → It writes a record only after its ciphertext decrypts back to the same bytes. A failure leaves the record as it was, and is reported.
- **[The key is usable by anything running as the extension]** → This is the stated limit of REQ-SEC-005. The passphrase lock (REQ-SEC-006) is the answer to it.

## Migration Plan

1. **Version 8:** add `keys`.
2. **First start or update after it:** `sealPlaintextSnapshots` encrypts the stored snapshots.
3. **Rollback:** none, as for every migration. An older build would fail to read `encryptedText`, and nothing reads snapshot text yet.
