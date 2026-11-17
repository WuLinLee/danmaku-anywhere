# Agent context: packages/integration-policy

## Purpose

Schema and utilities for integration policies — defines which sites and features the extension or backend supports/allows. Includes migration logic for schema changes.

## Gotchas

- Published, so the backend can install it from outside this repo. It is set up the same way as `danmaku-model`: `main`/`types` point at `src/index.ts` here, `publishConfig` points the packed package at `dist`, and `zod` is a peer dependency. Add a changeset (`pnpm changeset`) for changes consumers will see
- The extension and the backend can run different versions of this package, so schema changes need a migration rather than an in-place edit
- See `package.json` for available scripts and dependencies
