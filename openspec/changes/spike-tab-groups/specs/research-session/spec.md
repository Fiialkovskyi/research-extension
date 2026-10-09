# Spec Delta

## Purpose

Defines how a research session is started and which tabs belong to it. A session is a Firefox tab group, so its tabs are the group's tabs and its name is the group's title.

## ADDED Requirements

### Requirement: User starts a session as a named tab group

The popup SHALL let the user enter a title and submit it. On submit, the extension SHALL create one new tab group with that title in the current window, holding exactly one new tab that shows the browser's new-tab page, and SHALL move focus to that tab. The extension SHALL NOT choose the group's colour; it SHALL use the colour the browser assigns.

#### Scenario: User submits a title

- **WHEN** the user enters `E-bike motors` in the popup and submits it
- **THEN** the current window contains a new tab group titled `E-bike motors`
- **AND** that group holds exactly one tab, which shows the new-tab page and has focus
- **AND** the group has one of the browser's tab group colours

#### Scenario: Title is blank

- **WHEN** the popup's title input is empty or contains only whitespace
- **THEN** the user cannot submit it
- **AND** no tab or tab group is created

#### Scenario: Surrounding whitespace is dropped

- **WHEN** the user submits `  E-bike motors  `
- **THEN** the new group's title is `E-bike motors`

### Requirement: A failed start leaves nothing behind

IF creating the group or setting its title fails, THEN the extension SHALL close the tab it opened for that attempt and SHALL report the failure to the popup when the popup is still open.

#### Scenario: Grouping the new tab fails

- **WHEN** the browser refuses to put the new tab into a group
- **THEN** that tab is closed
- **AND** no new group remains in the window
- **AND** if the popup is still open, it shows the reason
