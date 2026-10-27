## Context

The five fixtures come from one shop (`jabko.ua`), all electronics, all Ukrainian. The chosen model and every tidying rule were tuned on them.

## Goals / Non-Goals

**Goals:** see what breaks outside that set; a baseline for the recommended model.

**Non-Goals:** fixing what is found (a separate change); a large set; any change in `src/`.

## Decisions

1. **IKEA product pages.** They are server-rendered, exist in many languages under one layout, and are not electronics. Three pages, found by trying: `BILLY` in English and in Polish (the same product, to see two languages of one item) and `KALLAX` in English. Two first guesses (a bed frame in each language) resolved to the shop's category page and were thrown away. Captured with `npm run eval:capture`, so nothing new in tooling.
2. **Few pages.** Two or three: one English, one Polish, and a second English one of a different kind of item, to give the summary something to compare. Labels are hand-written and kept to facts a reader would take from the page.
3. **Baseline over everything.** `npm run eval:baseline` with `gemma4:12b` on all fixtures. The earlier baseline (`qwen3:4b`, five pages) is replaced; its numbers stay in the archived change and the git history.
4. **Report by group.** The run prints one table over all fixtures; the group split is read from the saved report JSON per fixture and written into the change's report, not into the tool.

## Findings

One run, `gemma4:12b`, 8 fixtures (5 Ukrainian electronics, 3 IKEA). Not fixed here.

- **The readable text of an IKEA page is the reviews.** The specifications are not in it; the name, brand, price, availability and rating reach the model only as the page's own data, and the dimensions only in the title. Three labelled facts per page (dimensions, colour, rating count) are never found: 82.5% of labels over all pages against 97.6% on the five electronics pages.
- **Reviews are turned into facts.** `price → great`, `looks good → good`, `easy to build → easy`, `Room for all of his books → Room`. The prompt has no rule that an opinion or a feeling is not a fact; on the electronics pages there were no reviews to expose it. 15 facts of the BILLY card and 11 of KALLAX are of this kind.
- **A reviewer's number is stated like the page's.** On the Polish page `cena → 129` (a reviewer's sale price) sits next to the page's `279 PLN`; on KALLAX `price → 49 £` repeats the page's data with the unit inside the value.
- **A value can be the reviewer's word for the attribute.** `regulowane półki → Fajnie` ("nice") on the Polish page; the label-as-value rule does not catch an adjective.
- **The Polish page gave six answers and no card of its own** among the six cards; the cause (merged into the English BILLY card, or lost) was not examined.
- **The summary compared two products in a quarter of its statements** (price of BILLY against KALLAX; price of the iPhone against the Pixel), against none with `qwen3:4b`. The eval puts every fixture into one session, so phones and shelves share a summary; a real session clusters them apart.
- **Junk drops are low** (3.1%), since a review sentence has a subject.

## Risks / Trade-offs

- A shop page carries a lot of navigation and recommendations; the readable-text step may keep noise that the electronics pages did not have. That is the thing being measured.
- A baseline over mixed languages blurs per-language numbers; the per-fixture report keeps them apart.

## Open Questions

- What to do about reviews (a prompt rule, or leaving review text out of the readable text) and about facts in the title that no passage states: a change of their own.
- Whether a page with no product at all (an article) should be a fixture to check that nothing is invented; left for a later change if the product pages show the need.
