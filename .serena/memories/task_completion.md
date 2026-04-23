# Task Completion

Before finishing agent work in this repo:

- Run `git status --short --branch` and report the branch.
- Keep unrelated dirty files unstaged and untouched.
- Run the required verification unless the task is explicitly docs-only or the user narrows the scope: `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run test:e2e`, `npm run build`, and `npm run ci`.
- For Firebase, rules, functions, deployment, or runtime changes, include the relevant targeted scripts from `README.md` and `docs/testing-ci.md`.
- Commit only when the user asks.
- If staging is requested, stage explicit files only; never use `git add .`.
- Summarize changed files, verification commands, and any remaining dirty or untracked files.
