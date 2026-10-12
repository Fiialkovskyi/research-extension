import { describe, expect, it } from "vitest";

import { chunkText } from ".";

/** A sentence of `words` words, numbered so every sentence is distinct. */
const sentence = (number: number, words = 20) =>
  `Sentence ${number} ${Array.from({ length: words - 2 }, () => "word").join(" ")}.`;

const text = (count: number, words = 20) =>
  Array.from({ length: count }, (_, index) => sentence(index + 1, words)).join(" ");

const wordsIn = (value: string) => value.split(/\s+/u).filter(Boolean).length;

describe("chunkText", () => {
  it("cuts a long text into chunks of about 220 words of whole sentences", () => {
    const article = text(50);
    const chunks = chunkText(article);

    expect(chunks.length).toBeGreaterThanOrEqual(4);
    expect(chunks.length).toBeLessThanOrEqual(6);

    for (const { start, end } of chunks.slice(0, -1)) {
      const body = article.slice(start, end);

      expect(wordsIn(body)).toBeGreaterThanOrEqual(220);
      expect(wordsIn(body)).toBeLessThan(260);
      expect(body.trim()).toMatch(/^Sentence \d+ .*\.$/su);
    }
  });

  it("starts each chunk after the first with the last sentence of the one before", () => {
    const article = text(50);
    const chunks = chunkText(article);

    for (let index = 1; index < chunks.length; index += 1) {
      const previous = article.slice(chunks[index - 1]?.start, chunks[index - 1]?.end).trim();
      const current = article.slice(chunks[index]?.start, chunks[index]?.end).trim();
      const lastSentence = previous.slice(previous.lastIndexOf("Sentence "));

      expect(current.startsWith(lastSentence)).toBe(true);
    }
  });

  it("keeps a short text as one chunk covering all of it", () => {
    const short = text(4);

    expect(chunkText(short)).toEqual([{ index: 0, start: 0, end: short.length }]);
  });

  it("makes a sentence longer than a chunk a chunk of its own, and moves on", () => {
    const long = `${sentence(1)} ${sentence(2, 400)} ${sentence(3)}`;
    const bodies = chunkText(long).map(({ start, end }) => long.slice(start, end).trim());

    expect(
      bodies.some((body) => body.startsWith("Sentence 2") && !body.includes("Sentence 3")),
    ).toBe(true);
    expect(bodies.at(-1)).toContain("Sentence 3");
  });

  it("gives nothing for a text without words", () => {
    expect(chunkText("   ")).toEqual([]);
  });

  it("numbers chunks in order, with ranges inside the text", () => {
    const article = text(30);
    const chunks = chunkText(article);

    expect(chunks.map(({ index }) => index)).toEqual(chunks.map((_, index) => index));
    expect(
      chunks.every(({ start, end }) => start >= 0 && end <= article.length && start < end),
    ).toBe(true);
  });
});
