# Design

## Context

- **Why the add-on's own traffic.** Firefox makes requests of its own: updates, remote settings
  and safe browsing. The add-on's guarantee is about the add-on, so the check attributes each
  request by its principal rather than watching a proxy.
- **How to attribute.** Every channel carries `loadInfo` with a triggering and a loading
  principal:
  - for the add-on's pages and workers, these are its `moz-extension:` principal, which carries
    its `addonId`;
  - for a content script, it is an expanded principal whose allowlist holds the add-on's.

## Decisions

### 1. The recorder

- **Installation.** A chrome-context script adds one `http-on-modify-request` observer and keeps
  its log on the hidden window, which lives as long as the app. Each WebDriver script runs in its
  own sandbox, so the log cannot live on the script's global.
- **What it logs.** Each request carries `{ url, type }`, where `type` is the external content
  policy type.
- **Idempotent.** A second start only empties the log.

### 2. A positive control

The probe opens one channel with the add-on's principal (`NetUtil.newChannel` with
`loadingPrincipal: policy.extension.principal`) to the suite's page server. The first test asserts
that the log lists it. Without the probe, an observer attributing nothing would pass vacuously.

### 3. What counts

`findExtensionEgress` drops `TYPE_DOCUMENT` loads. A top-level tab the add-on opens, such as a gap's
search or resuming a session, is the user's navigation, made at their request. Everything else is
egress.

### 4. The gate

`isOllamaAccessGranted(grantedOrigins)` requires each local inference origin's own pattern among
`permissions.getAll().origins`. Firefox lists optional grants individually, so the user's
"Connect" shows up as `http://127.0.0.1:11434/*` even when `<all_urls>` is also granted.

## Risks / Trade-offs

- **[Chrome internals]** `hiddenDOMWindow`, the observer topic and `NetUtil` are Firefox
  internals. → They are kept in one fixture, as the toolbar internals are, so a Firefox change
  breaks one place.
- **[A user who connected through about:addons]** Granting the loopback origin there lists it
  just the same, so it counts.
