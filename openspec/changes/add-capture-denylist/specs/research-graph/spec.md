# Spec Delta

## MODIFIED Requirements

### Requirement: Pages read in the session's group become nodes

WHEN a page commits in the top frame of a tab that is in the active session's group, the extension SHALL record a node for it within 1 s. It SHALL NOT record a node for a reload, a fragment change, a page that is not `http` or `https`, a page on the capture denylist, a tab in a private window, or a tab outside the group.

#### Scenario: Navigating in a session tab

- **GIVEN** a session is active and its group's tab shows `https://example.org/a`, recorded as node A
- **WHEN** the user follows a link to `https://example.org/b` in that tab
- **THEN** a node B is recorded with A as its parent
- **AND** a `sameTab` edge from A to B is recorded
- **AND** A is marked closed

#### Scenario: Reload

- **WHEN** the user reloads a session tab
- **THEN** no node is recorded

#### Scenario: New-tab page

- **WHEN** a session tab shows `about:newtab`
- **THEN** no node is recorded for it

#### Scenario: Denylisted page

- **WHEN** a session tab shows `https://www.paypal.com/myaccount`
- **THEN** no node is recorded for it

#### Scenario: Tab outside the group

- **WHEN** a page commits in a tab that is not in the session's group
- **THEN** no node is recorded
