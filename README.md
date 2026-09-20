# The Long Haul Calculator

The official, static calculator for The Long Haul. It runs entirely in the
browser: score records remain in local browser storage unless explicitly
exported as a JSON backup.

## Live site

`https://invalidCards.github.io/long-haul-calculator/`

## Development

Requires Node 22.12 or later and the trainkms submodule:

```bash
git clone --recurse-submodules https://github.com/invalidCards/long-haul-calculator.git
cd long-haul-calculator
npm ci
npm run check
npm run dev
```

`npm run build` writes the static deployment artifact to `dist/`. It contains
no server code and is intentionally not committed.

## Editions

The active edition is the single import in `src/data/active-edition.js`.
Each edition lives under `src/data/editions/<edition-id>/` and contains:

- `edition.json` — display and scoring metadata.
- `station-lists.json` — regions, station lists, types, backups, and aliases.
- `challenges.json` — challenge copy and point options.

Add a new edition as a sibling folder, validate every station against the
generated graph with `npm run data:check`, then deliberately update the active
edition pointer. There is no public edition picker.

## Rail graph

`vendor/trainkms` is a pinned submodule. Run `npm run data:trainkms` only after
intentionally updating that pin; it writes the small, auditable graph snapshot
used by the browser app. A weekly GitHub Actions workflow opens a pull request
for available upstream changes—nothing publishes until that PR is merged.

## GitHub Pages

Before the first deployment, set **Settings → Pages → Build and deployment →
Source** to **GitHub Actions**. The deployment workflow builds the Vite app,
uploads only `dist/`, and deploys that artifact. It sets Vite's `BASE_PATH`
from GitHub Pages metadata, so the project URL works without hard-coded root
paths. Do not select branch-based Pages publishing or commit `dist/`.

Pull requests run checks but never deploy. The `main` deployment uses the
`github-pages` environment and the minimum Pages/OIDC permissions required by
GitHub's artifact deployment flow.
