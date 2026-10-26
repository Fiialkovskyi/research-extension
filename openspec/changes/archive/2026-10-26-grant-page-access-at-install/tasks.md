# Tasks

## 1. Check what Firefox does

- [x] 1.1 In Firefox 140 or later, install a build with `<all_urls>` required, temporarily and as a signed or unsigned permanent install if possible; verify `permissions.contains` is true right after install in each case, and note which case needs `grantPageAccess`.
- [x] 1.2 Checked by hand (it re-prompts and the notice goes away): Revoke the permission in `about:addons` and call `permissions.request({ origins: ["<all_urls>"] })` from the popup; verify whether it prompts. If it does not, choose the fallback in design decision 2 and record it in the design.

## 2. Manifest

- [x] 2.1 Move `<all_urls>` from `optional_host_permissions` to `host_permissions` in `wxt.config.ts`, with the comment explaining why; verify `npm run build:firefox` writes it to the manifest.
- [x] 2.2 Update `e2e/specs/manifest.e2e.ts` for the required `<all_urls>` and no optional host permission; verify it passes.

## 3. Popup and capture

- [x] 3.1 Keep the popup requesting access only when `isGranted` is false; verify the `popupApp` specs cover granted, revoked and refused, and that a granted extension is never asked.
- [x] 3.2 Cover a page read outside every session group: `pageSignals.e2e` already checks nothing is recorded for it, and the observer is injected into session tabs only; verify it passes.

## 4. E2E and docs

- [x] 4.1 Drop `grantPageAccess` from the specs that only needed it to read pages (egress, pageSignals, recordedData) where task 1.1 shows the install already grants it; keep it for the revoke case; verify `npm run test:e2e` passes.
- [x] 4.2 Write the install note: update `RESEARCH_GRAPH_EXTENSION_SPEC.md` (the page-access task) and add the reason for the permission to the onboarding text; verify `openspec validate grant-page-access-at-install` passes.
- [x] 4.3 Run `npm run verify`; report anything not run.
