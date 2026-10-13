# Spec Delta

## MODIFIED Requirements

### Requirement: Interrupted jobs resume from their checkpoint

A running job SHALL be able to record a checkpoint. WHEN the background page loads and finds jobs still marked running, they SHALL return to the queue with their checkpoints kept and without counting a failed attempt. This SHALL happen on every load of the background page, not only after a browser restart or an install.

#### Scenario: Page unloaded mid-job

- **GIVEN** a running job with a checkpoint
- **WHEN** running jobs are requeued on wake
- **THEN** the job is queued, due now, with the same checkpoint and the same attempt count

#### Scenario: Woken by an ordinary event after an unload

- **GIVEN** the background was unloaded while a job was running
- **AND** the browser was not restarted
- **WHEN** the background is next loaded, for any reason
- **THEN** the job is back in the queue before any job is claimed

## ADDED Requirements

### Requirement: A running job keeps the background alive

While a job is running, the background SHALL NOT be unloaded for being idle, whether or not any extension page is open. This SHALL hold for a job that waits on a single answer from the local inference server for longer than the browser's idle timeout. Once no job is running, the background SHALL be free to unload again.

#### Scenario: A long wait with no surface open

- **GIVEN** no popup, options or other extension page is open
- **WHEN** a job waits 90 s on one answer
- **THEN** the background is not unloaded during the wait
- **AND** the job completes

#### Scenario: The queue empties

- **WHEN** the last running job settles and none is due
- **THEN** the background no longer holds itself alive

### Requirement: Due jobs wake the background

WHILE queued jobs remain, the background SHALL schedule a wake-up for the earliest time one becomes due, but no sooner than one minute ahead. WHILE a job is running, a wake-up SHALL be scheduled no more than one minute ahead, so an unload mid-job is recovered. On waking, it SHALL run due jobs. WHEN no job is queued or running, no wake-up SHALL remain scheduled.

#### Scenario: A job interrupted by an unload

- **GIVEN** the background was unloaded with a job running
- **AND** no surface is opened and no browser event occurs
- **WHEN** the scheduled wake-up fires
- **THEN** the job resumes from its checkpoint and completes

#### Scenario: A retry waits for its delay

- **GIVEN** a job queued for a retry 2 minutes from now and no other job
- **WHEN** the wake-up is scheduled
- **THEN** it is set for no earlier than the retry time

#### Scenario: Nothing left to do

- **WHEN** the last queued job completes
- **THEN** no wake-up remains scheduled
