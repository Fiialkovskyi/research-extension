import { describe, expect, it } from "vitest";

import { readPageMetadata } from ".";

const buildDocument = (head: string): Document => {
  const document = window.document.implementation.createHTMLDocument("");

  document.documentElement.innerHTML = `<head>${head}</head><body></body>`;

  return document;
};

describe("readPageMetadata", () => {
  it("reads every field a page publishes", () => {
    const metadata = readPageMetadata(
      buildDocument(`
        <title>Plain title</title>
        <meta property="og:title" content="Mid-drive motors explained">
        <meta property="og:description" content="How they work.">
        <meta property="og:type" content="article">
        <meta property="og:site_name" content="Bike Lab">
        <meta name="author" content="A. Rider">
        <meta property="article:published_time" content="2026-05-01T08:00:00Z">
        <link rel="canonical" href="https://example.org/motors">
      `),
    );

    expect(metadata).toEqual({
      title: "Mid-drive motors explained",
      description: "How they work.",
      siteName: "Bike Lab",
      type: "article",
      author: "A. Rider",
      publishedAt: "2026-05-01T08:00:00Z",
      canonicalUrl: "https://example.org/motors",
    });
  });

  it("falls back to the plain title and description", () => {
    expect(
      readPageMetadata(
        buildDocument('<title>Plain title</title><meta name="description" content="Plain.">'),
      ),
    ).toEqual({ title: "Plain title", description: "Plain." });
  });

  it("takes the open graph tag over the plain one", () => {
    expect(
      readPageMetadata(
        buildDocument(
          '<meta name="description" content="Plain."><meta property="og:description" content="Open.">',
        ),
      ),
    ).toEqual({ description: "Open." });
  });

  it("falls back to the article author when there is no author tag", () => {
    expect(
      readPageMetadata(buildDocument('<meta property="article:author" content="B. Writer">')),
    ).toEqual({ author: "B. Writer" });
  });

  it("collapses whitespace and cuts a field to its limit", () => {
    const metadata = readPageMetadata(
      buildDocument(`<meta name="description" content="  A \n  ${"b".repeat(1500)}">`),
    );

    expect(metadata?.description?.startsWith("A bbb")).toBe(true);
    expect(metadata?.description).toHaveLength(1000);
  });

  it("leaves out a bad canonical link and every field that is empty", () => {
    expect(
      readPageMetadata(
        buildDocument(
          '<title> </title><meta name="description" content=""><link rel="canonical" href="ftp://example.org/a"><meta property="og:type" content="website">',
        ),
      ),
    ).toEqual({ type: "website" });
  });

  it("reads nothing else, og:image included", () => {
    expect(
      readPageMetadata(
        buildDocument(
          '<meta property="og:image" content="https://example.org/i.png"><meta name="keywords" content="x">',
        ),
      ),
    ).toBeUndefined();
  });

  it("returns nothing for a page that says nothing of itself", () => {
    expect(readPageMetadata(buildDocument(""))).toBeUndefined();
  });
});
