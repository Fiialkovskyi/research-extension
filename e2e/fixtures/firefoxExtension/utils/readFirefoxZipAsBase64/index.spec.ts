import { describe, expect, it } from "vitest";

import { readFirefoxZipAsBase64 } from "./index";

describe("readFirefoxZipAsBase64", () => {
  it("encodes the package the way geckodriver's install endpoint expects", () => {
    const encoded = readFirefoxZipAsBase64({
      override: "/builds/extension.zip",
      readFile: () => Buffer.from("PK\u0003\u0004 pretend zip"),
    });

    expect(Buffer.from(encoded, "base64").toString()).toBe("PK\u0003\u0004 pretend zip");
  });

  it("reads the package that resolution selected", () => {
    const read: string[] = [];

    readFirefoxZipAsBase64({
      outputDirectory: "/builds",
      override: undefined,
      listDirectory: () => ["app-0.1.0-firefox.zip"],
      readFile: (path) => {
        read.push(path);
        return Buffer.from("");
      },
    });

    expect(read).toEqual(["/builds/app-0.1.0-firefox.zip"]);
  });

  it("surfaces a resolution failure rather than reading a missing file", () => {
    expect(() =>
      readFirefoxZipAsBase64({
        outputDirectory: "/builds",
        override: undefined,
        listDirectory: () => [],
        readFile: () => {
          throw new Error("should not be reached");
        },
      }),
    ).toThrow(/No Firefox package found/);
  });
});
