# Proposal

## Why

Every fixture in `evals/fixtures/` is an electronics page in Ukrainian from one shop. The extension's claim that facts, columns and summaries work for any product in any language (`make-facts-domain-agnostic`) is therefore untested: the prompts and the tidying rules were tuned on exactly these five pages.

## What Changes

- **Fixtures outside electronics.** Pages of furniture from the same shop in two languages (English and Polish), saved with the capture command, each with hand-written labels. Two or three pages are enough to see whether anything is electronics-shaped in the prompts or the tidying.
- **A new baseline.** The committed baseline is recorded with `gemma4:12b` over the larger set, so later runs are compared with the recommended model instead of `qwen3:4b`.
- **A report of what held and what did not.** The numbers by fixture group (electronics, other), and a note of the defects that only show outside electronics. Fixing them is a separate change.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `prompt-evals`: the fixture set must cover more than one kind of product and more than one language.

## Impact

- New directories under `evals/fixtures/`, a rewritten `evals/baseline.json`, and labels written by hand. No change in `src/`.
- A fixture is a copy of a public page, kept to measure with, not to redistribute.
- A baseline of one run of one model; it moves from run to run.
