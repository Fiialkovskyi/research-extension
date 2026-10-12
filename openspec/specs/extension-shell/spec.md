# extension-shell Specification

## Purpose

Defines how the research-graph add-on is packaged for the browser and which surfaces the browser exposes to the user. It owns the manifest contract, the toolbar action and its popup document, and the guarantee that the package carries all of its own code.

## Requirements

### Requirement: Firefox MV3 package contract

The packaged extension SHALL declare Manifest V3 and SHALL target Firefox explicitly: a stable add-on identifier and a minimum Firefox version of 140.0. A build that omits either SHALL be treated as invalid.

#### Scenario: Built package declares its platform contract

- **WHEN** the extension is built for Firefox
- **THEN** the produced manifest declares `manifest_version: 3`
- **AND** it declares a stable add-on id under `browser_specific_settings.gecko.id`
- **AND** it declares `browser_specific_settings.gecko.strict_min_version` of `"140.0"`

#### Scenario: Package installs into a supported Firefox

- **WHEN** the built package is installed into a Firefox at or above the declared minimum version
- **THEN** installation succeeds and the extension is listed as enabled

### Requirement: Toolbar action opens a popup

The extension SHALL expose a toolbar action whose primary interaction opens a popup document anchored to the toolbar icon. The action SHALL NOT open a sidebar, a tab, or a separate window.

#### Scenario: User clicks the toolbar icon

- **WHEN** the user clicks the extension's toolbar icon
- **THEN** a popup panel opens anchored to the icon
- **AND** no sidebar, tab, or window is opened

#### Scenario: Popup document is declared in the manifest

- **WHEN** the built manifest is inspected
- **THEN** the toolbar action declares a popup document
- **AND** that document is present in the package at the declared path

### Requirement: Popup renders a greeting

The popup SHALL render the text `Hello World` as visible content whenever it is opened, without requiring network access, stored state, or any prior user action.

#### Scenario: Popup shows the greeting on first open

- **WHEN** the popup document is loaded in the extension's own context
- **THEN** the text `Hello World` is visible in the popup

#### Scenario: Popup renders offline

- **WHEN** the popup is opened while the machine has no network connectivity
- **THEN** the text `Hello World` is still visible

### Requirement: Popup follows the system colour scheme

The popup SHALL present a light appearance when the operating system reports a light colour-scheme preference and a dark appearance when it reports a dark one. The greeting SHALL stay legible in both.

#### Scenario: System is set to dark

- **WHEN** the operating system colour-scheme preference is dark and the popup is opened
- **THEN** the popup renders its dark appearance with legible contrast between the greeting and its background

#### Scenario: System is set to light

- **WHEN** the operating system colour-scheme preference is light and the popup is opened
- **THEN** the popup renders its light appearance with legible contrast between the greeting and its background

### Requirement: Package carries all of its own code

The package SHALL contain every script and stylesheet it executes. It SHALL NOT load code from a remote origin at runtime, and it SHALL NOT require network access to render its surfaces.

#### Scenario: No remote code references in the package

- **WHEN** the built package's documents and manifest are inspected
- **THEN** every referenced script and stylesheet resolves to a file inside the package
- **AND** no script or stylesheet is referenced by a remote URL

#### Scenario: No network requests while the popup renders

- **WHEN** the popup is opened and finishes rendering
- **THEN** the extension has issued no outbound network request

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

### Requirement: The background answers every message

The background SHALL answer every message a surface sends with exactly one final response. A message it cannot trust SHALL be answered with a refusal that names which check it failed. A trusted request whose handling fails in a way its own feature does not answer for SHALL be answered with a failure that names the request. Neither answer SHALL be presented as the failure of any particular feature.

#### Scenario: A message that is not an envelope

- **WHEN** a surface sends a value that is not an RPC envelope
- **THEN** the background answers `rpc.refused` with the rejection `not-an-envelope`

#### Scenario: A message type no feature owns

- **WHEN** a surface sends an envelope whose type no feature declares
- **THEN** the background answers `rpc.refused` with the rejection `unknown-type`
- **AND** the reason names the type

#### Scenario: A payload its schema refuses

- **WHEN** a surface sends a known type with a payload its schema does not admit
- **THEN** the background answers `rpc.refused` with the rejection `invalid-payload`

#### Scenario: An unexpected failure while handling a trusted request

- **WHEN** handling a trusted request fails and its feature does not answer for that failure
- **THEN** the background answers `rpc.failed` naming the request type and the reason

#### Scenario: A surface shows a refusal

- **WHEN** the options surface receives `rpc.refused` or `rpc.failed`
- **THEN** it shows the reason as the surface's problem and stops reporting itself as busy
