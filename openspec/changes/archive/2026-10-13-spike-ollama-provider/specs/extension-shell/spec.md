# Spec Delta

## MODIFIED Requirements

### Requirement: Package bounds its outbound connections by policy

The package SHALL declare a content security policy for its own documents that permits WebAssembly compilation and allows outbound connections only to the extension itself, to the model-host origins the package enumerates, and to the loopback origin of the local inference server (`http://127.0.0.1:11434`). A connection to any other origin SHALL be blocked. The local inference server SHALL be reached only after the user grants its optional host permission from the options surface.

#### Scenario: Package declares the policy

- **WHEN** the built manifest is inspected
- **THEN** it declares a content security policy for the extension's own documents
- **AND** that policy enumerates the permitted connection origins

#### Scenario: A declared model host is reachable

- **WHEN** the extension connects to one of the enumerated model-host origins
- **THEN** the connection is permitted

#### Scenario: The local inference server is reachable only on loopback, once granted

- **GIVEN** the user granted access to the local inference server from the options surface
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
