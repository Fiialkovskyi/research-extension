# Spec Delta

## ADDED Requirements

### Requirement: Extension pages pass an accessibility audit

The end-to-end suite SHALL audit every extension page — the popup, options, Synthesis, "What was recorded" and map pages — with axe against WCAG 2.0 and 2.1 levels A and AA, in the browser the extension ships to and with a session holding a recorded page, and SHALL fail on any violation. The audit SHALL show that it reports a violation planted in a page.

#### Scenario: Every page is clean

- **WHEN** the suite audits each extension page
- **THEN** no page has a violation, and each page rendered its content

#### Scenario: The audit sees a violation

- **WHEN** an image without alternative text is added to a page before its audit
- **THEN** the audit reports `image-alt`
