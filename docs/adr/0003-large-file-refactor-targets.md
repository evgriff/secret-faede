# ADR 0003: Large File Refactor Targets

Date: 2026-04-20

## Status

Accepted

## Context

Files over 400 LOC are allowed only when their boundary and next safe split are
documented. The list must describe files that exist in the active repository,
not retired client implementations.

## Decision

`npm run quality:files` fails when a source file over 400 LOC is missing from
this table. Current oversized files are:

| File                                                      |  LOC | Current responsibility                                                                  | First safe refactor                                                                         |
| --------------------------------------------------------- | ---: | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `scripts/seed-dev.mjs`                                    | 1272 | Builds development Auth/Firestore fixture documents and writes them through Firebase.   | Split fixture construction, catalog lookup, Firestore encoding, and CLI transport.          |
| `scripts/build-home-garden-catalog.mjs`                   | 1138 | Generates the checked-in offline crop catalog from curated bases and variety rules.     | Move base plants, variety banks, and support-rule data into focused checked-in data files.  |
| `src/infrastructure/weather/nwsWeatherProvider.ts`        |  939 | Fetches and normalizes NWS forecast, grid precipitation, alerts, and observations.      | Extract NWS response parsers and local-day precipitation allocation into focused modules.   |
| `scripts/repair-production-garden.mjs`                    |  661 | Plans, backs up, reports, and applies the guarded production data repair workflow.      | Split Firebase REST transport/encoding from repair discovery and plan generation.           |
| `functions/weatherProviderUtils.js`                       |  655 | Normalizes cached provider weather, rain intervals, observations, and daily summaries.  | Split cache/request metadata from forecast, precipitation, and local-day interval helpers.  |
| `src/infrastructure/weather/nwsWeatherProvider.test.ts`   |  420 | Covers NWS requests, forecast/grid parsing, rain allocation, and observation handling.  | Split request/provider behavior from precipitation and local-day normalization fixtures.    |
| `src/v2/routes/feed/feedModel.ts`                         |  409 | Builds, filters, validates, and formats the v2 field-activity stream and composer data. | Extract activity item mapping/formatting from composer validation and filter state helpers. |
| `src/infrastructure/weather/tomorrowIoWeatherProvider.ts` |  407 | Adapts optional Tomorrow.io timelines with normalized forecast and NWS fallback output. | Extract Tomorrow.io payload parsing and daily aggregation from provider orchestration.      |
| `src/v2/routes/feed/FeedPage.module.css`                  |  404 | Styles the v2 Feed layout, composer, activity cards, filters, and responsive states.    | Split composer/filter styles from activity-list and route-layout styles.                    |

## Consequences

- New files crossing 400 LOC require a row or a refactor before merge.
- Rows are removed as soon as a file is split or deleted.
- Refactors preserve the active v2 service seams and deterministic watering
  contracts.
