# model-runtime Specification

## Purpose

Defines how the add-on obtains, pins, verifies and stores local inference models, how it executes them without blocking a user interface, what it guarantees about a model meeting its declared contract before any feature relies on it, and what it reports about the runtime and device that produced each result.

## Requirements

### Requirement: Model identity is pinned to an immutable revision

A model SHALL be recorded against an immutable identifier: for a model downloaded from a model hub, a 40-character commit identifier; for a model served by a local inference server, the content digest the server reports for it. WHEN a user supplies a mutable reference such as a branch name or a model tag, the system SHALL resolve it once at install or registration and SHALL NOT re-resolve it afterwards.

#### Scenario: Mutable reference is resolved at install

- **WHEN** a user installs a model identified by a branch name
- **THEN** the system resolves that branch to a 40-character commit identifier
- **AND** records the model against that identifier rather than the branch name

#### Scenario: Upstream movement does not change an installed model

- **WHEN** the upstream branch a model was installed from advances to a new commit
- **THEN** the installed model still resolves to the commit identifier recorded at install time
- **AND** no files are re-fetched and no re-resolution occurs

#### Scenario: Unresolvable reference fails the install

- **WHEN** the supplied reference cannot be resolved to a commit identifier
- **THEN** the install fails with a reason naming the unresolvable reference
- **AND** no model is recorded as installed

#### Scenario: A local server's model is pinned to its digest

- **WHEN** the user registers `nomic-embed-text:latest` from the local inference server
- **THEN** the model is recorded against the digest the server reports for it
- **AND** WHEN the user later pulls a newer `nomic-embed-text:latest`, the registered model no longer matches and is not used until registered again

### Requirement: Model files are verified before first use

Every downloaded model file SHALL be verified against an expected digest recorded in its manifest before the model is loaded for inference. The manifest SHALL record which algorithm each digest uses. A mismatch SHALL abort the install, remove the partially downloaded files, and leave no installed model behind.

#### Scenario: All digests match

- **WHEN** every downloaded file matches its expected digest
- **THEN** the install completes and the model is listed as installed

#### Scenario: Manifest states how each file is verified

- **WHEN** a manifest is inspected
- **THEN** every file carries both a digest value and the algorithm that produced it
- **AND** no file claims an algorithm whose digest the source did not publish

#### Scenario: A digest does not match

- **WHEN** any downloaded file does not match its expected digest
- **THEN** the install aborts with a reason naming the offending file
- **AND** the partially downloaded files are removed
- **AND** the model is not listed as installed and cannot be loaded

#### Scenario: Verification precedes loading

- **WHEN** a model is loaded for the first time after installation
- **THEN** every one of its files has already been digest-verified

### Requirement: Model acquisition is user-initiated and credential-free

The system SHALL download model files only as the direct result of an explicit user action, and SHALL send no cookies, tokens or user identifiers with those requests.

#### Scenario: Nothing is downloaded unprompted

- **WHEN** the extension is installed and its surfaces are opened
- **THEN** no model file is downloaded until the user asks for a model to be installed

#### Scenario: Requests carry no credentials

- **WHEN** the system downloads a model file
- **THEN** the request carries no cookies, authorization token or user identifier

### Requirement: Inference runs off the user interface thread

Model loading and inference SHALL execute in a worker separate from the main thread of any of the add-on's documents, so a surface stays responsive while a model runs.

#### Scenario: A surface stays responsive during inference

- **WHEN** an inference job runs for several seconds
- **THEN** the surface that requested it continues to respond to input and render progress

#### Scenario: No inference on a document main thread

- **WHEN** inference is requested from any of the add-on's surfaces
- **THEN** the work is performed in a worker rather than on the requesting document's main thread

### Requirement: The runtime reports the compute device it used

Every completed inference SHALL report which compute device produced it, and that device SHALL be recorded alongside the result, because the same model can yield slightly different numeric output on different devices.

#### Scenario: Hardware acceleration is available

- **WHEN** the browser offers hardware-accelerated compute and inference completes
- **THEN** the reported device identifies the accelerated path

#### Scenario: Hardware acceleration is unavailable

- **WHEN** the browser offers no hardware-accelerated compute
- **THEN** inference still completes
- **AND** the reported device identifies the software fallback path rather than claiming acceleration

### Requirement: A model is activated only after passing its family conformance suite

WHEN an install completes, the system SHALL run the conformance suite for that model's family and SHALL refuse to activate a model that fails, surfacing the reason. An unactivated model SHALL NOT be used by any feature.

#### Scenario: Conformance passes

- **WHEN** a freshly installed model passes every conformance probe for its family
- **THEN** the model becomes available for activation

#### Scenario: Conformance fails

- **WHEN** a freshly installed model fails any conformance probe for its family
- **THEN** activation is refused with a reason naming the failed probe
- **AND** no feature can obtain that model

### Requirement: Embedding output matches its declared contract

An embedding model SHALL produce vectors of its declared dimensionality, normalized when it declares normalization, and SHALL be deterministic enough that re-embedding identical input reproduces the vector.

#### Scenario: Dimensionality matches the declaration

- **WHEN** a text is embedded by a model declaring a given dimensionality
- **THEN** the returned vector has exactly that many components

#### Scenario: Normalization matches the declaration

- **WHEN** a model declaring normalized output embeds a text
- **THEN** the returned vector has unit length within tolerance

#### Scenario: Identical input reproduces its vector

- **WHEN** the same text is embedded twice by the same model on the same device
- **THEN** the cosine similarity between the two vectors is at least 0.999

### Requirement: Role prefixes are applied as the model declares

WHEN a model declares distinct prefixes for query and document text, the system SHALL apply the prefix matching the role of the text being embedded. A model declaring no prefixes SHALL receive none.

#### Scenario: A prefix-declaring model distinguishes roles

- **WHEN** the same text is embedded once as a query and once as a document by a model declaring distinct prefixes
- **THEN** the two resulting vectors differ

#### Scenario: A model without prefixes receives none

- **WHEN** a model declaring no prefixes embeds a text
- **THEN** the text reaches the model unmodified

### Requirement: The inference run log is content-free

The system SHALL record, for each inference run, an identifier, the model revision, the device, the duration and the outcome. It SHALL NOT record the text that was processed.

#### Scenario: A run is recorded

- **WHEN** an inference run completes or fails
- **THEN** the log gains an entry with its identifier, model revision, device, duration and outcome

#### Scenario: The log holds no processed text

- **WHEN** the run log is inspected after any number of runs
- **THEN** it contains none of the text that was embedded or generated

### Requirement: Installed models and their disk use are visible

The add-on SHALL show the user which models are installed, the revision each is pinned to, its family, its conformance outcome and how much disk it occupies.

#### Scenario: Installed models are listed

- **WHEN** the user opens the model management surface with at least one model installed
- **THEN** each installed model is listed with its pinned revision, family, conformance outcome and disk use

#### Scenario: Nothing is installed

- **WHEN** the user opens the model management surface with no model installed
- **THEN** the surface states that no model is installed rather than appearing empty or broken

### Requirement: A local inference server can serve a registered model

The options surface SHALL let the user connect to a local inference server, after granting its permission from that click, and list the models the server has. The user SHALL be able to register one of them, and to have the server download a recommended model it lacks, from the user's click only; the extension itself SHALL connect only to the server. A registered model SHALL be inactive until it passes its family's conformance suite run through the server, and SHALL then be usable exactly like a downloaded model. WHEN the server is unreachable, using its model SHALL fail with a reason naming the server, and nothing else SHALL be affected.

#### Scenario: Registering an embedding model

- **GIVEN** the local inference server has `nomic-embed-text` pulled
- **WHEN** the user connects and registers it
- **THEN** it is recorded inactive, with its dimensions and context length from the server
- **AND** activating it runs the embedding conformance suite through the server

#### Scenario: Server not running

- **GIVEN** an active embedding model served by the local inference server
- **WHEN** the server is stopped and a snapshot is to be embedded
- **THEN** the embedding job fails with a reason naming the server, and is retried later
- **AND** the popup says local AI is paused because the server is not running, while pages are still recorded

#### Scenario: Server back

- **GIVEN** embedding jobs that stopped because the local inference server did not answer, including ones out of retries
- **WHEN** the server answers again, the next time a page is captured or the options surface looks at it
- **THEN** those jobs are queued again with their retries restored, and the pages are embedded
- **AND** the popup no longer says local AI is paused

### Requirement: The options surface guides the user through setting up the local inference server

The local inference server SHALL be optional and presented as such: the options surface SHALL keep it in a section the user opens, closed by default unless the server is already connected, and the extension SHALL remain fully usable with an in-extension model or none.

Once the user chooses to set it up, the surface SHALL show the setup as a short checklist in plain language whose steps tick themselves as the extension observes them: install Ollama (with a link to its download page), open it, allow this extension (shown only when the server refuses it), and turn on local AI. Turning on SHALL be one action that, from the user's click, downloads the recommended model through the server if it lacks it, registers it, runs conformance and activates it, showing one progress. WHILE a step is not done, the surface SHALL check again every few seconds without the user reloading. Commands a user would type SHALL be secondary to these steps, never the only way shown.

The setting that admits the extension SHALL name only this extension's own origin, never a wildcard admitting every extension, and SHALL persist across a restart of the computer where the platform allows.

#### Scenario: Optional and closed by default

- **GIVEN** the user never set up the local inference server
- **WHEN** the options surface opens
- **THEN** the local AI section is closed and labelled optional
- **AND** nothing is sent to the server

#### Scenario: Steps tick themselves

- **GIVEN** the user chose to set up the local inference server and granted access
- **WHEN** the user installs and opens Ollama while the surface is open
- **THEN** the install and open steps are marked done within a few seconds, without a reload

#### Scenario: Ollama refuses the extension

- **WHEN** the server answers the extension with a refusal
- **THEN** the checklist shows the "allow this extension" step with one command, ready to copy, that admits only this extension's origin and survives a restart
- **AND** it says in plain language where to paste it and to reopen Ollama afterwards

#### Scenario: Turning on in one action

- **GIVEN** the server is running and admits the extension, and lacks the recommended model
- **WHEN** the user turns on local AI
- **THEN** the model is downloaded through the server, registered, checked and activated, with one progress shown
- **AND** a failure at any stage says which stage failed and why
