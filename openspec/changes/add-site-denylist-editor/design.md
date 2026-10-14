# Design

## Context

- **The check.** `tabCapture/isCapturableUrl(url)` is the single gate: it is called by
  `recordNavigation`, `followTabMembership` and `reconcileSessionTabs`. Everything else capture
  keeps hangs off a node, and the page observer is injected only into tabs with an open node. So
  gating these three paths keeps a page entirely unrecorded.
- **The matcher.** `isDenylistedHost(hostname, denylist)` matches the bundled list's categories
  of domains, suffixes and words.
- **Encryption.** `dataProtection` holds `getDataKey`, `encryptBytes` and `decryptBytes`, the same
  pattern table columns use.

## Decisions

### 1. Storage (migration 20)

- **The store.** `blockedSites` is keyed `id` and holds a single record: `{ id: "user", keyId,
  iv, encryptedSites }`. `encryptedSites` is the JSON list of hosts.
- **Lifetime.** The list is not session-scoped, so `deleteSession` does not touch it.
- **Saving.** `saveBlockedSites(database, sites)` normalises, de-duplicates and sorts the list.
  An empty list deletes the record.

### 2. Parsing (`parseBlockedSite`)

- **Input.** It accepts a host (`example.org`) or a URL with any scheme handled by `URL`; a bare
  host is read as `https://<input>`.
- **The result.** The hostname is lowercased, with a trailing dot and a leading `www.` removed, so
  the site's subdomains, `www` among them, match.
- **Rejected input.**
  - anything that does not parse;
  - a host with no dot (`localhost`, `intranet`);
  - an IP address, since matching by subdomain means nothing for one;
  - a host longer than 253 characters.

  The function returns `undefined` for these.

### 3. Matching

`isCapturableUrl(url, blockedSites = [])` also refuses a host that `isDenylistedHost` matches
against `{ domains: blockedSites, suffixes: [], words: [] }`. This reuses the bundled list's
domain rule, subdomains included, without look-alikes. Each of the three callers reads the list
with `readBlockedSites(database)` before checking. The list is a handful of hosts decrypted per
navigation, which costs well under a millisecond.

### 4. Messages and the card

- **`denylist.read`** answers `denylist.view { sites }`.
- **`denylist.save { sites }`** parses every entry, refuses with the offending entry if one does
  not parse, and otherwise saves and answers `denylist.view` with the stored list.
- **The card.** `BlockedSitesCard` (`features/siteDenylist/ui`) is a list with "Remove", plus an
  input and "Add". It checks the input with `parseBlockedSite` before sending, and says "Enter a
  site such as example.org" when the input does not parse. It also notes that the bundled list
  already covers banks, health, government, webmail and password managers.

## Risks / Trade-offs

- **[Pages recorded before the site was added]** They are kept. Deleting them silently could
  surprise the user, and "What was recorded" already deletes per page. An offer to delete them on
  add is an open question.
- **[An over-broad entry]** Adding `example.com` hides all its subdomains. That is what the user
  asked for, and the list shows exactly what was stored.

## Migration Plan

Version 20 adds the empty store. Rollback ignores it, and the user's sites are recorded again.

## Open Questions

- When a site is added, should the card offer to delete what the current session already
  recorded from it?
