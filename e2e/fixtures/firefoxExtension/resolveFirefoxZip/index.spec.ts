import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { resolveFirefoxZip } from "./index";

const PACKAGE = "research-graph-extension-0.1.0-firefox.zip";

describe("resolveFirefoxZip", () => {
  it("returns the package found in the output directory", () => {
    const path = resolveFirefoxZip({
      outputDirectory: "/builds",
      override: undefined,
      listDirectory: () => [PACKAGE, "research-graph-extension-0.1.0-sources.zip"],
    });

    expect(path).toBe(join("/builds", PACKAGE));
  });

  it("prefers an explicit override over whatever is in the output directory", () => {
    const path = resolveFirefoxZip({
      override: "/elsewhere/dev-build.zip",
      listDirectory: () => [PACKAGE],
    });

    expect(path).toBe("/elsewhere/dev-build.zip");
  });

  it("makes a relative override absolute, since the driver resolves nothing for us", () => {
    const path = resolveFirefoxZip({ override: "builds/dev.zip", listDirectory: () => [] });

    expect(path).toBe(resolve("builds/dev.zip"));
  });

  it("treats an empty override as unset, so an exported-but-blank variable is harmless", () => {
    const path = resolveFirefoxZip({
      outputDirectory: "/builds",
      override: "",
      listDirectory: () => [PACKAGE],
    });

    expect(path).toBe(join("/builds", PACKAGE));
  });

  it("does not read the directory at all when an override is given", () => {
    let listed = false;

    resolveFirefoxZip({
      override: "/elsewhere/dev-build.zip",
      listDirectory: () => {
        listed = true;
        return [];
      },
    });

    expect(listed).toBe(false);
  });

  it("explains that nothing has been built when the directory is missing", () => {
    expect(() =>
      resolveFirefoxZip({
        outputDirectory: "/absent",
        override: undefined,
        listDirectory: () => {
          throw Object.assign(new Error("ENOENT: no such file or directory"), {
            code: "ENOENT",
          });
        },
      }),
    ).toThrow(/No build output at \/absent\. Run "npm run zip:firefox"/);
  });

  it("propagates the original error when the directory read fails for a reason other than it being missing", () => {
    expect(() =>
      resolveFirefoxZip({
        outputDirectory: "/no-permission",
        override: undefined,
        listDirectory: () => {
          throw Object.assign(new Error("EACCES: permission denied"), { code: "EACCES" });
        },
      }),
    ).toThrow(/EACCES: permission denied/);
  });

  it("propagates the selection error when the directory holds no package", () => {
    expect(() =>
      resolveFirefoxZip({
        outputDirectory: "/builds",
        override: undefined,
        listDirectory: () => ["firefox-mv3"],
      }),
    ).toThrow(/No Firefox package found/);
  });
});

describe("resolveFirefoxZip against a real directory", () => {
  let directory: string | undefined;

  afterEach(() => {
    if (directory !== undefined) {
      rmSync(directory, { recursive: true, force: true });
      directory = undefined;
    }
  });

  it("reads the filesystem when no listing function is injected", () => {
    directory = mkdtempSync(join(tmpdir(), "resolve-firefox-zip-"));
    writeFileSync(join(directory, PACKAGE), "");
    writeFileSync(join(directory, "research-graph-extension-0.1.0-sources.zip"), "");

    expect(resolveFirefoxZip({ outputDirectory: directory, override: undefined })).toBe(
      join(directory, PACKAGE),
    );
  });
});
