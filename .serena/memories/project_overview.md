# Project Overview

Secret Faede is a small, functionality-first garden plot planner and garden operations app for one real home food garden. The product keeps Firebase email/password auth for exactly two provisioned accounts and routes authenticated users into one shared published garden workspace with private per-user drafts.

Current surface area:

- auth routes for sign-in, access denied, and protected shell entry
- authenticated workspace routes: Plan, Today, Feed, Settings, plus legacy redirects
- Plan as the canvas-first plot editor with first-run setup, crop selection, review, optimizer, publish, and revert
- Today as the generated task and field-action surface
- Feed as notes, issues, photos, harvests, and season summary logging
- Settings as alert defaults, push/local notification preferences, location/timezone, and demo controls
- Firebase-backed weather, notification, media, and garden persistence seams with mock fallbacks
- Cloud Functions for watering and weather alert dispatch, plus tests, CI, and deployment docs

Hard guardrails:

- preserve password auth, the two-account allowlist, and the single shared published workspace model
- keep the real plot editor and practical garden operations as the product center
- do not expand into dashboards, charts, maps, collaboration, lore, AI, carrier messaging, public onboarding, or multi-garden scope
