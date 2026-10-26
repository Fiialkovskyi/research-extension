import { describe, expect, it } from "vitest";

import { readJsonLd } from ".";

const pageWith = (...scripts: string[]): Document => {
  const document = globalThis.document.implementation.createHTMLDocument("t");

  for (const text of scripts) {
    const script = document.createElement("script");

    script.type = "application/ld+json";
    script.textContent = text;
    document.head.append(script);
  }

  return document;
};

describe("readJsonLd", () => {
  it("parses each JSON-LD script and skips one that is not JSON", () => {
    expect(readJsonLd(pageWith('{"@type":"Product"}', "not json", '[{"a":1}]'))).toEqual([
      { "@type": "Product" },
      [{ a: 1 }],
    ]);
  });

  it("reads at most eight scripts and skips one that is too long", () => {
    const many = Array.from({ length: 10 }, (_, index) => `{"n":${index}}`);

    expect(readJsonLd(pageWith(...many))).toHaveLength(8);
    expect(readJsonLd(pageWith(`{"x":"${"a".repeat(200_001)}"}`))).toEqual([]);
  });

  it("reads other scripts as nothing", () => {
    const document = pageWith();
    const script = document.createElement("script");

    script.textContent = '{"@type":"Product"}';
    document.head.append(script);

    expect(readJsonLd(document)).toEqual([]);
  });
});
