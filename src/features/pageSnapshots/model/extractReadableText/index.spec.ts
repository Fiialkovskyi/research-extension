import { describe, expect, it } from "vitest";

import { extractReadableText } from ".";

const ARTICLE = `
  <nav><a href="/">Home</a> <a href="/shop">Shop the motors catalogue</a></nav>
  <article>
    <h1>Mid-drive motors</h1>
    ${Array.from(
      { length: 8 },
      (_, index) =>
        `<p>Paragraph ${index}: a mid-drive motor sits at the cranks and drives the chain, so it
        uses the bike's gears, which keeps it efficient on steep climbs and long rides alike.</p>`,
    ).join("\n")}
  </article>
  <script>window.tracking = "never in a snapshot";</script>
  <footer>Copyright footer</footer>`;

const buildDocument = (body: string): Document => {
  const document = window.document.implementation.createHTMLDocument("Mid-drive motors");

  document.body.innerHTML = body;

  return document;
};

describe("extractReadableText", () => {
  it("returns the article's text without the page's navigation or scripts", () => {
    const extracted = extractReadableText(buildDocument(ARTICLE));

    expect(extracted?.truncated).toBe(false);
    expect(extracted?.text).toContain("a mid-drive motor sits at the cranks");
    expect(extracted?.text).toContain("Paragraph 7");
    expect(extracted?.text).not.toContain("never in a snapshot");
    expect(extracted?.text).not.toContain("Shop the motors catalogue");
  });

  it("collapses the whitespace the markup leaves", () => {
    const text = extractReadableText(buildDocument(ARTICLE))?.text ?? "";

    expect(text).not.toMatch(/ {2}/);
    expect(text).not.toMatch(/\n{3}/);
  });

  it("returns nothing for a page with no readable content", () => {
    expect(extractReadableText(buildDocument("<div></div>"))).toBeUndefined();
  });

  it("cuts a very long page at 200 KB and says so", () => {
    const paragraph = `<p>${"Torque and cadence sensors decide how a motor feels. ".repeat(100)}</p>`;
    const extracted = extractReadableText(
      buildDocument(`<article>${paragraph.repeat(60)}</article>`),
    );

    expect(extracted?.truncated).toBe(true);
    expect(new TextEncoder().encode(extracted?.text).byteLength).toBeLessThanOrEqual(200 * 1024);
    expect(new TextEncoder().encode(extracted?.text).byteLength).toBeGreaterThan(199 * 1024);
  });

  it("leaves the page's own document as it was", () => {
    const document = buildDocument(ARTICLE);
    const before = document.documentElement.outerHTML;

    extractReadableText(document);

    expect(document.documentElement.outerHTML).toBe(before);
  });
});
