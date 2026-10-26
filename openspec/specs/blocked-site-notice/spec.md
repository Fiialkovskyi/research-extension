# blocked-site-notice Specification

## Purpose

Defines the short notice drawn on a page from a denylisted site, in a tab of a research session, saying the site is not tracked, and what the extension keeps about such a visit: nothing.

## Requirements

### Requirement: A denylisted page says it is not tracked

WHEN a tab of an active session loads, in its top frame, a web page on a denylisted site — the bundled denylist or the user's own — and the notice is turned on, the extension SHALL show a notice in the top-right corner of that page saying that the site is not tracked and naming the session. It SHALL show no notice for a tab outside every session, in a private window, for a page that is not an `http` or `https` page, for a page that is not on the denylist, while the notice is turned off, or for a site already shown for the session.

#### Scenario: A bank in a session tab

- **GIVEN** a session is active, the notice is on, and `chase.com` is on the denylist
- **WHEN** a tab of the session's group loads a page on `chase.com`
- **THEN** a notice says the site is not tracked and names the session

#### Scenario: A site the user added

- **GIVEN** the user added `example.org` to their blocked sites
- **WHEN** a tab of the session loads a page there
- **THEN** the notice is shown

#### Scenario: Once per site per session

- **GIVEN** the notice was shown for `chase.com` in a session
- **WHEN** another page on `chase.com` loads in that session's tab
- **THEN** no notice is shown

#### Scenario: A tab outside a session

- **GIVEN** no session covers the tab
- **WHEN** it loads a page on `chase.com`
- **THEN** no notice is shown and no script is injected

#### Scenario: Not a web page

- **WHEN** a session tab shows `about:preferences` or an extension page
- **THEN** no notice is shown

#### Scenario: The notice is off

- **GIVEN** the user turned the notice off
- **WHEN** a session tab loads a page on `chase.com`
- **THEN** no notice is shown and no script is injected

### Requirement: A denylisted page leaves no trace

The notice SHALL NOT make the extension record anything about the page or the visit: no node, signal, text, metadata, title, address or host SHALL be stored, and "already shown" SHALL be kept in memory only. The script that draws the notice SHALL read nothing from the page and SHALL send nothing to the background.

#### Scenario: After the notice was shown

- **GIVEN** the notice was shown on a denylisted page
- **WHEN** the research database is read
- **THEN** it holds no node, signal, snapshot or metadata for that page, and no record naming its host

#### Scenario: The page tries to read the notice

- **GIVEN** the notice is showing
- **WHEN** a script of the page looks for it
- **THEN** it cannot read its content

### Requirement: The same switch turns it off

The option that turns off the notice for an added page SHALL also turn off this notice, and its label SHALL say it covers both.

#### Scenario: Turning it off

- **WHEN** the user turns the option off and a session tab loads a denylisted page
- **THEN** no notice is shown
