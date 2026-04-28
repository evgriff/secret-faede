# ADR 0007: CSS-First Motion System

Date: 2026-04-22

## Status

Accepted

## Context

The redesign calls for calmer selection, overlay, drawer, proposal, compose, and
task-confirmation choreography. The app should feel intentional without adding
the maintenance and bundle cost of a broad animation dependency.

## Decision

Secret Faeries uses CSS/native-browser motion first:

- shared duration and easing tokens live in CSS
- overlays use transform and opacity rather than layout-heavy animation
- Plan geometry remains stable while panels open, close, or resize
- motion communicates cause and effect for selection, crop focus, proposal
  preview, compose, and task completion
- `prefers-reduced-motion` removes travel while preserving visible state changes
- a new animation dependency requires a dependency ADR before it lands

Detailed guidance lives in `docs/motion-guidelines.md`.

## Consequences

- Route/component motion should reuse shared tokens instead of inventing local
  timing.
- Visual and e2e tests should disable or tolerate motion where appropriate.
- If future UI needs gesture physics or timeline orchestration beyond CSS, the
  team must document why native browser capabilities are insufficient.
