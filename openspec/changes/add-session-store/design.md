# Design

## Context

For the motivation, see proposal.md. The requirements are in `specs/research-session`.

The current state:

- The database `research-graph` is at version 2 with the stores `models`, `modelFiles` and `runs`. `applyDatabaseUpgrade` runs forward-only steps inside one version-change transaction.
- The background answers `tabGroup.create` by running `createTabGroup` and keeps nothing afterwards.
- The spike's Findings (archived as `2026-10-12-spike-tab-groups`) establish:
  - a group keeps its `tabGroups` id, title and colour across a restart with session restore;
  - closing a group's last tab fires `tabGroups.onRemoved` with `isWindowClosing: false`, and `tabGroups.get` then rejects;
  - renaming a group fires `tabGroups.onUpdated`.

## Goals / Non-Goals

**Goals:**

- The session survives an event-page unload and a browser restart, and finds its group again by `groupId`.
- At most one session is active, enforced by the database rather than by the popup.
- The session ends when its group is gone, so a dead session never blocks starting a new one.

**Non-Goals:**

- Tracking the group's tabs. That is the graph change.
- Pause, save as a user action, library, resume, delete.
- Several sessions.

## Decisions

### The record

```ts
interface StoredSession {
  id: string; // crypto.randomUUID()
  title: string;
  groupId: number; // the Firefox tab group, stable across restarts
  status: "active" | "saved";
  createdAt: number;
  updatedAt: number;
}
```

- Fields are camelCase, unlike the target spec's `snake_case` `Session`: the code guide's storage rules win, and the spec's names are a description, not a wire format.
- There is no `schema_version` per record. The database version covers it, and a migration rewrites records when their shape changes.
- `paused`, `root_node_id`, `last_position` and `active_embedding_space_id` are left out until the change that first uses each.
- `windowId` is deliberately not stored: a window id is not stable across restarts, a group id is.
- Index `status` serves `getActiveSession`. No other index is added until a query needs it.

### One active session, checked in the writing transaction

`createSession` opens one `readwrite` transaction on `sessions`, reads the `status` index for `"active"`, throws if it finds one, and otherwise puts the new record. IndexedDB serialises overlapping `readwrite` transactions on the same store, so two concurrent starts cannot both pass the check.

`startSession` also checks before it creates the group, so the common case is refused without opening a tab. The second check is what makes the invariant hold; the first only avoids a needless group.

### Order of a start, and its rollback

1. `reconcileActiveSession`, so a session whose group has gone does not block the start.
2. If a session is still active: refuse with `A session is already active: "<title>".`
3. `createTabGroup` (unchanged from the spike).
4. `createSession` with the new `groupId`.
5. If step 4 throws, close the group's tab (Firefox removes the emptied group) and rethrow.

The answer is still `tabGroup.created` or `tabGroup.failed`. Renaming the message to the spec's `session.start` would touch the popup, its tests and the e2e harness for no behavioural gain, and is left for when the session messages grow.

### Following the group

| Browser event                                     | Effect                                                                                                 |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `tabGroups.onUpdated(group)`                      | If `group.id` is the active session's group and the title differs, rename the session.                 |
| `tabGroups.onRemoved(group, { isWindowClosing })` | If `isWindowClosing` is false and `group.id` is the active session's group, end the session (`saved`). |
| `runtime.onStartup`                               | Reconcile.                                                                                             |

A removal with `isWindowClosing: true` is ignored. When Firefox quits or a window closes, the group is not deleted by the user; session restore may bring it back, and reconciliation decides later.

The listeners are registered synchronously in the background entrypoint, before any `await`, and forward to three methods on the background app (`handleGroupUpdated`, `handleGroupRemoved`, `reconcileSession`), so the logic is unit tested without a browser.

### Reconciliation

`reconcileActiveSession({ database, getGroup })`:

- no active session → nothing;
- `getGroup(groupId)` rejects → end the session;
- the group's title differs from the session's → rename the session.

It runs on `runtime.onStartup`, at the start of every session start, and on every `session.getActive`. The last two cover a window that was closed without a restart, where no start-up event follows.

### Persistent storage

The background app takes `persistStorage: () => Promise<boolean>`; the entrypoint passes `navigator.storage.persist`. It is called after every successful start (it is idempotent), and its result and any error are ignored: persistence is a request the browser may decline, and a declined request must not fail a start.

### Popup

On mount the popup sends `session.getActive`. While the answer is pending it shows the greeting only. With an active session it shows `Session "<title>" is active.` (`data-testid="session-active"`) and no form; without one it shows the form as before. A successful start switches it to the active-session view.

## Risks / Trade-offs

- **Saved groups are not reattached.** "Save and close group" in Firefox removes the group (`isWindowClosing: false`), so the session ends. Whether a group reopened from the saved list keeps its id is still unchecked; the spike could not reproduce saved groups in the automated profile. Until a manual check answers it, a reopened group starts no session and resumes none. → The user starts a new session; reattaching is a follow-up once the id behaviour is known.
- **A window closed without quitting** leaves the session active with a dead group until the next reconciliation. → Reconciliation runs on every popup open and every start, which are the only moments a dead session would be noticed.
- **The target spec stays in `snake_case`.** → Recorded here; the spec describes shapes, not storage names.

## Migration Plan

Step 3 creates the `sessions` store with the `status` index. It changes no existing store, so a profile at version 2 keeps its models and runs. Rollback is not supported (forward-only), which is the existing policy.

## Open Questions

- Does a group reopened from Firefox's saved groups keep its id? (Manual check pending, see Risks.)
