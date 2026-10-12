import { describe, expect, it } from "vitest";

import { hashText } from ".";

describe("hashText", () => {
  it("gives the SHA-256 of the text's UTF-8 bytes in hex", async () => {
    expect(await hashText("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("gives equal texts the same hash and different texts different ones", async () => {
    expect(await hashText("mid-drive")).toBe(await hashText("mid-drive"));
    expect(await hashText("mid-drive")).not.toBe(await hashText("hub"));
  });
});
