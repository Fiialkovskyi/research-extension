# capture-denylist Specification

## Purpose

Keeps sensitive pages — banking, health, government, webmail and password managers — out of every
session's record, by a bundled, versioned list that capture consults before recording anything.

## Requirements

### Requirement: Sensitive pages are never recorded

A page whose host is on the capture denylist SHALL produce no node, and therefore no edge, title, focus, active dwell, revisit, scroll, copy count or snapshot. The extension SHALL NOT inject its page observer into such a page. WHEN a session tab navigates to such a page, the node the tab was showing SHALL be closed, as for any page that is not recorded.

#### Scenario: Visiting a bank from a session tab

- **GIVEN** a session tab shows `https://example.org/a`, recorded as node A
- **WHEN** the user follows a link in that tab to `https://www.chase.com/`
- **THEN** no node is recorded for the bank's page
- **AND** A is marked closed

#### Scenario: A webmail tab dragged into the group

- **WHEN** a tab showing `https://mail.google.com/mail/u/0/` joins the session's group
- **THEN** no node is recorded for it, and its page is not observed

#### Scenario: Leaving the sensitive page

- **GIVEN** a session tab moved from node A to a denylisted page
- **WHEN** the user follows a link from there to `https://example.org/b`
- **THEN** a node is recorded for B with no parent and no `sameTab` edge from A

### Requirement: The denylist is bundled and versioned

The denylist SHALL ship with the extension, SHALL carry a version that changes whenever its entries change, and SHALL cover at least banking and payments, health, government, webmail and password managers. It SHALL be read only from the package; the extension SHALL NOT fetch it.

#### Scenario: Every category is covered

- **WHEN** the bundled denylist is inspected
- **THEN** it has entries for banking and payments, health, government, webmail and password managers
- **AND** it names its version

### Requirement: A host matches by domain, suffix or word

A host SHALL be denylisted WHEN it equals a listed domain or is a subdomain of one, WHEN it falls under a listed suffix, or WHEN one of its labels contains a listed word. A listed domain ending in `.*` SHALL match its name under any top-level domain of one or two labels. Matching SHALL ignore case, the scheme, the port and a trailing dot.

#### Scenario: A subdomain of a listed domain

- **WHEN** capture checks `https://secure.chase.com/login`
- **THEN** the page is denylisted

#### Scenario: A government suffix

- **WHEN** capture checks `https://www.gov.uk/` and `https://www.irs.gov/`
- **THEN** both pages are denylisted

#### Scenario: A host word

- **WHEN** capture checks `https://online.examplebank.de/`
- **THEN** the page is denylisted

#### Scenario: A listed name under another country's domain

- **GIVEN** `hsbc.*` is listed
- **WHEN** capture checks `https://www.hsbc.co.uk/`
- **THEN** the page is denylisted

#### Scenario: A look-alike that is not a subdomain

- **GIVEN** `chase.com` is listed and no word matches
- **WHEN** capture checks `https://purchase.com/`
- **THEN** the page is not denylisted

#### Scenario: An ordinary research page

- **WHEN** capture checks `https://en.wikipedia.org/wiki/Electric_bicycle`
- **THEN** the page is not denylisted
