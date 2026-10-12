# Spec Delta

## ADDED Requirements

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

The extension SHALL declare an options surface, reachable through the browser's add-on manager, where the user installs, inspects and activates models. It SHALL be a view over background state and SHALL NOT be the authority for what is installed.

#### Scenario: Package declares the options surface

- **WHEN** the built manifest is inspected
- **THEN** it declares an options document
- **AND** that document is present in the package at the declared path

#### Scenario: User reaches the surface from the add-on manager

- **WHEN** the user opens the extension's preferences from the browser's add-on manager
- **THEN** the options surface opens and shows the current model state

#### Scenario: Options surface follows the system colour scheme

- **WHEN** the operating system colour-scheme preference changes between light and dark
- **THEN** the options surface presents the matching appearance with legible contrast

### Requirement: Package bounds its outbound connections by policy

The package SHALL declare a content security policy for its own documents that permits WebAssembly compilation and allows outbound connections only to the extension itself and to the model-host origins the package enumerates. A connection to any other origin SHALL be blocked.

#### Scenario: Package declares the policy

- **WHEN** the built manifest is inspected
- **THEN** it declares a content security policy for the extension's own documents
- **AND** that policy enumerates the permitted connection origins

#### Scenario: A declared model host is reachable

- **WHEN** the extension connects to one of the enumerated model-host origins
- **THEN** the connection is permitted

#### Scenario: An undeclared origin is blocked

- **WHEN** the extension attempts a connection to an origin the policy does not enumerate
- **THEN** the connection is blocked
- **AND** the blocked origin is observable for diagnosis

#### Scenario: WebAssembly compiles under the policy

- **WHEN** packaged code compiles a WebAssembly module
- **THEN** compilation succeeds under the declared policy

## MODIFIED Requirements

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
