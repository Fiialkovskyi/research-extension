import { browser } from "@wdio/globals";

import {
  BENCHMARK_TEST_ID,
  CAPABILITIES_TEST_ID,
  EMPTY_LIST_TEST_ID,
  OLLAMA_CARD_TEST_ID,
  POLICY_TEST_ID,
  PROBE_LIST_TEST_ID,
  PROBLEM_TEST_ID,
  SURFACE_TEST_ID,
} from "../../constants";

/** What the options surface is showing. */
export interface OptionsSnapshot {
  /** The reported devices and thread count, as rendered. */
  capabilities: string;
  backgroundColor: string;
  textColor: string;
  /** Whether the surface says nothing is installed. */
  listIsEmpty: boolean;
  /** Repositories currently listed as installed. */
  installedRepositories: string[];
  /** One line per conformance check, as rendered. */
  probes: string[];
  /** The throughput report, as rendered. Empty when none has been produced. */
  benchmark: string;
  /** What the policy permits and what it refused, as rendered. */
  policy: string;
  /** A refusal the surface is showing, if any. */
  problem: string;
  /** Where the Ollama card says the local server stands, from its `data-state`. */
  ollamaState: string;
  ollamaText: string;
}

/**
 * Reads the surface as a user would see it.
 *
 * Rendered text rather than internal state: the question these tests ask is
 * what the add-on actually tells someone, and reading through to the store
 * would answer a different and easier one. Computed styles for the same reason.
 *
 * Written without inner helper functions on purpose. The script is serialised
 * and injected into the page, and the build step wraps named arrow functions in
 * a helper that does not exist there — producing `__name is not defined` at a
 * point far from the cause.
 */
export const readOptionsSurface = async (): Promise<OptionsSnapshot> => {
  return browser.execute(
    (
      surfaceId: string,
      capabilitiesId: string,
      emptyId: string,
      probesId: string,
      benchmarkId: string,
      policyId: string,
      problemId: string,
      ollamaId: string,
    ) => {
      const surface = document.querySelector(`[data-testid="${surfaceId}"]`);

      if (surface === null) {
        throw new Error("The options surface is not present");
      }

      const styles = globalThis.getComputedStyle(surface);

      return {
        capabilities:
          document.querySelector(`[data-testid="${capabilitiesId}"]`)?.textContent?.trim() ?? "",
        backgroundColor: styles.backgroundColor,
        textColor: styles.color,
        listIsEmpty: document.querySelector(`[data-testid="${emptyId}"]`) !== null,
        installedRepositories: [
          ...document.querySelectorAll('[data-testid="model-list-item"] p'),
        ].map((node) => node.textContent?.trim() ?? ""),
        probes: [...document.querySelectorAll(`[data-testid="${probesId}"] li`)].map(
          (node) => node.textContent?.trim() ?? "",
        ),
        benchmark:
          document.querySelector(`[data-testid="${benchmarkId}"]`)?.textContent?.trim() ?? "",
        policy: document.querySelector(`[data-testid="${policyId}"]`)?.textContent?.trim() ?? "",
        problem: document.querySelector(`[data-testid="${problemId}"]`)?.textContent?.trim() ?? "",
        ollamaState:
          document.querySelector(`[data-testid="${ollamaId}"]`)?.getAttribute("data-state") ?? "",
        ollamaText:
          document.querySelector(`[data-testid="${ollamaId}"]`)?.textContent?.trim() ?? "",
      };
    },
    SURFACE_TEST_ID,
    CAPABILITIES_TEST_ID,
    EMPTY_LIST_TEST_ID,
    PROBE_LIST_TEST_ID,
    BENCHMARK_TEST_ID,
    POLICY_TEST_ID,
    PROBLEM_TEST_ID,
    OLLAMA_CARD_TEST_ID,
  );
};
