# ai-activity Specification

## Purpose

Tells the user what the local model is doing with their research in the background: whether it is
working, waiting, paused or done, and how far it has got, so that background work is never
mistaken for a broken extension.

## Requirements

### Requirement: The popup always shows what AI is doing once it is set up

WHILE AI is set up, the popup SHALL show an activity strip under its header. The strip SHALL
always be in exactly one state: working, waiting for you, paused or ready. It SHALL NOT be hidden
because nothing is pending. WHILE AI is not set up, the popup SHALL NOT show the strip.

#### Scenario: Nothing is pending

- **GIVEN** AI is set up and no job is queued or running
- **WHEN** the user opens the popup
- **THEN** the strip is shown in the ready state

#### Scenario: AI is not set up

- **GIVEN** AI is not set up
- **WHEN** the user opens the popup
- **THEN** the setup banner is shown and the activity strip is not

### Requirement: The states are chosen in a fixed order

WHEN more than one state applies, the strip SHALL show the first that applies in this order:
paused, working, waiting for you, ready. Paused applies while the local inference server last
failed to answer and work is pending. Working applies while a job runs. Waiting for you applies
while work is pending but none of it may run until the user is away.

#### Scenario: Ollama stops while a job is pending

- **GIVEN** jobs are queued
- **WHEN** a request to the local inference server fails because the server does not answer
- **THEN** the strip shows the paused state

#### Scenario: Generation is held back

- **GIVEN** the only queued jobs generate text and the user is active
- **WHEN** the user opens the popup
- **THEN** the strip shows the waiting-for-you state, not the ready state

### Requirement: The working state names the work and how far the batch has got

In the working state, the strip SHALL name the running job's kind of work in plain words. Job
kinds the user cannot recognize, such as diagnostics, SHALL NOT be shown. It SHALL show the count
of jobs settled in the current batch and the batch's size, with a progress bar filled by that
ratio. A batch starts when work is enqueued while none is pending, and grows with work enqueued
before it empties.

#### Scenario: A batch is under way

- **GIVEN** 12 jobs were enqueued together and 3 have finished
- **WHEN** a job that extracts facts is running
- **THEN** the strip reads "Extracting facts · 3 of 12"
- **AND** the bar is one quarter full

#### Scenario: Work arrives mid-batch

- **GIVEN** a batch of 4 jobs with 2 finished
- **WHEN** 3 more jobs are enqueued
- **THEN** the strip shows 2 of 7

### Requirement: A lone job shows that it is alive

WHEN the current batch is one job, the strip SHALL show a progress bar that moves without
filling, and the time the job has been running, updated at least every second. The percentage of
a single generation is not known, and the strip SHALL NOT invent one.

#### Scenario: One summary is generated

- **GIVEN** a single job that summarizes a topic has run for 40 seconds
- **WHEN** the user looks at the popup
- **THEN** the strip names the work, shows a moving bar and reads about 40 seconds

### Requirement: The paused and waiting states say what is waiting and what to do

In the paused state, the strip SHALL say that the local AI is not answering, how many jobs are
waiting, and offer one action that opens the setup page. In the waiting-for-you state, it SHALL
say that the work runs once the user steps away, and how many jobs are waiting.

#### Scenario: Paused

- **GIVEN** the strip is in the paused state with 5 jobs pending
- **WHEN** the user clicks its action
- **THEN** the setup page opens in a new tab

### Requirement: A pause ends as soon as the local server answers again

A pause SHALL NOT outlast the local inference server's absence. WHEN AI is turned on, and WHEN
the popup shows the paused state, the extension SHALL ask the server once whether it answers. If
it does, the work that waited for it SHALL return to the queue, and the strip SHALL leave the
paused state. The popup SHALL say that AI is paused in one place only: the strip.

#### Scenario: AI is turned on while work waits from an earlier failure

- **GIVEN** jobs that stopped because the local inference server did not answer
- **WHEN** the user turns on AI from the setup page and it finishes
- **THEN** those jobs are queued again
- **AND** the popup does not show the paused state

#### Scenario: The server came back while nothing was captured

- **GIVEN** the strip would show the paused state, and the server answers again
- **WHEN** the user opens the popup
- **THEN** the waiting jobs are queued again and the strip leaves the paused state within 2 seconds

#### Scenario: The server is still away

- **GIVEN** the strip shows the paused state and the server does not answer
- **WHEN** the user opens the popup
- **THEN** the strip stays in the paused state

### Requirement: The ready state reports what AI has done

In the ready state, the strip SHALL say that everything is processed. While a session is active,
it SHALL also say what AI has finished for that session, by kind of work: pages read, pages with
facts extracted, and topics summarized. A kind with nothing finished SHALL be left out.

#### Scenario: A session was processed

- **GIVEN** the active session has 14 pages embedded, 12 with facts extracted and 3 summarized
  topics, and nothing is pending
- **WHEN** the user opens the popup
- **THEN** the strip reads that everything is processed, with "14 pages read · facts from 12 · 3
  summaries"

### Requirement: Failures in the batch are counted, not hidden

WHEN jobs in the current batch have failed for good, the strip SHALL show how many, while the
batch lasts. In the ready state, it SHALL show how much of the active session's work failed for
good and has not been done since. That count SHALL stay until the work is asked for again.

#### Scenario: Two jobs failed

- **GIVEN** a batch in which 2 jobs of the active session failed for good and the rest finished
- **WHEN** the queue empties
- **THEN** the strip shows the ready state with "2 didn't finish"

### Requirement: The strip follows the queue while the popup is open

WHILE the popup is open, the strip SHALL reflect enqueued, started and settled jobs, and AI
pausing or resuming, within 2 seconds, without the popup being reopened. It SHALL show the
current state after the background was unloaded and woke again.

#### Scenario: A job finishes while the popup is open

- **GIVEN** the popup shows "3 of 12"
- **WHEN** the running job finishes
- **THEN** the strip shows "4 of 12" within 2 seconds

### Requirement: The waiting state offers to run the held work now

IN the waiting state, the strip SHALL offer a "Run now" control. WHEN the user presses it, the
jobs held back at that moment SHALL be allowed to run although the user is active. The request
SHALL apply only to those jobs: work enqueued afterwards SHALL still wait until the user is away.
The strip SHALL NOT offer the control in any other state.

#### Scenario: Held work is run on request

- **GIVEN** the only queued jobs generate text, the user is active and the strip is in the waiting state
- **WHEN** the user presses "Run now"
- **THEN** a job starts and the strip leaves the waiting state for the working state

#### Scenario: Work enqueued after the press still waits

- **GIVEN** the user pressed "Run now" and the held jobs have finished
- **WHEN** new text-generation work is enqueued while the user is active
- **THEN** the strip shows the waiting state again and the new work does not run

#### Scenario: The control is absent elsewhere

- **GIVEN** the strip is in the working, paused or ready state
- **WHEN** the user looks at the strip
- **THEN** no "Run now" control is shown

### Requirement: A request to run now survives an unload

A request to run held work now SHALL still apply after the background is unloaded and started again before the work finishes.

#### Scenario: Background restarts mid-request

- **GIVEN** the user pressed "Run now" with several jobs held
- **WHEN** the background is unloaded after the first job and woken again
- **THEN** the remaining jobs that were held at the press still run without a second press
