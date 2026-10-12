import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

export interface PageServer {
  /** `http://127.0.0.1:<port>`, with no trailing slash. */
  origin: string;
  close: () => Promise<void>;
}

/**
 * Serves a small HTML page for every path, on a free loopback port.
 *
 * Firefox only keeps a closed tab, or saves a group, when the tab holds history
 * worth restoring — `about:blank` is discarded. Real `http://` pages are the
 * cheapest history that counts, and serving them locally keeps the suite
 * offline.
 */
export const startPageServer = async (): Promise<PageServer> => {
  const server = createServer((request, response) => {
    response.setHeader("content-type", "text/html; charset=utf-8");
    response.end(
      `<!doctype html><title>page ${request.url ?? "/"}</title><p>${request.url ?? "/"}`,
    );
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

  const { port } = server.address() as AddressInfo;

  return {
    origin: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  };
};
