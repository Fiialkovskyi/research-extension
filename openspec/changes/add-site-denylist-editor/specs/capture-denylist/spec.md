# Spec Delta

## ADDED Requirements

### Requirement: The user can add sites to the denylist

The options page SHALL let the user add a site to the denylist, by its host or by any URL on it, and remove a site they added. A user-added site SHALL be denylisted with its subdomains, as a listed domain of the bundled list is, and SHALL NOT match a host that merely ends in the same letters. The user's sites SHALL be stored only locally and encrypted at rest. Entries of the bundled list SHALL NOT be removable.

#### Scenario: Adding a site by URL

- **WHEN** the user adds `https://portal.myclinic.example/appointments?id=4`
- **THEN** the list shows `portal.myclinic.example`

#### Scenario: Visiting an added site from a session tab

- **GIVEN** the user added `myclinic.example`
- **WHEN** a session tab navigates to `https://portal.myclinic.example/`
- **THEN** no node is recorded for the page, and the page is not observed

#### Scenario: A look-alike of an added site

- **GIVEN** the user added `myclinic.example`
- **WHEN** a session tab navigates to `https://notmyclinic.example/`
- **THEN** a node is recorded

#### Scenario: Something that is not a site

- **WHEN** the user tries to add `not a site`
- **THEN** nothing is added and the card says why

#### Scenario: Removing an added site

- **GIVEN** the user added `myclinic.example`
- **WHEN** the user removes it
- **THEN** its pages are recorded again from then on
