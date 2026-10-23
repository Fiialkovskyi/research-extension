# Spec Delta

## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: Package declares the setup page

The package SHALL contain a setup page, opened in a tab by the install notification, the popup's
banner and the options surface. It SHALL follow the system colour scheme like the other surfaces.

#### Scenario: Setup page is in the package

- **WHEN** the built package is inspected
- **THEN** it contains the setup page's document
