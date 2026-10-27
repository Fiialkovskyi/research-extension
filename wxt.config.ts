import { resolve } from "node:path";

import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "wxt";

import { EXTENSION_ID, FIREFOX_MIN_VERSION } from "./src/shared/config";
// Imported from the constants file rather than the module barrel: the barrel
// also exports functions that import through the `@/` alias, which the config
// loader does not resolve. The manifest only needs the origins anyway.
import { MODEL_HOST_ORIGINS } from "./src/shared/huggingFace/constants";
import { IS_IN_BROWSER_BACKEND_ENABLED } from "./src/shared/config/modelBackends/constants";
import { LOCAL_INFERENCE_ORIGINS } from "./src/shared/config/ollama/constants";

/**
 * The model hosts the in-extension backend downloads from. Kept, not deleted:
 * while that backend is switched off the package names no model host at all,
 * and switching it back on restores both the permission and the policy entry.
 */
const ENABLED_MODEL_HOST_ORIGINS = IS_IN_BROWSER_BACKEND_ENABLED ? MODEL_HOST_ORIGINS : [];

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
    // One SVG serves every size: Firefox rasterises it for the toolbar, the
    // add-ons manager and the notification, so no PNG set has to be kept in step.
    icons: {
      "48": "icon.svg",
      "96": "icon.svg",
    },
    action: {
      default_title: "Research Graph",
      default_icon: "icon.svg",
    },
    // A research session is a tab group (`tabGroups`). Capturing its pages needs
    // each tab's URL and title (`tabs`) and how each page was reached
    // (`webNavigation`). `sessions` gives each session tab a per-tab value that
    // survives the tab being closed and restored, which is how a tab restored
    // after its group is gone is brought back into the session. `idle` tells
    // reading time from a user who has walked away, and `scripting` injects the
    // page observer into session tabs. `alarms` lets queued jobs wake the
    // background after it was unloaded, and `notifications` tells the user once,
    // after install, that AI needs setting up. Nothing else is requested.
    permissions: [
      "tabGroups",
      "tabs",
      "webNavigation",
      "sessions",
      "scripting",
      "idle",
      "alarms",
      "notifications",
    ],
    // Reading a session page's scroll, copies and text needs access to page
    // contents, so `<all_urls>` is required and Firefox grants it with the
    // install: a session needs no click, and one cannot quietly record less. It
    // is used only to observe the tabs of a session, and the user can still
    // revoke it in about:addons, which the popup says and offers to undo.
    host_permissions: [
      "<all_urls>",
      // Derived from one list so the policy and the permissions cannot drift
      // apart from each other, nor from the code that builds the request URLs.
      // The local Ollama server is required rather than optional, so setting AI
      // up asks for no permission: it is loopback only, nothing leaves the
      // machine, and nothing is sent there until the user starts setup, which the
      // background records rather than reading it from this grant.
      ...[...ENABLED_MODEL_HOST_ORIGINS, ...LOCAL_INFERENCE_ORIGINS].map((origin) => `${origin}/*`),
    ],
    content_security_policy: {
      // `wasm-unsafe-eval` lets the packaged ONNX Runtime compile its own
      // WebAssembly. It permits compilation of bundled bytes, not fetching
      // code, so the no-remote-code guarantee is unaffected.
      //
      // `connect-src` is the enforcement point for no-egress: the add-on can
      // reach itself, the model hosts and the local inference server on
      // loopback, and nothing else. Widening it is a
      // spec-level change, not a configuration tweak.
      extension_pages: [
        "script-src 'self' 'wasm-unsafe-eval'",
        "object-src 'none'",
        `connect-src 'self' ${[...ENABLED_MODEL_HOST_ORIGINS, ...LOCAL_INFERENCE_ORIGINS].join(" ")}`,
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
  // `npm run dev` keeps one Firefox profile in the repository rather than a
  // fresh one per run, so what the extension stored — Ollama set up and
  // checked, sessions, page access — is there the next time. `npm run dev`
  // creates the directory; deleting it starts over. `npm run dev:fresh` sets
  // `DEV_FRESH_PROFILE` and gets a new throwaway profile instead.
  webExt:
    process.env["DEV_FRESH_PROFILE"] === "true"
      ? {}
      : {
          firefoxProfile: resolve(import.meta.dirname, ".firefoxProfile"),
          keepProfileChanges: true,
          firefoxPref: {
            // The extension is installed temporarily and removed when Firefox
            // quits; without these its storage and its moz-extension://
            // address would go with it, and Ollama's allowed origin would no
            // longer match.
            "extensions.webextensions.keepStorageOnUninstall": true,
            "extensions.webextensions.keepUuidOnUninstall": true,
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
