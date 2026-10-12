## MODIFIED Requirements

### Requirement: Package declares only the browser permissions its surfaces use

The manifest SHALL declare the `tabGroups` permission, which starting a session as a tab group needs, and the `sessions` permission, which keeping a session's id on its tabs across closing and restoring needs. It SHALL NOT declare the `tabs` permission, because the extension does not read tab URLs or titles. Adding a permission SHALL NOT add any outbound connection beyond those the content security policy already allows.

#### Scenario: Built manifest declares the tab groups permission

- **WHEN** the built manifest is inspected
- **THEN** its `permissions` include `tabGroups` and `sessions`
- **AND** they do not include `tabs`

#### Scenario: Starting a session makes no network request

- **WHEN** the user starts a session from the popup
- **THEN** the extension issues no outbound network request
