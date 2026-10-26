# page-source-details Specification

## Purpose

Defines how the sources of the comparison table and of the cluster summaries name the site and the date of the pages they come from, and how a conflict points at its newest dated source, using what each page said about itself.

## Requirements

### Requirement: A source names its page's site and date

WHEN a source of a comparison cell or a citation of a cluster summary comes from a page whose metadata gives a site name or a publication date, the extension SHALL show them beside the source. A page with neither SHALL show its source as before. The publication date SHALL be shown only when it parses to a plausible date and SHALL be shown as a calendar date.

#### Scenario: A table source with a site and a date

- **GIVEN** a fact whose page says its site is `Bike Lab` and its publication time is `2026-05-01T08:00:00Z`
- **WHEN** the comparison table is read
- **THEN** that fact's source shows `Bike Lab` and `2026-05-01`

#### Scenario: A summary citation with a site

- **GIVEN** a statement citing a fact whose page names its site `Bike Lab` and gives no date
- **WHEN** the Summaries page is read
- **THEN** the citation shows `Bike Lab` and no date

#### Scenario: A page without metadata

- **GIVEN** a fact whose page has no stored metadata
- **WHEN** the table or the summaries are read
- **THEN** its source shows its title and link only

#### Scenario: An implausible date

- **GIVEN** a page whose publication time does not parse, or is in the future, or is before 1990
- **WHEN** its source is shown
- **THEN** no date is shown for it

### Requirement: A conflict points at its newest dated source

WHEN the values of a comparison cell conflict and at least two of the value groups have a dated source, the extension SHALL mark the group whose newest source is strictly later than every other group's as coming from the newest source. It SHALL mark none when only one group has a dated source or the newest dates tie. Marking SHALL NOT change the cell's chosen value, the order of its groups, its alternative count or its conflict flag.

#### Scenario: A newer source disagrees

- **GIVEN** a cell whose two values come from a source dated `2026-05-01` and a source dated `2025-01-10`
- **WHEN** the table is read
- **THEN** the group from the `2026-05-01` source is marked newest, and the cell's chosen value is the one it was before

#### Scenario: Only one source is dated

- **GIVEN** a conflicting cell where only one value has a dated source
- **WHEN** the table is read
- **THEN** no group is marked

#### Scenario: Dates tie

- **GIVEN** a conflicting cell whose newest sources of two values share a date
- **WHEN** the table is read
- **THEN** no group is marked

### Requirement: The CSV carries the source details

The exported comparison CSV SHALL follow each source URL in a cell's sources column with its site and date in brackets when known, and SHALL list a source without them as its bare URL.

#### Scenario: Exporting a cell with a dated source

- **GIVEN** a cell with a source at `https://example.org/a` from `Bike Lab` dated `2026-05-01`
- **WHEN** the table is exported
- **THEN** its sources column holds `https://example.org/a [Bike Lab, 2026-05-01]`

### Requirement: Source details change nothing that was written

Showing source details SHALL NOT change the facts a model is given, the prompt it is given, a fact set's hash, whether a summary is stale, or any statement's citations.

#### Scenario: Metadata arrives after a summary

- **GIVEN** a summary written for a cluster whose pages had no metadata
- **WHEN** their metadata is stored
- **THEN** the summary is not stale, and its citations show the site and date on the next read
