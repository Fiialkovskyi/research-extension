# Tasks

## 1. The list

- [x] 1.1 Add `src/shared/config/captureDenylist/` (`types.ts`, `constants.ts`) with `CAPTURE_DENYLIST` at version `capture_denylist@1` and the five categories from design.md, and export it from the config barrel. Add a `constants.spec.ts` guard that checks:
  - every category is present and non-empty;
  - every entry is lowercase, with no scheme, path or leading dot;
  - no entry is listed twice.

  Verify that `npm run test` passes.

## 2. Matching and the capture gate

- [x] 2.1 Move `readSearchQuery/utils/isEngineHost` to `tabCapture/model/isEngineHost`, unchanged, with its spec, and update `readSearchQuery`'s import. Verify that the `readSearchQuery` specs still pass.
- [x] 2.2 Add `tabCapture/model/isDenylistedHost(hostname, denylist)`. Its spec covers:
  - an exact domain and a subdomain;
  - `name.*` under `co.uk` and `de`;
  - the suffixes `gov` and `gov.uk`;
  - the word `bank` inside a label;
  - case and a trailing dot;
  - `purchase.com` against `chase.com`;
  - `en.wikipedia.org`, `example.org` and an IP address not matching.
- [x] 2.3 Make `isCapturableUrl` refuse a denylisted host, and update its doc comment. Extend its spec with a denylisted `https` page, and an `http` page that is not denylisted.
- [x] 2.4 Extend the path specs:
  - `recordNavigation`: a commit to a denylisted page records nothing and closes the parent, and the next ordinary commit records a node with no parent.
  - `followTabMembership`: a denylisted tab that joins the group records nothing.
  - `reconcileSessionTabs`: skips a denylisted group tab.
- [x] 2.5 In `app/backgroundApp/index.spec.ts`, check that a denylisted commit in a session tab neither injects the observer nor records dwell. Verify that `npm run test` passes.

## 3. End-to-end and documentation

- [x] 3.1 Fixtures: add `DENYLISTED_TEST_HOST` to `pageServer/constants.ts` and include it in `network.dns.localDomains` through `buildProfilePreferences`, updating its spec.
- [x] 3.2 Add `e2e/specs/captureDenylist.e2e.ts`. In one session:
  1. Load page A.
  2. Load `http://www.paypal.com:<port>/b.html` in the same tab. The graph has only A's node, now closed.
  3. Load page C. C's node has no parent.
  4. The map shows two nodes and no edge.

  Verify that `npm run test:e2e` passes.

- [x] 3.3 Update `RESEARCH_GRAPH_EXTENSION_SPEC.md`:
  - REQ-CAP-008 and REQ-SEC-007 name `capture_denylist@1` and the matching rules;
  - user-added sites are still to come.

  Verify that `openspec validate add-capture-denylist --strict` passes.

- [x] 3.4 Run `npm run verify` and confirm that it passes.
