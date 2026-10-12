# Spec Delta

## MODIFIED Requirements

### Requirement: Package declares only the browser permissions its surfaces use

The manifest SHALL declare the `tabGroups` permission, which starting a session as a tab group needs; the `sessions` permission, which keeping a session's id on its tabs across closing and restoring needs; the `tabs` and `webNavigation` permissions, which capturing the session's pages needs: `tabs` to read a tab's URL and title, `webNavigation` to read how a page was reached; the `scripting` permission, which observing a session page needs; and the `idle` permission, which measuring active reading time needs. It SHALL declare no other API permission. Access to page contents (`<all_urls>`) SHALL be declared as an optional host permission, requested only when a session starts or from the popup, and never granted at install. Adding a permission SHALL NOT add any outbound connection beyond those the content security policy already allows.

#### Scenario: Built manifest declares the tab groups permission

- **WHEN** the built manifest is inspected
- **THEN** its `permissions` are exactly `tabGroups`, `sessions`, `tabs`, `webNavigation`, `scripting` and `idle`

#### Scenario: Page access is optional

- **WHEN** the built manifest is inspected
- **THEN** its optional host permissions are exactly `<all_urls>`
- **AND** `<all_urls>` is not among its required host permissions

#### Scenario: Starting a session makes no network request

- **WHEN** the user starts a session from the popup
- **THEN** the extension has issued no outbound network request
