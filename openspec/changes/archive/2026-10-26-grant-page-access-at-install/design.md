# Design

## Context

`wxt.config.ts` declares `<all_urls>` under `optional_host_permissions` and the loopback origin under `host_permissions`. The popup (`popupApp`, `PageAccess`) calls `permissions.contains` when it opens and `permissions.request` from the start-session click and from the "Allow page access" button. Content observation is injected by `scripting` into session tabs only, and the observer is registered when access appears (`permissions.onAdded`). `FIREFOX_MIN_VERSION` is 140.

## Goals / Non-Goals

**Goals:**

- A fresh install records reading time, scroll and copies in a session with no extra click.
- A user who later revokes access still sees what is missing and can restore it from the popup.

**Non-Goals:**

- Widening what is recorded: tabs outside a session's group are still never observed.
- Changing the loopback origin's handling, or any CSP.
- Install-time consent screens of our own.

## Decisions

### 1. Required, not requested at runtime

A required `host_permissions` entry is granted by Firefox 127 and later with the install (the user sees it in the install prompt and may decline there). That removes the runtime request entirely for the normal path. The alternative, keeping it optional and asking from a user gesture as today, is what produced silent partial recording.

### 2. The revoked case keeps its existing UI

In `about:addons` the user can switch a granted host permission off. The popup already reads `permissions.contains` on open and offers `permissions.request`; both stay and are only exercised after a revoke. Whether `permissions.request` may re-ask for an origin that is a required `host_permissions` entry is not documented firmly; the first task checks it in Firefox and, if it is refused, the popup's control instead points to the add-on's permissions page.

### 3. Observation scope does not widen

The grant only makes it possible to inject; the existing capture still injects into session tabs only. A spec scenario and an e2e assert that a tab outside any session group gets no observer.

## Risks / Trade-offs

- **Stricter install prompt.** "Access your data for all websites" may deter installs and draws AMO reviewer attention. Mitigation: onboarding and the listing say pages are read only in a session's tabs, locally; the egress suite already proves no remote request.
- **Temporary installs (checked).** Firefox 158 grants `<all_urls>` to a temporary install: its stored origins hold it right after install, so e2e needs no `grantPageAccess`; a new `revokePageAccess` fixture covers the revoked and granted-later paths.
- **Temporary installs, original risk.** `npm run dev` and e2e install temporarily; whether Firefox grants required host permissions to them must be confirmed (task 1.1). If it does not, the dev and e2e flows keep calling `grantPageAccess`.
- **Checked by hand:** `permissions.request` re-prompts for a revoked required origin, so the popup's control needs no fallback (decision 2). The notice is drawn as an amber warning, like the AI setup banner.
