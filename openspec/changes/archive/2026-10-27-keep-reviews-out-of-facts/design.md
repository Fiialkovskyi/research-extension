## Context

`broaden-eval-fixtures` measured `gemma4:12b` on three IKEA pages next to the five electronics pages. Findings: review text is most of what a shop page yields as readable text; the extractor makes opinions of it; the facts the page states in its title and data never get extracted. The electronics fixtures have no reviews, which is why the prompt had no rule for them.

## Goals / Non-Goals

**Goals:** no opinion facts; the title's and the data's facts present; electronics unchanged; measured on the same eight fixtures.

**Non-Goals:** a per-language list of evaluation words; changing the readable-text step (decision 3); the clustering of the Polish page (decision 5).

## Decisions

1. **A rule in the prompt first** (`factExtraction@5`): opinions, feelings, evaluations and what a reviewer did are not facts; a value is never an evaluation word. Measured by the share of review-shaped facts on the IKEA cards and by the electronics numbers staying put.
2. **Code only where it needs no vocabulary.** A value that equals the attribute or the concept is already dropped by `tidyFacts`; this change adds a drop of a fact whose quote is a review sentence only if the prompt rule leaves such facts and a check can be made without word lists (for instance a fact with no digit and a value of one word that the page's own text says of "it", which is a judgement call). The plan is to measure after the prompt rule and add code only for what remains, not to guess a list now.
3. **Reviews stay in the readable text.** Cutting them would also cut real user statements on forum or article pages, and the extractor of the readable text has no notion of a review that holds across sites. If the prompt rule is not enough, the next step is a change of its own, not this one.
4. **More from the page's own data.** `buildProductFacts` adds `rating count` from `ratingCount`, certain and free of model variance. A size or colour the name states is reached by letting the quote check also look in the product name and title (the page's context): a fact quoted from there is grounded and its quote is marked, as the data facts are marked now. The risk is a fact the model hallucinates and "quotes" from the title; a title is short, so the quote must still be exact.
5. **The Polish BILLY card** was investigated first: nothing was lost or merged wrongly. The summary builds at most six product cards (`MAXIMUM_PRODUCT_CARDS`), largest first, and the Polish page, with the fewest facts, came seventh. Nothing to fix.
6. **The concept is `review count`, not `rating count`.** The first run named it `rating count`; by its embedding it scored 0.911 against `rating`, above the 0.9 threshold, so the two shared a column and "concepts that must stay apart" fell from 100% to 70%. `review count` scores 0.77.
7. **A measurement named as its own attribute is kept.** The model wrote `80x28x202 cm` as both attribute and value; `tidyFacts` now keeps such a fact, under the concept, when its value has a digit or is one word, instead of dropping the multi-word ones.

## Results

Same eight fixtures, `gemma4:12b`, one run each (before: the baseline of `broaden-eval-fixtures`).

|                                        | before | after                      |
| -------------------------------------- | ------ | -------------------------- |
| Labelled facts found                   | 82.5%  | 100%                       |
| Quote on the page                      | 99.2%  | 100%                       |
| Dropped as junk                        | 3.1%   | 1.0%                       |
| Concepts that must stay apart, apart   | 100%   | 100%                       |
| Summary statements naming two products | 25%    | 25% (37.5% in another run) |
| Seconds                                | 506    | 429                        |

The review-shaped facts of the BILLY card went from 15 to a few; the KALLAX card still holds `quality → Good`, `robustness → robust` and `finish → lovely` (an evaluation as a value). No code rule removes them: any would need a list of evaluation words per language, which this change does not keep (decision 2). The IKEA cards now state dimensions and colour. On the electronics pages every label is still found.

Remaining, not fixed: evaluation words as values on a page with many reviews; `delivery fee 40 £` (a reviewer's cost) as a fact; every card now shows `review count` among its key specs, which is noise on a phone page.

## Risks / Trade-offs

- A stricter prompt may drop real facts that read like opinions ("durable"); measured on the electronics set, whose recall must not fall.
- One run of one model on eight pages; numbers show a direction.
- Grounding in the title widens what counts as grounded; the grounded rate is watched.

## Open Questions

- Whether `gemma4:12b` follows the new rule; `qwen3:4b` may not.
- Whether a fact quoted from the title should be marked in the card as less certain.
