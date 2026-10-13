import { describe, expect, it } from "vitest";

import { SEARCH_ENGINES } from "./constants";
import type { SearchEngine } from "./types";

/**
 * Guard: a search the extension opens for the user ("search this") must land
 * on a page capture recognises as that engine's results, or it would be
 * recorded as a plain page. So every template is checked against the same
 * engine's hosts, result paths and query parameters.
 */

/** Whether a hostname is one of an engine's, where `name.*` stands for any TLD. */
const isOwnHost = (hostname: string, engine: SearchEngine): boolean =>
  engine.hosts.some((host) =>
    host.endsWith(".*") ? hostname.startsWith(host.slice(0, -1)) : hostname === host,
  );

/** The problems with an engine's template, none when it is sound. */
const readTemplateProblems = (engine: SearchEngine): string[] => {
  const url = new URL(engine.searchUrl.replace("{query}", "probe"));
  const problems: string[] = [];

  if (url.protocol !== "https:") {
    problems.push("not https");
  }

  if (!isOwnHost(url.hostname, engine)) {
    problems.push(`host ${url.hostname} is not the engine's`);
  }

  if (!engine.resultPaths.includes(url.pathname)) {
    problems.push(`path ${url.pathname} is not a results path`);
  }

  if (!engine.queryParameters.some((parameter) => url.searchParams.get(parameter) === "probe")) {
    problems.push("the query is not in a query parameter");
  }

  return problems;
};

describe("the bundled search engines' URLs", () => {
  it.each(SEARCH_ENGINES.map((engine) => [engine.name, engine] as const))(
    "%s opens a results page capture recognises",
    (_name, engine) => {
      expect(readTemplateProblems(engine)).toEqual([]);
    },
  );

  it("would catch a template on the wrong path", () => {
    const [google] = SEARCH_ENGINES;

    expect(
      readTemplateProblems({ ...google!, searchUrl: "https://www.google.com/find?q={query}" }),
    ).toEqual(["path /find is not a results path"]);
  });
});
