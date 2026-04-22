# Source Control Protocol

Date: 2026-04-21

This protocol applies to agentic workflows in this repository.

## Start Of Work

- Run `git status --short --branch`.
- Confirm the active branch before editing.
- Use a `codex/` branch for agent work unless the user requests another branch
  strategy.
- Do not continue substantial edits directly on `main`.

## Dirty Worktree Rules

- Assume pre-existing dirty files are user-owned.
- Do not revert, reset, checkout, overwrite, or reformat unrelated changes.
- If a dirty file must be touched, inspect it first and make the smallest
  compatible edit.
- If unrelated changes make the requested work ambiguous, pause and ask.

## Scope Rules

- Name the intended write set before editing.
- Keep implementation, docs, tests, and visual baseline updates tied to the
  active prompt.
- Do not mix opportunistic cleanup with feature work.
- Avoid new files over 400 lines; split by route, component, domain helper, or
  test concern.

## Parallel Agent Rules

- Assign disjoint file ownership before starting worker agents.
- Tell workers the repo is shared and they must not revert other edits.
- Integrate worker output by reviewing diffs before accepting it.

## Staging And Commits

- Stage explicit files only.
- Do not use broad `git add .`.
- Run relevant verification before staging.
- Commit only when the user asks.
- Keep commits prompt-sized and describe the verification commands run.
- Leave unrelated dirty files unstaged.

## Before Handoff

- Run `git status --short --branch`.
- Summarize changed files, verification, and any remaining dirty/untracked files
  that were not part of the task.
