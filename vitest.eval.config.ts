import { defineConfig } from "vitest/config";
import { WxtVitest } from "wxt/testing/vitest-plugin";

// The prompt evals are not unit tests: they need a local Ollama and take minutes, so
// `vitest.config.ts` never collects them. The same plugin gives them the extension's aliases.
export default defineConfig({
  plugins: [WxtVitest()],
  test: {
    environment: "jsdom",
    globals: false,
    include: ["evals/**/*.eval.ts"],
    // A small model reads a page in minutes: an hour for a whole run.
    testTimeout: 60 * 60 * 1000,
  },
});
