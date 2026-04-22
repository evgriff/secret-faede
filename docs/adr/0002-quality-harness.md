# ADR 0002: Anti-Slop Quality Harness

Date: 2026-04-20

## Status

Accepted

## Context

The repo is entering larger production-quality work. The next passes need fast
feedback for accidental scope growth, visual drift, bundle creep, and oversized
files before broad feature changes begin.

## Decision

Add a small harness with no new runtime dependencies:

- `npm run quality:deps` blocks new dependency keys unless an ADR changed.
- `npm run quality:files` verifies every source file over 400 LOC is listed in
  `docs/adr/0003-large-file-refactor-targets.md`.
- `npm run quality:bundle` builds the app and writes bundle output to
  `output/bundle-analysis/bundle-summary.md` and `.json`.
- `npm run test:visual:update` captures committed visual baselines for Plan,
  Today, Feed, and Settings at desktop and mobile widths.
- `npm run test:visual` compares the current app against those baselines.

Playwright smoke output and visual diff artifacts go under `output/playwright/`.
Committed screenshot baselines live in `e2e/__screenshots__/`.

## Consequences

- `npm run ci` now includes dependency and large-file checks plus bundle summary
  generation after the build.
- Visual regression is now part of `npm run ci`; baseline updates still require
  human review before refreshed screenshots land.
- Bundle analysis output is generated locally and in CI but is not committed.
