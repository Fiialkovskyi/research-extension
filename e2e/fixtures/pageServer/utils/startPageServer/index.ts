import { readFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

import { SEARCH_HOSTS } from "../../constants";
import { buildSearchResultsPage } from "../buildSearchResultsPage";
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
 * pages without any request leaving the machine. A request addressed to one of
 * the search hosts, which the test profile resolves here, is answered with a
 * results page for its `q` parameter.
 */
export const startPageServer = async (root: string): Promise<PageServer> => {
  let loopbackOrigin = "";
  const server: Server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "127.0.0.1"}`);

    if ((SEARCH_HOSTS as readonly string[]).includes(url.hostname)) {
      response
        .writeHead(200, { "content-type": "text/html; charset=utf-8" })
        .end(buildSearchResultsPage(url.searchParams.get("q") ?? "", loopbackOrigin));
      return;
    }

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

  loopbackOrigin = `http://127.0.0.1:${port}`;

  return {
    origin: loopbackOrigin,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((error) => (error === undefined ? resolve() : reject(error)));
      }),
  };
};
