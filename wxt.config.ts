import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "wxt";

import { EXTENSION_ID, FIREFOX_MIN_VERSION } from "./src/shared/config/extension";

export default defineConfig({
  srcDir: "src",
  // Firefox defaults to MV2 in WXT; the target spec requires an MV3 package.
  manifestVersion: 3,
  modules: ["@wxt-dev/module-react"],
  // Auto-imports off on purpose: explicit imports keep the atomic module
  // boundaries visible and keep oxlint's import rules meaningful.
  imports: false,
  manifest: {
    name: "Research Graph",
    description: "Local-only research graph capture and synthesis.",
    browser_specific_settings: {
      gecko: {
        id: EXTENSION_ID,
        strict_min_version: FIREFOX_MIN_VERSION,
        // Required by Firefox for new extensions since 2025-11-03. The
        // extension collects nothing, so it declares exactly that.
        data_collection_permissions: {
          required: ["none"],
        },
      },
    },
    action: {
      default_title: "Research Graph",
    },
  },
  dev: {
    server: {
      // Bind the loopback address Firefox actually resolves `localhost` to.
      // WXT's default is port 3000 with strictPort off, so an unrelated server
      // already holding that port leaves the dev server on [::1] while Firefox
      // fetches the popup's modules over IPv4 from the other server and the
      // popup renders empty. A dedicated port that fails loudly avoids that.
      host: "127.0.0.1",
      port: 3100,
      strictPort: true,
      origin: "http://127.0.0.1:3100",
    },
  },
  vite: () => ({
    plugins: [tailwindcss()],
  }),
});
