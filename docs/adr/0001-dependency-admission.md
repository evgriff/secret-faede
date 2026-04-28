# ADR 0001: Dependency Admission Requires A Decision Record

Date: 2026-04-20

## Status

Accepted

## Context

Secret Faeries should stay small and functionality-first. New packages can be
useful, but they also create maintenance, security, bundle, and architectural
cost. The repo already has enough framework surface for the current foundation:
React, Vite, Firebase, SunCalc, Vitest, Playwright, and local scripts.

## Decision

Any new dependency in the root app or Cloud Functions package must be paired
with a `docs/adr/*.md` entry explaining:

- the user-facing or operational need
- why the platform or current stack is insufficient
- why the dependency reduces total code or risk
- expected bundle/runtime impact
- an exit plan if the dependency becomes unnecessary

`npm run quality:deps` enforces this by comparing dependency keys in
`package.json` and `functions/package.json` against the comparison ref. If a new
dependency appears without a changed ADR file, the command fails.

## Consequences

- Package additions remain intentional and visible.
- Script-only package manifest edits do not need an ADR unless they add a
  dependency key.
- If CI cannot resolve the PR base ref, the check falls back to recent git
  history and local working-tree changes.
