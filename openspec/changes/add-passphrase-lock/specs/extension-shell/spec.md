# Spec Delta

## MODIFIED Requirements

### Requirement: Package declares exactly the browser permissions its surfaces use

The manifest SHALL declare the `tabGroups` permission, which starting a session as a tab group needs; the `sessions` permission, which keeping a session's id on its tabs across closing and restoring needs; the `tabs` and `webNavigation` permissions, which capturing the session's pages needs: `tabs` to read a tab's URL and title, `webNavigation` to read how a page was reached; the `scripting` permission, which observing a session page needs; the `idle` permission, which measuring active reading time needs; the `alarms` permission, which waking the background for queued jobs needs; the `notifications` permission, which telling the user once after install that AI needs setting up needs; and the `storage` permission, which keeping the unlocked data key in memory across background restarts needs. Where the extension rewrites the origin of its own requests to the local inference server, it SHALL also declare the one permission that rewrite needs. It SHALL declare no other API permission. Access to page contents (`<all_urls>`) SHALL be declared as a required host permission, so that it is granted with the install, and SHALL be used only to observe the tabs of a session. The local inference server's loopback origin SHALL be the only other required host permission. Adding a permission SHALL NOT add any outbound connection beyond those the content security policy already allows.

#### Scenario: Built manifest declares the tab groups permission

- **WHEN** the built manifest is inspected
- **THEN** its `permissions` are exactly `tabGroups`, `sessions`, `tabs`, `webNavigation`, `scripting`, `idle`, `alarms`, `notifications` and `storage`, plus the origin-rewrite permission where one is used

#### Scenario: Page access is required

- **WHEN** the built manifest is inspected
- **THEN** its required host permissions are exactly `<all_urls>` and `http://127.0.0.1:11434/*`
- **AND** it declares no optional host permission

#### Scenario: Starting a session makes no network request

- **WHEN** the user starts a session from the popup
- **THEN** the extension has issued no outbound network request

#### Scenario: Tabs outside a session are not observed

- **GIVEN** page access is granted and a session is active
- **WHEN** a page is read in a tab that is not in the session's group
- **THEN** no page observer runs in that tab
