# Tasks

## 1. Fixtures

- [x] 1.1 Capture three IKEA product pages (BILLY in English and in Polish, and KALLAX in English; two first guesses turned out to be category pages and were dropped) with `npm run eval:capture`, and confirm each keeps its product text after the extension's readable-text step.
- [x] 1.2 Write each fixture's `labels.json` by hand from the page; add the `sameConcept` and `differentConcept` pairs the page supports.

## 2. Measurement

- [x] 2.1 Run `npm run eval` with `gemma4:12b` and read the per-fixture report; note what fails only outside electronics.
- [x] 2.2 Record the baseline with `npm run eval:baseline` and keep the notes in the design's Open Questions or a follow-up change.

## 3. Verification

- [x] 3.1 Run `openspec validate broaden-eval-fixtures`, then `npm run verify`, and report the numbers faithfully as one run of one model.
