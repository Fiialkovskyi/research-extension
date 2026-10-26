# Spec Delta

## Purpose

Defines how the extension decides which research session its surfaces refer to while several sessions exist, so that choosing what to look at is separate from what is being recorded.

## ADDED Requirements

### Requirement: One session is viewed at a time

The extension SHALL keep one viewed session: the session the popup, and any page opened from the popup, refer to. Choosing a viewed session SHALL NOT start, resume, close or end any session, and SHALL NOT change which tabs are recorded. Every live session SHALL keep being recorded whether or not it is viewed.

#### Scenario: Choosing another live session

- **GIVEN** the live sessions `E-bike motors` and `Batteries`, with `E-bike motors` viewed
- **WHEN** the user chooses `Batteries` in the popup's session select
- **THEN** the popup shows `Batteries` and its page count
- **AND** `E-bike motors` is still active and still records the pages read in its group

### Requirement: The choice outlives the popup

The extension SHALL remember the viewed session in the background, so that it is the same when the popup is opened again, and when the browser has been restarted and the session restored. WHEN nothing has been chosen, or the chosen session no longer exists, the viewed session SHALL be the live session whose group holds the selected tab, or else the live session most recently recorded to, or else none.

#### Scenario: Popup closed and opened again

- **GIVEN** the user chose `Batteries` as the viewed session
- **WHEN** the popup is closed and opened again
- **THEN** it shows `Batteries`

#### Scenario: Nothing chosen

- **GIVEN** two live sessions and no remembered choice
- **WHEN** the user opens the popup with a tab of `E-bike motors` selected
- **THEN** the popup shows `E-bike motors`

#### Scenario: The viewed session is deleted

- **GIVEN** `Batteries` is the viewed session
- **WHEN** the user deletes `Batteries`
- **THEN** the viewed session falls back to another live session, or none when there is none

### Requirement: A starting or resumed session becomes the viewed one

WHEN the user starts a session or resumes a saved one, the extension SHALL make it the viewed session.

#### Scenario: Starting a second session

- **GIVEN** `E-bike motors` is active and viewed
- **WHEN** the user starts `Batteries`
- **THEN** both sessions are active
- **AND** `Batteries` is the viewed session

### Requirement: A page is pinned to the session it was opened for

WHEN the popup opens the map, "What was recorded" or the summaries, the page SHALL be opened for the viewed session at that moment and SHALL say which session it shows, by title. The page SHALL keep showing that session when the viewed session changes later. Opening the same page again for the same session SHALL select its open tab, and opening it for another session SHALL open a second tab. A page opened without a session SHALL show the viewed session and follow it.

#### Scenario: Two maps side by side

- **GIVEN** the map is open for `E-bike motors`
- **WHEN** the user views `Batteries` and chooses to open the map
- **THEN** a second map tab opens, titled for `Batteries`
- **AND** the first map still shows `E-bike motors`

#### Scenario: The same map twice

- **GIVEN** the map is open for `E-bike motors` and not selected
- **WHEN** the user views `E-bike motors` and chooses to open the map
- **THEN** that tab is selected and no new tab opens
