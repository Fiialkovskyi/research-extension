## ADDED Requirements

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
