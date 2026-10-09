# 4. React and UI

The extension has two React surfaces — the toolbar popup and the options page — and no content
scripts that render. Both follow the same shape: an entrypoint mounts a composition root, the root
owns state and talks to the background, and everything it renders is a component that only turns
props into markup.

- [4.1 Who does what](#41-who-does-what)
- [4.2 Components](#42-components)
- [4.3 Props](#43-props)
- [4.4 State](#44-state)
- [4.5 Effects and the background](#45-effects-and-the-background)
- [4.6 JSX](#46-jsx)
- [4.7 Styling with Tailwind](#47-styling-with-tailwind)
- [4.8 Accessibility and copy](#48-accessibility-and-copy)
- [4.9 Test ids](#49-test-ids)
- [4.10 Known deviations](#410-known-deviations)

## 4.1 Who does what

| Layer                               | Renders | Holds state | Talks to the background    | Uses `browser.*` |
| ----------------------------------- | ------- | ----------- | -------------------------- | ---------------- |
| `entrypoints/<surface>/main.tsx`    | mounts  | no          | opens the port             | yes              |
| `app/<surface>App/`                 | yes     | yes         | through an injected client | no               |
| `features/<feature>/ui/<component>` | yes     | no          | no                         | no               |
| `shared/ui/<component>`             | yes     | no          | no                         | no               |

The point of the split: everything below the entrypoint renders and runs in jsdom with no extension
runtime, so the whole surface — clicks, messages, state — is covered by unit tests.

**The entrypoint** mounts the root inside `StrictMode`, fails loudly if the root element is missing,
imports the stylesheet, and adapts the real port to the client interface the root expects:

```tsx
// src/entrypoints/options/main.tsx
const container = document.getElementById("root");

if (container === null) {
  throw new Error("Options root element #root is missing from options.html");
}

const port = browser.runtime.connect();
const client: SurfaceClient = { send: …, subscribe: … };

createRoot(container).render(
  <StrictMode>
    <OptionsApp client={client} />
  </StrictMode>,
);
```

**The composition root** (`PopupApp`, `OptionsApp`) owns the surface's state, sends intents to the
background, and passes plain data down. It takes the connection as a prop typed structurally
(`SurfaceClient`), so a spec hands it a stub.

**A feature component** receives data and renders it. It never sends a message, never reads storage,
never calls `browser.*`, and never imports `shared/rpc`. If a component needs something from the
background, its root asks and passes the answer down.

## 4.2 Components

- **One component per entity**, in `ui/<component>/index.tsx`, exported by name.
- **A function declaration**, PascalCase, named for what it renders (see
  [3.2](./TYPESCRIPT_AND_FUNCTIONS.md#32-functions-are-arrow-constants)):

```tsx
export function InstallProgress({ state }: InstallProgressProps) { … }
```

- **A JSDoc block** says what the component shows and why it shows it that way — the decision a
  later change might undo. `ModelList` explains why the pinned revision is on screen; `PolicyReport`
  explains why an empty list is stated rather than hidden.
- **Helpers go in `utils/`**, like any entity's — a formatting function is not defined in the
  component file (`modelList/utils/getReadableSize`).
- **Values used only by the component** stay in its file as module-level constants:

```tsx
/** How each conformance outcome reads to a person, and how it is coloured. */
const CONFORMANCE_LABELS = {
  pending: { text: "Not yet checked", className: "text-amber-700 dark:text-amber-400" },
  passed: { text: "Passed its checks", className: "text-emerald-700 dark:text-emerald-400" },
  failed: { text: "Failed its checks", className: "text-red-700 dark:text-red-400" },
} as const;
```

- **A component is a pure function of its props.** No module-level mutable state, no reading of
  globals, no side effects during render.
- **Hooks** are allowed only in composition roots for now. A custom hook, when one is needed, is an
  entity named `use…` (the one function prefix React requires) in the `ui/` of the module that owns
  it.

## 4.3 Props

- **`<Component>Props` interface**, declared and exported beside the component.
- **Destructured in the signature**; defaults are given there, not inside the body:

```tsx
export function OptionsApp({ client, profiles = BUNDLED_MODEL_PROFILES }: OptionsAppProps) { … }
```

- **Data in, callbacks out.** Props carry plain data (`readonly` arrays, records), and anything the
  component reports goes out through an `on…` callback. A component does not receive `dispatch` or a
  client.
- **Optional means "not known yet".** An optional prop (`measurement?:`) is one the root may not
  have yet; the component renders that case explicitly — usually as `null` or a "pending" line.
- **Boolean props read as questions**: `isRunning`, `isDisabled` — except native attributes passed
  straight to an element (`disabled`, `checked`).
- **No prop spreading** (`{...props}`) onto elements. Every attribute a component sets is visible in
  its markup.

## 4.4 State

**A surface's state is a reducer.** The root holds it with `useReducer`, and the reducer is a pure
function in the root's `utils/`, tested on its own:

```
app/optionsApp/
├── index.tsx                   # useReducer(reduceOptionsState, INITIAL_OPTIONS_STATE)
└── utils/
    └── reduceOptionsState/
        ├── index.ts            # OptionsState, OptionsEvent, INITIAL_OPTIONS_STATE, reduceOptionsState
        └── index.spec.ts
```

- **Events are a discriminated union** (`OptionsEvent`). Local events are kebab-case
  (`install-requested`); messages from the background keep their RPC type (`model.installed`) and
  are dispatched as they arrive, so the union _is_ the protocol rather than a translation of it.
- **State says what is true, not what to render.** `busy`, `install: { status: "running", … }`,
  `problem?: string` — the markup is derived from it in render.
- **Status fields are unions, not flag sets.** `InstallState` is `idle | running | installed |
  failed`, each with exactly the data it needs; four booleans could express sixteen states, most of
  them impossible.
- **Nothing derived is stored.** If a value can be computed from state during render, compute it.
- **`useState`** is for state local to one interaction inside a component (an open disclosure, a
  text field before submit), never for data that came from the background.

## 4.5 Effects and the background

- **One effect subscribes, and returns its cleanup.** The root subscribes to the client on mount,
  sends its initial requests, and returns the unsubscribe function:

```tsx
useEffect(() => {
  const unsubscribe = client.subscribe((message) => { … });

  client.send(buildRpcMessage("model.list", {}));

  return unsubscribe;
}, [client]);
```

- **Every incoming message is parsed** with the surface's response schemas before it reaches the
  reducer. A message that fails is dropped — one malformed answer must not take the surface down —
  and any other error is rethrown.
- **Follow-up requests are sent from the subscription**, next to the comment that says why
  ("asked after anything that reaches the network, since that is when the policy may have refused
  something").
- **Dependency arrays are exact.** No disabled lint, no missing dependency to make an effect run
  once.
- **Intents are functions in the root** that dispatch the local event and send the request together
  (`requestInstall`, `requestActivation`), so the UI state and the request cannot drift apart.

## 4.6 JSX

- **Early return for whole-component states.** Empty, idle and pending states return before the
  main markup:

```tsx
if (models.length === 0) {
  return <p data-testid="model-list-empty" …>No model is installed yet. …</p>;
}
```

- **Inline conditions use a ternary with `null`, never `&&`.** `count && <List />` renders `0` when
  the count is zero; a ternary cannot.

```tsx
{
  state.problem === undefined ? null : <p data-testid="options-problem">{state.problem}</p>;
}
```

- **No nested ternaries.** A third case is extracted into a variable before `return`, or into a
  helper in `utils/`.
- **Keys are stable identities** from the data — `model.ref`, `profile.repository`, a composite
  like `` `${entry.directive} ${entry.origin}` ``. Never an array index.
- **Event handlers inline only when they are one call**: `onClick={() => requestBenchmark(model.ref)}`.
  Anything longer is a named function in the component.

## 4.7 Styling with Tailwind

- **Utility classes in `className`, nothing else.** No CSS files besides `shared/styles/tailwind.css`,
  no `style={…}`, no CSS-in-JS, no CSS modules.
- **Class strings are written out in full.** Tailwind finds classes by scanning the source, so a
  class assembled from fragments (`` `text-${color}-700` ``) is never generated. A choice between
  styles is a choice between complete strings:

```tsx
const verdict = measurement.meetsBudget
  ? { text: "meets the budget", className: "text-emerald-700 dark:text-emerald-400" }
  : { text: "below the budget", className: "text-red-700 dark:text-red-400" };
```

- **Dark mode follows the operating system** through the `dark:` variant. There is no toggle and no
  stored preference. Every colour class has its `dark:` pair.
- **The palette is small and semantic:**

| Meaning           | Light                       | Dark                             |
| ----------------- | --------------------------- | -------------------------------- |
| Surface           | `bg-white`                  | `dark:bg-slate-900`              |
| Primary text      | `text-slate-900`            | `dark:text-slate-100`            |
| Secondary text    | `text-slate-600`            | `dark:text-slate-400`            |
| Borders           | `border-slate-200` / `-300` | `dark:border-slate-700` / `-600` |
| Success           | `text-emerald-700`          | `dark:text-emerald-400`          |
| Pending / warning | `text-amber-700`            | `dark:text-amber-400`            |
| Failure           | `text-red-700`              | `dark:text-red-400`              |

A new colour needs a meaning that none of these has.

- **Repeated styling becomes a component, not a string constant.** When the same set of classes
  appears on the same kind of element three times, it is a component in `shared/ui/`
  (`Button`), with the classes inside it.

## 4.8 Accessibility and copy

- **Semantic elements first**: `main`, `section` with a heading, `h1`/`h2` in order, `ul`/`li` for
  lists, `dl`/`dt`/`dd` for label–value pairs, `code` for identifiers, `label` around its `input`.
- **Every `button` has `type="button"`** unless it submits a form.
- **Colour is never the only carrier of meaning.** Every coloured state is also named in text
  ("Passed its checks", "below the budget").
- **Disabled controls say why elsewhere on screen** — a busy surface shows what it is busy with.
- **Copy is plain, specific and honest.** Say what happened and what follows from it:
  "Installed. It still has to pass its checks before anything can use it." A failure shows its
  actual reason, not "Something went wrong".
- **Typography:** an ellipsis is `…`, a dash is `—`, numbers carry their unit (`chunks/s`, `s`).
- User-facing text is English, written inline. There is no translation layer yet; when there is,
  this rule changes in the same change.

## 4.9 Test ids

- Every element an e2e spec or a component test needs to find has a `data-testid`, kebab-case and
  scoped by the component (see [2.10](./NAMING.md#210-message-types-events-and-test-ids)).
- **A component's root element carries one**, and each of its distinct states its own:
  `install-running`, `install-installed`, `install-failed`.
- **Per-item ids add the item's identity**: ``data-testid={`activate-${model.ref}`}``.
- Prefer finding by role and text in component tests; a test id is for what has no stable role or
  text, and for e2e.

## 4.10 Known deviations

Found on 2026-10-09. Fix each when the file is next touched; delete the line when you do.

- `InstalledModelSummary.active` and `StoredModel.active` → `isActive`. The stored field needs a
  database migration (see the Storage section), so it moves together with the next schema change.
