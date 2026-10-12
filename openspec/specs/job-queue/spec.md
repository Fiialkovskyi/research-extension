# job-queue Specification

## Purpose
TBD - created by archiving change add-job-queue. Update Purpose after archive.

## Requirements

### Requirement: Jobs are durable and idempotent

Background work SHALL be queued as jobs in the database. A job SHALL be identified by its type, its input hashes and its producer version. Enqueuing work whose job is queued, running or done SHALL NOT add a second job. Enqueuing work whose job failed SHALL queue it again.

#### Scenario: Same work enqueued twice

- **WHEN** an embedding job for the same chunks and model version is enqueued twice
- **THEN** one job exists

#### Scenario: Inputs in another order

- **WHEN** the same job is enqueued with its input hashes in a different order
- **THEN** it is the same job

#### Scenario: Failed job asked for again

- **GIVEN** a job that failed for good
- **WHEN** the same work is enqueued
- **THEN** the job is queued again with no attempts counted

### Requirement: Jobs are claimed by priority, once

The queue SHALL hand out the highest-priority queued job whose retry time has passed, and SHALL mark it running as it does. Two claims at the same time SHALL NOT receive the same job.

#### Scenario: Two claims at once

- **GIVEN** one queued job
- **WHEN** two claims are made at the same time
- **THEN** exactly one of them receives the job

#### Scenario: Retry not yet due

- **GIVEN** a queued job whose next attempt is in the future
- **WHEN** a claim is made
- **THEN** that job is not handed out

### Requirement: Failures retry with backoff, then stay visible

WHEN a job fails, the queue SHALL retry it up to 3 times, each after a longer delay. After the fourth failure the job SHALL stay failed with the reason recorded.

#### Scenario: Fourth failure

- **WHEN** a job fails four times
- **THEN** it is failed with the last reason and is not handed out again

### Requirement: Interrupted jobs resume from their checkpoint

A running job SHALL be able to record a checkpoint. WHEN the background wakes and finds jobs still running, they SHALL return to the queue with their checkpoints kept and without counting a failed attempt.

#### Scenario: Page unloaded mid-job

- **GIVEN** a running job with a checkpoint
- **WHEN** running jobs are requeued on wake
- **THEN** the job is queued, due now, with the same checkpoint and the same attempt count
