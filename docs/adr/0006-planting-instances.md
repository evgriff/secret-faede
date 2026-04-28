# ADR 0006: Planting Instances Inside Arrangement Groups

Date: 2026-04-22

## Status

Accepted

## Context

The redesign requires each plant to be visible and selectable as an individual
node, even when the user adds several plants of the same crop at once. The older
aggregate planting model could imply that "three tomatoes" were one larger
shape instead of three real plants.

Secret Faeries also needs grouped editing, optimizer compatibility, Today/Feed
links, publish/revert safety, and backward compatibility with saved gardens.

## Decision

A saved planting is an arrangement-aware group:

- the parent planting stores shared crop identity, lifecycle, care settings,
  arrangement form, and group center `xFt`/`yFt`
- `instances[]` stores individual plant nodes with their own `id`, label,
  `xFt`, and `yFt`
- `plantCount` is normalized to the number of saved instances
- row, block, cluster, trellis-line, and single forms stay as arrangement
  metadata
- older saved plantings without instances are parsed into deterministic
  feet-based instances instead of losing layout data

Today tasks, Feed entries, harvest logs, watering recommendations, and issue
targets continue to reference the parent planting until instance-level field
operations are intentionally designed.

## Consequences

- Add Plant, Choose Plants, optimizer output, starter templates, demo data, and
  migrations must create or preserve individual instances before saving.
- Moving a parent moves the group; moving one instance updates that node and
  recenters the parent group.
- Any future instance-level operations need a separate contract so they do not
  break existing parent-level Today and Feed links.
