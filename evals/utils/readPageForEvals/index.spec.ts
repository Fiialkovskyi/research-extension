import { describe, expect, it } from "vitest";

import { readPageForEvals } from ".";

const html = `<!doctype html><html><head><title>Pixel 10a</title>
<meta property="og:site_name" content="Shop"></head>
<body><article><h1>Pixel 10a</h1>
<p>The phone weighs 184 g and the battery holds 5100 mAh, which is enough for a day of use.</p>
<p>It has a 6.3 inch screen and a processor that handles everyday work without trouble.</p>
</article></body></html>`;

describe("readPageForEvals", () => {
  it("reads the readable text and the metadata of a page", () => {
    const { text, metadata } = readPageForEvals(html);

    expect(text).toContain("184 g");
    expect(metadata).toMatchObject({ title: "Pixel 10a", siteName: "Shop" });
  });

  it("finds no text on a page with none", () => {
    expect(readPageForEvals("<html><body></body></html>").text).toBe(undefined);
  });
});
