# Proposal

## Why

REQ-SEC-007 asks for a denylist of the bundled list **plus user-added sites**. The bundled list
(`capture_denylist@1`) cannot know a user's own clinic, their employer's intranet or a private
forum, so today the only way to keep such a page out of a session is not to open it in the
session's group.

## What Changes

- **User-added sites.**
  - The options page gains a "Sites never recorded" card. The user adds a site by its host or by
    pasting any of its URLs, and removes one with a button.
  - A site matches like a listed domain of the bundled list: the host itself and its subdomains,
    never a look-alike (`chase.com` does not match `purchase.com`).
  - The list is kept in the local database, encrypted with the data key, since the sites a person
    hides are themselves private.
- **Capture honours it.**
  - Every recording path that already consults the bundled denylist also consults the user's
    sites. A page on one produces no node, so it is not observed and leaves no signals or
    snapshot, exactly as for a bundled entry.
  - Adding a site affects what is recorded from then on. Pages recorded earlier stay until the user
    deletes them in "What was recorded".

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `capture-denylist`: the denylist is the bundled list plus the sites the user added, and the
  user can edit the latter on the options page.

## Impact

- **Code:**
  - migration 20 adds a `blockedSites` store holding one encrypted record;
  - a new `features/siteDenylist/` with `parseBlockedSite`, `readBlockedSites`,
    `saveBlockedSites` and the options card;
  - `tabCapture/isCapturableUrl` takes the user's sites. `recordNavigation`,
    `followTabMembership` and `reconcileSessionTabs` read them;
  - `app/backgroundApp` answers `denylist.read` and `denylist.save`;
  - the options page shows the card.
- **Tests:**
  - unit specs for parsing, saving and reading, and matching;
  - capture specs for a user-added site;
  - a background spec: a session tab on an added site records nothing;
  - component and options specs.
