import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "wxt";

import { EXTENSION_ID, FIREFOX_MIN_VERSION } from "./src/shared/config";
// Imported from the constants file rather than the module barrel: the barrel
// also exports functions that import through the `@/` alias, which the config
// loader does not resolve. The manifest only needs the origins anyway.
import { MODEL_HOST_ORIGINS } from "./src/shared/huggingFace/constants";

export default defineConfig({
  srcDir: "src",
  // WXT would default this to `src/public`. The ONNX Runtime binaries are
  // generated output copied out of node_modules, so they belong beside the
  // build rather than inside the source tree.
  publicDir: "public",
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
    // A research session is a tab group, and `tabGroups.*` needs this.
    // `sessions` gives each session tab a per-tab value that survives the tab
    // being closed and restored, which is how a tab restored after its group is
    // gone is brought back into the session. Nothing else is requested: `tabs`
    // would only expose tab URLs and titles, which the extension never reads.
    permissions: ["tabGroups", "sessions"],
    // Derived from one list so the policy and the permissions cannot drift
    // apart from each other, nor from the code that builds the request URLs.
    host_permissions: MODEL_HOST_ORIGINS.map((origin) => `${origin}/*`),
    content_security_policy: {
      // `wasm-unsafe-eval` lets the packaged ONNX Runtime compile its own
      // WebAssembly. It permits compilation of bundled bytes, not fetching
      // code, so the no-remote-code guarantee is unaffected.
      //
      // `connect-src` is the enforcement point for no-egress: the add-on can
      // reach itself and the model hosts, and nothing else. Widening it is a
      // spec-level change, not a configuration tweak.
      extension_pages: [
        "script-src 'self' 'wasm-unsafe-eval'",
        "object-src 'none'",
        `connect-src 'self' ${MODEL_HOST_ORIGINS.join(" ")}`,
      ].join("; "),
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
    resolve: {
      // `onnxruntime-web`'s default export condition is a "bundle" build with
      // the WebAssembly binary embedded as a base64 data URI — two of them, in
      // fact, which added 71.6 MB to the worker on top of the 41 MB we already
      // ship as files. This condition selects the build that loads its binary
      // externally, which is what `wasmPaths` points at.
      //
      // Listed with the defaults because Vite replaces this array rather than
      // extending it.
      conditions: [
        "onnxruntime-web-use-extern-wasm",
        "module",
        "browser",
        "development|production",
      ],
    },
  }),
});
