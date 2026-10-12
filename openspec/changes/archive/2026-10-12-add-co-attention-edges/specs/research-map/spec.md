# Spec Delta

## ADDED Requirements

### Requirement: Co-attention is drawn as a lateral link

The map SHALL draw a `coAttention` edge without an arrowhead and with a dash pattern unlike the opener, same-tab and refinement edges, so its kind is not carried by colour alone. A `coAttention` edge SHALL NOT affect which page is placed below which.

#### Scenario: Two pages compared

- **GIVEN** pages A and B, opened from the same search, joined by a `coAttention` edge
- **WHEN** the user opens the map
- **THEN** the edge between A and B has no arrowhead and is drawn unlike the other kinds
- **AND** A and B are placed as they would be without it, both below the search
