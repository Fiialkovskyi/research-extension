## MODIFIED Requirements

### Requirement: Package declares only the browser permissions its surfaces use

The manifest SHALL declare the `tabGroups` permission, which starting a session as a tab group needs, and the `tabs` and `webNavigation` permissions, which capturing the session's pages needs: `tabs` to read a tab's URL and title, `webNavigation` to read how a page was reached. It SHALL declare no other API permission. Adding a permission SHALL NOT add any outbound connection beyond those the content security policy already allows.

#### Scenario: Built manifest declares the tab groups permission

- **WHEN** the built manifest is inspected
- **THEN** its `permissions` are exactly `tabGroups`, `tabs` and `webNavigation`

#### Scenario: Starting a session makes no network request

- **WHEN** the user starts a session from the popup
- **THEN** the extension has issued no outbound network request
