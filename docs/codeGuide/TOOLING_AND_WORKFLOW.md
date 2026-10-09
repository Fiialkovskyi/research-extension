# 11. Tooling and workflow

The tools that enforce this guide, and the path a change takes from an idea to `main`.

- [11.1 Environment](#111-environment)
- [11.2 Commands](#112-commands)
- [11.3 Formatting: oxfmt](#113-formatting-oxfmt)
- [11.4 Linting: oxlint](#114-linting-oxlint)
- [11.5 Type checking](#115-type-checking)
- [11.6 Build](#116-build)
- [11.7 From idea to merge](#117-from-idea-to-merge)
- [11.8 Commits](#118-commits)
- [11.9 Pull requests](#119-pull-requests)
- [11.10 Documentation](#1110-documentation)
- [11.11 Known deviations](#1111-known-deviations)

## 11.1 Environment

- **Node ≥ 22.14** (`engines` in `package.json`) and npm. The lockfile is committed; install with
  `npm ci` in automation, `npm install` locally.
- **Firefox** installed locally for `dev` and e2e; geckodriver and `web-ext` come as dev
  dependencies.
- `postinstall` runs `wxt prepare` (generated types in `.wxt/`) and `sync:ort` (copies the ONNX
  Runtime binaries into `public/ort/`). Both outputs are ignored by git; if types or binaries look
  missing, run `npm install` again.
- **Nothing machine-specific is committed**: no absolute paths, no local ports other than the dev
  server's, no credentials. Environment switches are read from variables (`E2E_HEADED`,
  `E2E_NETWORK`).

## 11.2 Commands

| Command                                 | Does                                                                         | When                          |
| --------------------------------------- | ---------------------------------------------------------------------------- | ----------------------------- |
| `npm run dev`                           | Launches Firefox with the extension and HMR (dev server on `127.0.0.1:3100`) | developing                    |
| `npm run test:watch`                    | Vitest in watch mode                                                         | developing                    |
| `npm run typecheck`                     | `tsc --noEmit` over `src/`, then over `e2e/`                                 | before committing             |
| `npm run lint` / `lint:fix`             | oxlint                                                                       | before committing             |
| `npm run format` / `format:check`       | oxfmt over the whole repository, Markdown included                           | before committing             |
| `npm run test`                          | Vitest, once                                                                 | before committing             |
| `npm run test:e2e`                      | packages for Firefox, then runs WebdriverIO (offline)                        | before a pull request         |
| `E2E_NETWORK=true npm run test:e2e`     | adds the network spec: real installs, conformance, throughput                | when the model path changes   |
| `npm run verify`                        | typecheck → lint → format:check → test → test:e2e                            | **before every pull request** |
| `npm run build:firefox` / `zip:firefox` | production build / package into `.output/`                                   | releasing                     |

## 11.3 Formatting: oxfmt

- **oxfmt owns formatting**, with its defaults (double quotes, trailing commas, 100-column lines).
  Nothing is formatted by hand and nothing in this guide overrides it.
- Run `npm run format` before committing; `format:check` fails the build on any difference.
- It formats Markdown too, including tables, so docs go through it like code.
- **Prose in Markdown is wrapped at 100 columns** by hand — oxfmt does not rewrap paragraphs.

## 11.4 Linting: oxlint

`.oxlintrc.json` enables the `typescript`, `react`, `react-perf`, `import`, `unicorn` and `oxc`
plugins, with `correctness` and `suspicious` as errors and `perf` as warnings. Project rules on top:

| Rule                                 | Why                                                                 |
| ------------------------------------ | ------------------------------------------------------------------- |
| `typescript/consistent-type-imports` | type-only imports are marked, so they vanish from bundles           |
| `import/no-duplicates`               | one import statement per module                                     |
| `no-console`                         | no logging in `src/` ([8.7](./ERRORS_AND_VALIDATION.md#87-logging)) |

**Exceptions are file-scoped overrides in `.oxlintrc.json`**, never inline disable comments. Each
names the exact files and is there for a reason the code states:

- `no-await-in-loop` off for `downloadModelFiles` — files are fetched one at a time on purpose;
- `unicorn/require-post-message-target-origin` off for the worker and its client — `Worker.postMessage`
  has no target origin;
- `no-console` off for `scripts/` and e2e specs;
- `react-perf/jsx-no-new-*-as-prop` off for specs and `OptionsApp`.

A new override is part of the change that needs it, and the pull request says why.

## 11.5 Type checking

- Two programs: `tsconfig.json` (`src/`, configs, scripts) and `e2e/tsconfig.json` (adds Node and
  WebdriverIO types). `npm run typecheck` runs both.
- `noEmit`: TypeScript checks; Vite and WXT build.
- The compiler settings and what they imply are in [3.1](./TYPESCRIPT_AND_FUNCTIONS.md#31-compiler-settings).

## 11.6 Build

- **WXT** builds the MV3 package from `src/entrypoints/`; `wxt.config.ts` holds the manifest. Every
  manifest entry with a security meaning carries a comment ([10.6](./SECURITY.md#106-permissions-and-the-manifest)).
- **Auto-imports are off** (`imports: false`): every import is written, so module boundaries stay
  visible and the import lint rules mean something.
- **Watch the bundle sizes.** The background should stay small (tens of kB); the worker carries the
  model runtime. A jump in either after a change is a bug until explained
  ([1.5](./PROJECT_STRUCTURE.md#15-barrels)).
- Build output (`.output/`) and generated files (`.wxt/`, `public/ort/`) are never committed.

## 11.7 From idea to merge

1. **Plan with OpenSpec** when the change adds or alters a capability, the protocol, the stored
   shape, or anything in [10.8](./SECURITY.md#108-changes-that-need-a-spec). Propose a change in
   `openspec/changes/<change>/` — `proposal.md`, `design.md`, `tasks.md`, and spec deltas under
   `specs/` — and get it agreed before writing code. A bug fix or a refactor inside existing
   behaviour does not need one.
2. **Branch from `main`**; one change per branch.
3. **Implement** task by task, with specs beside the code.
4. **Fix known deviations in files you touch**, if the fix is small, and delete their lines from
   this guide.
5. **Run `npm run verify`**; add the network run if the model path changed.
6. **Open a pull request** ([11.9](#119-pull-requests)).
7. **After merge, archive the OpenSpec change** so its spec deltas are synced into
   `openspec/specs/`.

`Research Graph Extension Spec.md` is the long-term target, not the current state; `openspec/specs/`
is what has been agreed and built.

## 11.8 Commits

- **Subject: short, imperative, capitalised, no full stop** — `Add popup greeting`,
  `Move config/* types to per-module types.ts`. Under about 70 characters.
- **Body when the why is not obvious**: what changed and why, wrapped at 72 columns, in prose.
- **One logical change per commit.** A rename, a reformat or a deviation sweep does not travel with
  a behaviour change; it is its own commit, so the behaviour change stays reviewable.
- Never commit generated output, secrets, or a failing `verify`.

## 11.9 Pull requests

A pull request description has:

- **What and why** — the change and its motivation, linking the OpenSpec change or issue.
- **Validation** — the commands run and their result (`npm run verify`, and the network run if it
  applies). If something was not run, say so and why.
- **Screenshots** for any visible change, in light and dark.
- **Security note** when anything in [10.8](./SECURITY.md#108-changes-that-need-a-spec) is touched.
- **Bundle note** when a dependency was added or an import moved across a barrel.

## 11.10 Documentation

- **This guide** is the detailed rule set; `AGENTS.md` is the short version that points here. A rule
  change updates both in the same pull request.
- **Markdown files are `UPPER_SNAKE_CASE.md`** ([1.10](./PROJECT_STRUCTURE.md#110-naming-files-and-directories)),
  except names a tool fixes.
- **Code comments carry the why** ([3.10](./TYPESCRIPT_AND_FUNCTIONS.md#310-comments)); the guide
  does not repeat what a module's doc comment already says.
- **Known deviations** are kept current: a fix deletes its line, a newly found one adds it.

## 11.11 Known deviations

Found on 2026-10-09. Fix each when the file is next touched; delete the line when you do.

- `Research Graph Extension Spec.md` and `LLMReserch.md` — see
  [1.12](./PROJECT_STRUCTURE.md#112-known-deviations).
