import { mkdtemp, writeFile } from "node:fs/promises";
import { request } from "node:http";
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

  it("answers a search host with a results page for the query", async () => {
    server = await startPageServer(await mkdtemp(join(tmpdir(), "pages-")));

    const { port } = new URL(server.origin);
    // Sent as the browser sends it once the profile resolves the host here.
    const body = await new Promise<string>((resolve, reject) => {
      request(
        {
          host: "127.0.0.1",
          port,
          path: "/?q=e-bike+motors",
          headers: { host: `duckduckgo.com:${port}` },
        },
        (response) => {
          let text = "";
          response.on("data", (chunk: Buffer) => (text += chunk.toString()));
          response.on("end", () => resolve(text));
        },
      )
        .on("error", reject)
        .end();
    });

    expect(body).toContain("<title>e-bike motors - Search</title>");
    expect(body).toContain(`href="${server.origin}/a.html"`);
  });
});
