# Spec Delta

## MODIFIED Requirements

### Requirement: Scroll depth and copy events are recorded

For an observed page, the extension SHALL record the deepest scroll position reached, as the fraction of the page's height that has been in view, from 0 to 1, the number of copy events and the number of paste events. Only events the user made SHALL be counted. It SHALL NOT read the clipboard, the selected text, the field pasted into, or anything the user types.

#### Scenario: Scrolling down and back up

- **WHEN** the user scrolls a session page to 80% of its height and then back to the top
- **THEN** the page's node records a maximum scroll of 0.8

#### Scenario: Copying twice

- **WHEN** the user copies text from a session page twice
- **THEN** the page's node records 2 copy events
- **AND** the copied text appears nowhere in what the extension stored

#### Scenario: Pasting into a page

- **WHEN** the user pastes into a field of a session page
- **THEN** the page's node records 1 paste event
- **AND** the pasted text appears nowhere in what the extension stored

## ADDED Requirements

### Requirement: Reading, copies and pastes are logged with their times

Each interval of active reading the extension counts SHALL also be logged with its page, start and end; an interval starting within a second of the same page's last one SHALL extend it. Each copy and paste SHALL be logged with its page and the time its batch reached the background. The log SHALL hold times and pages only.

#### Scenario: Reading two pages in turn

- **WHEN** the user reads page A for 30 s and then page B for 30 s
- **THEN** the log holds an interval of 30 s on A followed by one of 30 s on B

#### Scenario: An interval left open by a previous run

- **WHEN** the browser restarts with an interval still open
- **THEN** that interval is neither counted nor logged
