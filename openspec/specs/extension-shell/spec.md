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

The package SHALL contain every script, stylesheet and WebAssembly binary it executes. It SHALL NOT load or compile code fetched from a remote origin at runtime, and no surface SHALL require network access to render. Model weights are data rather than code: they MAY be fetched after an explicit user action, and SHALL be verified before use.

#### Scenario: No remote code references in the package

- **WHEN** the built package's documents and manifest are inspected
- **THEN** every referenced script, stylesheet and WebAssembly binary resolves to a file inside the package
- **AND** no executable resource is referenced by a remote URL

#### Scenario: No network requests while the popup renders

- **WHEN** the popup is opened and finishes rendering
- **THEN** the extension has issued no outbound network request

#### Scenario: Fetched model files are data, not code

- **WHEN** a model has been installed
- **THEN** its downloaded files are consumed as data by code that shipped in the package
- **AND** no downloaded file is executed as a script

### Requirement: Package declares only the browser permissions its surfaces use

The manifest SHALL declare the `tabGroups` permission, which starting a session as a tab group needs; the `sessions` permission, which keeping a session's id on its tabs across closing and restoring needs; the `tabs` and `webNavigation` permissions, which capturing the session's pages needs: `tabs` to read a tab's URL and title, `webNavigation` to read how a page was reached; the `scripting` permission, which observing a session page needs; the `idle` permission, which measuring active reading time needs; the `alarms` permission, which waking the background for queued jobs needs; and the `notifications` permission, which telling the user once after install that AI needs setting up needs. Where the extension rewrites the origin of its own requests to the local inference server, it SHALL also declare the one permission that rewrite needs. It SHALL declare no other API permission. Access to page contents (`<all_urls>`) SHALL be declared as an optional host permission, requested only when a session starts or from the popup, and never granted at install. The local inference server's loopback origin SHALL be the only required host permission. Adding a permission SHALL NOT add any outbound connection beyond those the content security policy already allows.

#### Scenario: Built manifest declares the tab groups permission

- **WHEN** the built manifest is inspected
- **THEN** its `permissions` are exactly `tabGroups`, `sessions`, `tabs`, `webNavigation`, `scripting`, `idle`, `alarms` and `notifications`, plus the origin-rewrite permission where one is used

#### Scenario: Page access is optional

- **WHEN** the built manifest is inspected
- **THEN** its optional host permissions are exactly `<all_urls>`
- **AND** `<all_urls>` is not among its required host permissions

#### Scenario: Only loopback is a required host

- **WHEN** the built manifest is inspected
- **THEN** its required host permissions are exactly `http://127.0.0.1:11434/*`

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

### Requirement: Background event page coordinates the extension

The extension SHALL run a background event page that owns the inference worker and is the only writer of the add-on's local storage. It SHALL register its event listeners at startup rather than in response to later activity, and SHALL rebuild in-memory state from storage after it has been unloaded.

#### Scenario: Package declares a background event page

- **WHEN** the built manifest is inspected
- **THEN** it declares a background context backed by scripts rather than a service worker

#### Scenario: Surfaces do not write storage directly

- **WHEN** a surface needs to record a change
- **THEN** it asks the background to perform the write
- **AND** the surface itself performs no write to the add-on's local storage

#### Scenario: State survives a background unload

- **WHEN** the background is unloaded and later woken
- **THEN** the previously recorded state is still readable
- **AND** no recorded data is lost

### Requirement: Options surface manages models

The extension SHALL declare an options surface, reachable through the browser's add-on manager, that shows whether AI is set up, which models are active, and an action that opens the setup page. Other models, measurements and developer tools SHALL sit in a section that is closed by default. It SHALL be a view over background state and SHALL NOT be the authority for what is installed.

#### Scenario: Package declares the options surface

- **WHEN** the built manifest is inspected
- **THEN** it declares an options document
- **AND** that document is present in the package at the declared path

#### Scenario: User reaches the surface from the add-on manager

- **WHEN** the user opens the extension's preferences from the browser's add-on manager
- **THEN** the options surface opens and shows whether AI is set up and which models are active

#### Scenario: Advanced tools are out of the way

- **WHEN** the options surface opens
- **THEN** the section holding other models, measurements and developer tools is closed

#### Scenario: Setup is one click away

- **GIVEN** AI is not set up
- **WHEN** the user clicks the options surface's setup action
- **THEN** the setup page opens

#### Scenario: Options surface follows the system colour scheme

- **WHEN** the operating system colour-scheme preference changes between light and dark
- **THEN** the options surface presents the matching appearance with legible contrast

### Requirement: Package bounds its outbound connections by policy

The package SHALL declare a content security policy for its own documents that permits WebAssembly compilation and allows outbound connections only to the extension itself and to the loopback origin of the local inference server (`http://127.0.0.1:11434`), plus, only while the in-extension backend is switched on, the model-host origins the package enumerates. A connection to any other origin SHALL be blocked. The local inference server SHALL be reached only after the user started setup.

#### Scenario: Package declares the policy

- **WHEN** the built manifest is inspected
- **THEN** it declares a content security policy for the extension's own documents
- **AND** that policy enumerates the permitted connection origins

#### Scenario: A declared model host is reachable

- **GIVEN** the in-extension backend is switched on
- **WHEN** the extension connects to one of the enumerated model-host origins
- **THEN** the connection is permitted

#### Scenario: Model hosts are not admitted while the in-extension backend is off

- **GIVEN** the in-extension backend is switched off
- **WHEN** the built manifest is inspected
- **THEN** neither its host permissions nor its connection policy name a model-host origin

#### Scenario: The local inference server is reachable only on loopback, once granted

- **GIVEN** the user started setup
- **WHEN** the extension connects to `http://127.0.0.1:11434`
- **THEN** the connection is permitted
- **AND** no origin other than that loopback address is added for it

#### Scenario: An undeclared origin is blocked

- **WHEN** the extension attempts a connection to an origin the policy does not enumerate
- **THEN** the connection is blocked
- **AND** the blocked origin is observable for diagnosis

#### Scenario: WebAssembly compiles under the policy

- **WHEN** packaged code compiles a WebAssembly module
- **THEN** compilation succeeds under the declared policy

### Requirement: Package declares the setup page

The package SHALL contain a setup page, opened in a tab by the install notification, the popup's
banner and the options surface. It SHALL follow the system colour scheme like the other surfaces.

#### Scenario: Setup page is in the package

- **WHEN** the built package is inspected
- **THEN** it contains the setup page's document
