import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { type PageServer, startPageServer } from ".";

let server: PageServer | undefined;

afterEach(async () => {
  await server?.close();
  server = undefined;
});

describe("startPageServer", () => {
  it("serves a page on the loopback interface and nothing outside its directory", async () => {
    const root = await mkdtemp(join(tmpdir(), "pages-"));
    await writeFile(join(root, "a.html"), "<title>A</title>");

    server = await startPageServer(root);

    expect(server.origin).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);

    const page = await fetch(`${server.origin}/a.html`);

    expect(page.status).toBe(200);
    expect(page.headers.get("content-type")).toContain("text/html");
    expect(await page.text()).toBe("<title>A</title>");
    expect((await fetch(`${server.origin}/missing.html`)).status).toBe(404);
  });
});
