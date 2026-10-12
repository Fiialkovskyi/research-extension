# Design

## Context

- **One gate already decides what is recorded.** `tabCapture/model/isCapturableUrl` admits only `http` and `https`. The three recording paths use it:
  - `recordNavigation`. A page it refuses still closes the node the tab was showing.
  - `followTabMembership`.
  - `reconcileSessionTabs`.
- **Everything else hangs off a node.**
  - The page observer is injected only into a tab with an open node (`observeTab`, `observeIfCaptured`, `injectSessionTabs`).
  - Batches and extracted text are attributed to a node through `readSignalTarget`.
  - Dwell follows `readTabNode`.
  - Titles go to the tab's current node.

  So a page that never becomes a node produces nothing else, without further checks.

- **Host patterns already exist for search engines.** `tabCapture/model/readSearchQuery/utils/isEngineHost` matches `name.*` under a TLD of one or two labels. It is private to `readSearchQuery`.
- **The e2e page server answers any host.** It serves the search hosts with a results page, and every other host from `pages/` by path. The profile resolves only `SEARCH_HOSTS` to the loopback interface.

## Goals / Non-Goals

**Goals:**

- One check, in the existing gate, covering every recording path.
- A list that is data. Adding a bank is an edit to configuration, not to code.
- Catch whole categories that cannot be listed site by site: all government suffixes, and the long tail of banks.

**Non-Goals:**

- **User-added sites** and an options UI for the list.
- **Matching by public suffix list or registrable domain.** Shipping the PSL costs about 200 kB, and the label rules below are enough for a blocklist.
- **Removing records captured before this change.** No release holds any.
- **Path-based rules,** such as `icloud.com/mail`. A host is denylisted or it is not. iCloud is listed as a whole host.

## Decisions

### The list lives in `shared/config/captureDenylist/`

```ts
interface CaptureDenylist {
  version: string; // "capture_denylist@1"
  categories: readonly {
    name: "banking" | "health" | "government" | "webmail" | "passwordManagers";
    domains: readonly string[]; // "chase.com", "hsbc.*"
    suffixes: readonly string[]; // "gov", "gov.uk"
    words: readonly string[]; // "bank"
  }[];
}
```

Grouping by category keeps the REQ-SEC-007 coverage visible, and lets a later options page show and toggle categories. The matcher flattens the entries.

**Initial contents:**

- **Banking and payments.** Major US, UK, EU, Ukrainian and Russian banks and payment services. Examples:
  - `chase.com`, `bankofamerica.com`, `wellsfargo.com`, `citi.com`;
  - `hsbc.*`, `barclays.*`, `santander.*`, `ing.*`;
  - `revolut.com`, `wise.com`, `monzo.com`, `n26.com`;
  - `paypal.com`, `stripe.com` (its dashboard);
  - `privatbank.ua`, `monobank.ua`, `sberbank.ru`, `tbank.ru`, `tinkoff.ru`.
  - Also the word `bank`, and the suffixes `bank` and `banking` (both are TLDs).
- **Health.**
  - Patient portals and providers: `mychart.*`, `nhs.uk`, `healthcare.gov`, `kaiserpermanente.org`.
  - Telehealth and lab services: `zocdoc.com`, `labcorp.com`, `questdiagnostics.com`, `doctolib.*`, `helsi.me`.
  - The suffix `health` is excluded on purpose: it is a TLD used by research sites.
- **Government.**
  - Suffixes: `gov`, `mil`, `gov.uk`, `gouv.fr`, `gc.ca`, `gov.au`, `gov.ua`, `gov.ru`, `bund.de`, `admin.ch`, `europa.eu` (the EU institutions' login portals sit there).
  - Domains: `gosuslugi.ru`, `diia.gov.ua`.
- **Webmail.** `mail.google.com`, `outlook.live.com`, `outlook.office.com`, `outlook.office365.com`, `mail.yahoo.com`, `mail.proton.me`, `proton.me`, `fastmail.com`, `icloud.com`, `mail.ru`, `e.mail.ru`, `ukr.net`, `gmx.*`, `web.de`, `tutanota.com`, `tuta.com`, `zoho.com`.
- **Password managers.** `1password.com`, `bitwarden.com`, `lastpass.com`, `dashlane.com`, `keepersecurity.com`, `nordpass.com`. Proton Pass is under `proton.me`, which the webmail list already covers.

These lists are a starting point, not a claim of completeness. The version is raised with every edit.

### Matching is by host label, never by substring of the whole host

`tabCapture/model/isDenylistedHost(hostname, denylist)` lowercases the host and strips a trailing dot. It returns `true` when any of these holds:

- **Domain.** `host === domain` or `host.endsWith("." + domain)`. For `name.*`, it strips the subdomains one at a time and tests each remainder with the `isEngineHost` rule.
- **Suffix.** `host.endsWith("." + suffix)`, or the host equals the suffix.
- **Word.** Some label of the host contains the word: `examplebank.de` matches `bank`.

`isEngineHost` now has a second caller in another module, so it moves out of `readSearchQuery/utils` to `tabCapture/model/isEngineHost`, beside both callers, unchanged.

**Rejected alternative:** substring matching on the whole host. It would make `purchase.com` match `chase.com`. Label boundaries prevent that.

**Accepted false positives of the word rule:** `worldbank.org` and `bankrate.com` are left out of research. Leaving a page out is the safe failure, and REQ-SEC-007's "plus user-added sites" will later allow overrides.

### `isCapturableUrl` consults the list

```ts
isCapturableUrl(url) = isWebUrl(url) && !isDenylistedHost(new URL(url).hostname, CAPTURE_DENYLIST)
```

That is the whole integration. No call site changes:

- `recordNavigation` already closes the parent on an uncapturable commit.
- `followTabMembership` and `reconcileSessionTabs` already skip such tabs.

The function's name stays: "capturable" is exactly what it decides. Its doc comment names the denylist.

**Rejected alternative:** a separate check at each path. That means three places to forget, and the signal, dwell and snapshot paths would then need it too.

### A denylisted page between two research pages breaks the chain

From node A, through the bank, to page B: B has no parent, because the tab had no open node when B committed. That is deliberate, since a `sameTab` edge from A to B would imply a step that never happened. If the tab has an opener, B links to the opener's current node, as after any unrecorded page. That is existing behaviour, left as it is.

### e2e loads a denylisted host offline

A new constant `DENYLISTED_TEST_HOST = "www.paypal.com"` joins `SEARCH_HOSTS` in `network.dns.localDomains`. The page server already serves any host's paths from `pages/`, so `http://www.paypal.com:<port>/b.html` loads page B under a denylisted host.

## Risks / Trade-offs

- **[Banks and portals not on the list are still recorded]** → The word and suffix rules cover the long tail where they can. The list is versioned, and grows by configuration edits. The remaining gap is closed by user-added sites, a follow-up.
- **[The word rule leaves out research sites such as `worldbank.org`]** → This is the accepted direction of error, until user overrides exist.
- **[A whole-host entry such as `icloud.com` or `proton.me` also hides their public pages]** → The same accepted direction of error.
- **[Hosts reached by IP address or `localhost`]** → No rule matches them. Banks are not served that way.

## Migration Plan

- **Data:** no migration, and nothing stored changes shape.
- **Effect of the update:** a page already recorded stays recorded. Its node closes the next time its tab navigates.
