# Code Guide

The detailed code and style guide for the Research Graph extension. `AGENTS.md` is the short
version that agents and reviewers read first; this guide is the long one, with the reasoning, the
edge cases and real examples from the repository.

When the two disagree, this guide wins and `AGENTS.md` is corrected to match.

## Sections

Read in order. Each section assumes the ones before it.

| #   | Section                                                   | Covers                                                                                              |
| --- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| 1   | [Project structure](./PROJECT_STRUCTURE.md)               | Layers, import direction, module anatomy, `utils/`, `constants.ts`, `types.ts`, e2e layout          |
| 2   | [Naming](./NAMING.md)                                     | Verb dictionary, booleans, constants, schemas, types, components, message strings, abbreviations    |
| 3   | [TypeScript and functions](./TYPESCRIPT_AND_FUNCTIONS.md) | Arrow functions, signatures, bodies, types, casts, `null`, imports, classes, comments               |
| 4   | [React and UI](./REACT_AND_UI.md)                         | Who renders what, components, props, reducer state, effects, JSX, Tailwind, accessibility, test ids |
| 5   | [Messaging between contexts](./MESSAGING.md)              | Contexts and channels, the RPC envelope, message ownership, receiving, failing, background, worker  |
| 6   | [Storage](./STORAGE.md)                                   | One writer, stored shapes, transactions, forward-only migrations, what is never stored              |
| 7   | [Model pipeline](./MODEL_PIPELINE.md)                     | The seven steps, the two invariants, profiles, conformance, adding a model or a family              |
| 8   | [Errors and validation](./ERRORS_AND_VALIDATION.md)       | Trust boundaries, valibot, throwing, error messages, catching, logging                              |
| 9   | [Testing](./TESTING.md)                                   | Unit and e2e layers, what gets a spec, names, doubles, components, storage, offline runs            |
| 10  | [Security and network policy](./SECURITY.md)              | No remote code, no egress, no collection, permissions, dependencies, changes needing a spec         |
| 11  | [Tooling and workflow](./TOOLING_AND_WORKFLOW.md)         | Commands, oxfmt, oxlint, build, OpenSpec flow, commits, pull requests                               |

## How the guide treats existing code

Much of the code predates some of these rules. Each section ends with a **Known deviations** list:
the places that break a rule today. They are fixed when the file is next touched for another reason,
not in a sweep — a sweep would bury whatever change it travelled with. A deviation is not evidence
that the rule was dropped; the list is.

When you fix one, delete its line from the list in the same change.
