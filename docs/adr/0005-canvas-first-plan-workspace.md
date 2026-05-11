# ADR 0005: Canvas-First Plan Workspace

Date: 2026-04-22

## Status

Accepted

## Context

The canvas-first redesign made Plan the primary test surface. The old Plan shape
allowed side rails, inspectors, and operations panels to compete with the plot
or resize it during ordinary work. That made plant placement feel less stable
than the garden data model actually is.

The app still needs access to selection, planting, structures, Optimize, Review,
sun/climate, measuring, publish, history, and settings. The decision is about
layout ownership, not feature removal.

## Decision

Plan uses a canvas-first workspace:

- the plot viewport remains the stable anchor of the route
- secondary Plan work opens through compact launchers, overlays, docks, modals,
  or mobile bottom sheets
- contextual panels must not change canonical plot geometry or stored feet data
- crop focus, proposal diffs, influence zones, Review, and Optimize explain
  decisions on top of or beside the plot instead of becoming default page
  chrome
- route-owned mobile sheets are capped so the plot remains visible for field use

The Plan scene stays DOM-based. Feet remain canonical; pixels, pan, zoom, and
CSS transforms are rendering details.

## Consequences

- New Plan UI should be judged by whether it preserves plot dominance and
  reduces click/space cost, not by how many controls it exposes at once.
- Persistent sidebars or layout-shifting inspectors are regressions unless a
  later ADR explains why the canvas-first contract changed.
- Browser tests should keep asserting stable plot dimensions for panel and
  walkthrough flows.
