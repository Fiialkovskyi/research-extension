# Proposal

## Why

Since `add-engagement-signals`, a session page is observed and, once deep read, its text is stored.
A banking, webmail, health, government or password-manager page that ends up in the session's group
is recorded like any other: its URL and title become a node, and its contents can become a snapshot.
REQ-CAP-008 and REQ-SEC-007 require such pages to produce nothing, and this is the largest privacy gap
left before the extension is used for real research.

## What Changes

- A bundled, versioned denylist (`capture_denylist@1`) covers banking and payments, health, government,
  webmail and password managers. It has three kinds of entry:
  - **Domains**, which match a host and every subdomain of it. One ending in `.*` matches its name
    under any top-level domain.
  - **Suffixes**, such as `gov`, `gov.uk` or `gouv.fr`, which match every host under them.
  - **Host words**, such as `bank`, which match any host with a label containing the word.
- A page on a denylisted host is not capturable. It produces no node, so it also gets:
  - no edge;
  - no title;
  - no focus, active dwell or revisit;
  - no page observer, and so no scroll, copy or snapshot.
- A session tab that navigates to a denylisted page closes the node it was showing, as it does for any
  page that is not recorded. A tab opened from a denylisted page has no opener in the graph.
- The list errs on the side of leaving pages out: a research page wrongly left out costs less than a
  bank page wrongly recorded.

## Capabilities

### New Capabilities

- `capture-denylist`: which pages are never recorded because they are sensitive. It covers the bundled
  list and its versioning, how a URL is matched against it, and what a denylisted page does not
  produce.

### Modified Capabilities

- `research-graph`: the requirement that pages in the session's group become nodes adds denylisted
  pages to the pages that never do.

## Impact

- **Code:**
  - New `src/shared/config/captureDenylist/`, holding the list and its types.
  - New `tabCapture/model/isDenylistedHost`.
  - `tabCapture/model/isCapturableUrl` consults the denylist. All three recording paths
    (`recordNavigation`, `followTabMembership`, `reconcileSessionTabs`) already go through it, and
    signals, dwell, injection and snapshots all hang off a node, so nothing else changes.
- **Not covered:**
  - **User-added sites.** They need the options page and a stored list.
  - **Records made before this change.** The extension has not been released, so only development
    profiles hold any, and no migration removes them.
- **e2e:** one more host resolved to the loopback interface, so a denylisted page can be loaded
  offline.
