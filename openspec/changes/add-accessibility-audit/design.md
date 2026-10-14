# Design

## Decisions

### 1. In the real browser, not jsdom

jsdom computes no layout and no colours, so axe's contrast rules cannot run there. The suite
already drives the packaged build in Firefox, so the audit runs there:

- each page is loaded by its `moz-extension:` URL in the content context;
- the audit waits for `readyState`, then 1.5 s for the page to render what it asked the background
  for.

### 2. Loading axe despite the page's policy

Extension pages forbid `eval`, so axe cannot be injected as a string the page evaluates. Instead
its bundle and the call to `axe.run` go to WebDriver as one function body, which the browser
compiles itself, outside the page's policy.

### 3. Controls against a vacuous pass

- **A planted violation.** An `<img>` without `alt` is added to the options page, and the audit
  must report `image-alt`.
- **Rendered content.** After each page's audit, its body must hold text, so a page that failed to
  render cannot pass by being empty.

## Risks / Trade-offs

- **[Only what axe can see]** Automated rules catch roughly a third of WCAG issues. → Keyboard and
  screen-reader walkthroughs stay a manual check, listed in the tasks.
- **[One theme]** Headless Firefox renders the light theme. → The dark theme is part of the manual
  check.
