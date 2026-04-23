# Task Completion

Before handoff:

- run `git status --short --branch` and report the final branch plus any remaining dirty or untracked files
- keep unrelated changes untouched and unstaged
- default repo gate from `AGENTS.md`: `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run test:e2e`, `npm run build`, and `npm run ci`
- add targeted checks when relevant, especially `npm run test:integration`, `npm run test:rules`, `npm run test:visual`, `npm run functions:build`, and `npm run functions:test`
- if a verification step cannot run, say exactly why

Git discipline:

- stage explicit files only
- never use broad cleanup or `git add .`
- commit only when the user asks

Serena maintenance:

- after large TypeScript refactors, refresh the Serena index
- keep `.serena/project.yml` and tracked `.serena/memories/` aligned with the repo guardrails and architecture docs
