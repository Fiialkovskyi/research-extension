import { describe, expect, it } from "vitest";

import { startPageServer } from ".";

describe("startPageServer", () => {
  it("serves an HTML page titled after the requested path, on loopback", async () => {
    const server = await startPageServer();

    try {
      expect(server.origin).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);

      const response = await fetch(`${server.origin}/a1-0`);

      expect(response.headers.get("content-type")).toContain("text/html");
      expect(await response.text()).toContain("<title>page /a1-0</title>");
    } finally {
      await server.close();
    }
  });
});
