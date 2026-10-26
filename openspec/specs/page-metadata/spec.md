# page-metadata Specification

## Purpose

Defines what a page says about itself in its head, how the extension reads and stores it for pages in a research session, how it can label a page, and how it stands in for the page's text until the page is read deeply.

## Requirements

### Requirement: A session page's metadata is read and stored at once

WHEN a page in a research session loads, the extension SHALL read the page's title, its `description`, its `og:title`, `og:description`, `og:type` and `og:site_name`, its canonical link, its `article:published_time` and its author, each cut to a fixed length, and SHALL store them for the page's node without waiting for the page to be read deeply. It SHALL read no other tag, SHALL NOT read `og:image`, and SHALL read nothing on a page outside a session or on a denylisted site.

#### Scenario: A page is opened in a session

- **GIVEN** a session is active
- **WHEN** a page with a description and an `og:title` loads in a tab of the session
- **THEN** the page's node has stored metadata containing that description and title

#### Scenario: A tab outside a session

- **WHEN** a page loads in a tab that is not in any session's group
- **THEN** no metadata is read or stored

#### Scenario: A denylisted site

- **GIVEN** the page's host is on the denylist
- **WHEN** the page loads in a session tab
- **THEN** no metadata is read or stored

#### Scenario: A page with no metadata

- **WHEN** a page has none of the tags and an empty title
- **THEN** nothing is stored for it

#### Scenario: Overlong or malformed values

- **WHEN** a page's description is longer than the limit or its canonical link is not an `http` or `https` address
- **THEN** the description is stored cut to the limit and the canonical link is not stored

#### Scenario: The page has left

- **GIVEN** a tab has navigated on after a page sent its metadata
- **WHEN** the background receives the metadata
- **THEN** nothing is stored for the new page

### Requirement: A page's description is encrypted at rest

The extension SHALL store a page's description only encrypted with the extension's data key, under the same protection as a snapshot's text, and SHALL NOT store it in the clear anywhere.

#### Scenario: The stored record is read

- **GIVEN** a page's metadata was stored
- **WHEN** the stored record is read directly
- **THEN** it holds a cipher, a key id, an IV and ciphertext for the description, and no plaintext description

### Requirement: Metadata fills a missing node title

WHEN a node's tab title is blank or is only the page's address, the extension SHALL give the node the page's metadata title instead. It SHALL NOT replace a tab title that is neither, and a title the tab reports later SHALL replace the fallback.

#### Scenario: A page with a blank tab title

- **GIVEN** a page whose tab title is the page's address
- **WHEN** its metadata, with an `og:title`, is stored
- **THEN** the node's title is that `og:title`

#### Scenario: A page with a good tab title

- **GIVEN** a page whose tab title is a real title
- **WHEN** its metadata is stored
- **THEN** the node's title is unchanged

### Requirement: Metadata stands in for text until a page is read deeply

WHEN a node has metadata but no snapshot, and an embedding model is active, the extension SHALL embed the node's title and description into the active embedding space as a weak vector of that node. WHEN the node has a vector from its text, clustering SHALL ignore the node's metadata vector. A page whose metadata and space were already embedded SHALL NOT be embedded again.

#### Scenario: An unread page is placed

- **GIVEN** an embedding model is active and a page has metadata and no snapshot
- **WHEN** the embedding jobs run
- **THEN** the page has one vector in the active space and takes part in clustering

#### Scenario: The page is read deeply later

- **GIVEN** a page with a metadata vector
- **WHEN** its text is stored and embedded
- **THEN** clustering places the page by its text vectors only

#### Scenario: Metadata embedded twice

- **GIVEN** a page's metadata was already embedded in the active space
- **WHEN** the embedding jobs are queued again
- **THEN** no second job is queued for it

#### Scenario: No embedding model

- **GIVEN** no embedding model is active
- **WHEN** a page's metadata is stored
- **THEN** the metadata is kept and no embedding job fails

### Requirement: Metadata is deleted with its page

WHEN a page or a session is deleted, the extension SHALL delete the page's or the session's metadata and metadata vectors with it.

#### Scenario: Deleting a page

- **GIVEN** a page with metadata and a metadata vector
- **WHEN** the user deletes the page
- **THEN** neither remains

#### Scenario: Deleting a session

- **GIVEN** a session whose pages have metadata
- **WHEN** the user deletes the session
- **THEN** none of the session's metadata remains
