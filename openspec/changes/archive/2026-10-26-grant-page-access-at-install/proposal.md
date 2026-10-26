# Proposal

## Why

Reading time, scroll depth and copies are recorded only when the extension has access to page contents, and today that access is optional: the popup asks for it when a session starts, and a user who answers "no" or dismisses the prompt gets a session that quietly records less. The prompt is also a second consent step on top of the install, which asks the user to trust the extension twice for one purpose. The extension runs only in a session's own tabs, so the reach of the grant is the same either way; what changes is when the user is asked.

## What Changes

- Move `<all_urls>` from `optional_host_permissions` to `host_permissions`, so Firefox (minimum 140, which prompts for and grants a Manifest V3 add-on's host permissions at install) grants it with the install and a session needs no click.
- Starting a session no longer asks the browser for page access when the extension already has it.
- Keep the popup's notice and "Allow page access" control, and the starting-a-session request, for the case where the user revoked access in `about:addons`.
- Keep observing only the tabs of a session: nothing is injected into any other tab, and nothing is recorded until a session is started.
- Update the manifest e2e and the egress setup, which grants access by hand today.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `extension-shell`: page access becomes a required host permission, beside the loopback origin; the other permission rules and the no-request-on-start rule stay.
- `research-session`: starting a session asks for page access only when it is missing, and the popup's missing-access notice describes access that was revoked.

## Impact

- `wxt.config.ts` (manifest), `e2e/specs/manifest.e2e.ts`, and `e2e/specs/egress.e2e.ts` with the `grantPageAccess` fixture, which becomes a no-op for a fresh install and stays for revoking.
- The install prompt shows "Access your data for all websites"; the AMO listing and onboarding text must say why (see design).
- `isOllamaAccessGranted` already refuses to treat a broad grant as the loopback grant, so Ollama behaviour is unchanged.
