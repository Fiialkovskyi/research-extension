# Tasks

## 1. Storage and model

- [x] 1.1 Add the `blockedSites` store (migration 20) and `StoredBlockedSites`. Verify with the migration spec.
- [x] 1.2 Create `features/siteDenylist` with `parseBlockedSite`, `saveBlockedSites` and `readBlockedSites`. Verify with specs for:
  - a host and a URL;
  - `www.`, case and a trailing dot;
  - rejecting no dot, an IP address and garbage;
  - encryption, sorting and de-duplication;
  - an empty list deleting the record.

## 2. Capture

- [x] 2.1 Give `isCapturableUrl` the user's sites, and read them in `recordNavigation`, `followTabMembership` and `reconcileSessionTabs`. Verify with specs for a subdomain and a look-alike, and for each path recording nothing on an added site.

## 3. Background and options

- [x] 3.1 Add `denylist.read` and `denylist.save` to `app/backgroundApp`. Verify with a background spec: after a save, a session tab on the site records no node, and an invalid entry is refused.
- [x] 3.2 Add `BlockedSitesCard` to the options page. Verify with component and options specs.

## 4. Documentation and verification

- [x] 4.1 Update `RESEARCH_GRAPH_EXTENSION_SPEC.md`: REQ-SEC-007 as built, and the M6 item, marking the denylist editor done and the passphrase lock still open. Verify that `openspec validate add-site-denylist-editor --strict` passes.
- [x] 4.2 Run `npm run verify` and confirm that it passes.

## Deferred

- [ ] Manual check: add a site in the options page, open it in the session's group, and confirm that nothing appears in the popup tree.
