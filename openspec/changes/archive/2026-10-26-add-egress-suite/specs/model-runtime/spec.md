# Spec Delta

## ADDED Requirements

### Requirement: Page access does not connect the local inference server

The local inference server SHALL count as connected only when its own origin is among the granted host permissions. A broader grant that also covers loopback, such as page access (`<all_urls>`), SHALL NOT count, and while the server is not connected the extension SHALL send it nothing.

#### Scenario: Page access allowed, Ollama never connected

- **GIVEN** the user allowed page access and never chose "Connect" for local AI
- **WHEN** the options page opens and a session runs
- **THEN** the extension sends no request to `http://127.0.0.1:11434`

#### Scenario: Ollama connected

- **WHEN** the user grants the local server's origin from the options page
- **THEN** the extension may ask the server for its status
