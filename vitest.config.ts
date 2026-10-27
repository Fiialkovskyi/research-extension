import { defineConfig } from "vitest/config";
import { WxtVitest } from "wxt/testing/vitest-plugin";

export default defineConfig({
  // WxtVitest applies the same transforms, aliases and `fakeBrowser` setup the
  // extension bundle gets, so unit tests see the code the browser would run.
  plugins: [WxtVitest()],
  test: {
    environment: "jsdom",
    globals: false,
    setupFiles: ["./vitest.setup.ts"],
    // Unit tests live beside the module they cover, in `src/` and in the e2e
    // harness's own helpers and the prompt evals' alike. The browser-driving specs are named
    // `*.e2e.ts`, run by WebdriverIO, and must never be collected here.
    include: ["src/**/*.spec.{ts,tsx}", "e2e/**/*.spec.ts", "evals/**/*.spec.ts"],
    exclude: ["**/*.e2e.ts", "node_modules/**", ".output/**", ".wxt/**"],
  },
});
