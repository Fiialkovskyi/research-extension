import { readFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

import { resolvePagePath } from "../resolvePagePath";

export interface PageServer {
  /** `http://127.0.0.1:<port>`, with no trailing slash. */
  origin: string;
  close: () => Promise<void>;
}

/**
 * Serves the suite's pages on the loopback interface, on a free port.
 *
 * Kept on `127.0.0.1` so the suite stays offline: the browser loads these
 * pages without any request leaving the machine.
 */
export const startPageServer = async (root: string): Promise<PageServer> => {
  const server: Server = createServer((request, response) => {
    const page = resolvePagePath(root, request.url ?? "/");

    if (page === undefined) {
      response.writeHead(404).end();
      return;
    }

    readFile(page.path).then(
      (body) => {
        response.writeHead(200, { "content-type": page.contentType }).end(body);
      },
      () => {
        response.writeHead(404).end();
      },
    );
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  const { port } = server.address() as AddressInfo;

  return {
    origin: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((error) => (error === undefined ? resolve() : reject(error)));
      }),
  };
};
