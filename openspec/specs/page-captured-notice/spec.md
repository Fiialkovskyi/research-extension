# page-captured-notice Specification

## Purpose

Defines the short notice drawn on a page when the page was taken into a research session, so the user can see what is being recorded without opening the popup.

## Requirements

### Requirement: A newly recorded page shows a notice

WHEN the extension has extracted and stored the text of a page in a session and the notice is turned on, it SHALL show a notice in the top-right corner of that page saying that the page was added to research and naming the session. It SHALL show no notice for a page it has only visited, for a page whose text it already holds, for a page the tab has left, for a tab outside every session, or while the notice is turned off.

#### Scenario: A page is read in a session

- **GIVEN** the session `E-bike motors` is active and the notice is on
- **WHEN** the text of a page in the session's group is extracted and stored
- **THEN** the page shows a notice in its top-right corner that names `E-bike motors`

#### Scenario: A page is only visited

- **GIVEN** a page recorded in the session but not yet read deeply
- **WHEN** the user stays on it without its text being taken
- **THEN** no notice is shown

#### Scenario: A recorded page is reloaded

- **GIVEN** a page whose text the session already holds
- **WHEN** the user reloads it and no text is taken again
- **THEN** no notice is shown

#### Scenario: A tab outside a session

- **WHEN** the user reads a page in a tab that is not in any session's group
- **THEN** no notice is shown

#### Scenario: The notice is off

- **GIVEN** the user turned the notice off in the options
- **WHEN** the text of a page in a session is stored
- **THEN** no notice is shown

### Requirement: The notice stays out of the way

The notice SHALL NOT take keyboard focus, SHALL NOT receive or block pointer events, and SHALL disappear by itself within about four seconds. A newer notice SHALL replace one still showing. It SHALL be announced politely to assistive technology, SHALL follow the page's colour scheme preference with sufficient contrast, and SHALL appear and disappear without animation when the user prefers reduced motion.

#### Scenario: A click under the notice

- **GIVEN** a notice is showing over a link
- **WHEN** the user clicks where the notice is
- **THEN** the click reaches the page's own element

#### Scenario: Two pages in a row

- **GIVEN** a notice is showing
- **WHEN** another page is recorded in the same tab
- **THEN** one notice is showing, for the newer page

#### Scenario: Reduced motion

- **GIVEN** the user prefers reduced motion
- **WHEN** a notice appears
- **THEN** it appears and disappears without a fade

### Requirement: The page cannot read or restyle the notice

The notice SHALL be drawn inside a closed shadow root, so the page's scripts cannot read the session's title from it and its styles cannot change it, and SHALL carry no data the page could use beyond its presence.

#### Scenario: A page script inspects the notice

- **GIVEN** a notice is showing
- **WHEN** a script of the page looks for the notice's content
- **THEN** it can find the host element but not its text or its styles

### Requirement: The user can turn the notice off

The options page SHALL offer a setting that turns the notice off, on by default, written through the background and applying to every later page without a reload.

#### Scenario: Turning it off

- **GIVEN** the notice is on
- **WHEN** the user turns it off in the options
- **THEN** the next page whose text is stored in a session shows no notice

#### Scenario: A fresh install

- **WHEN** the extension has just been installed
- **THEN** the notice is on
