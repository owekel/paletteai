# PaletteAI contributor notes

PaletteAI is a React/TypeScript/Vite browser application for personal colour exploration, guided photo capture, and local clothing-colour try-on.

The live site is https://paletteai-sepia.vercel.app. Product context is in [README.md](README.md), [docs/SPEC.md](docs/SPEC.md), [docs/DESIGN_DECISIONS.md](docs/DESIGN_DECISIONS.md), and [docs/AI_DEVELOPMENT.md](docs/AI_DEVELOPMENT.md).

## Working on this codebase

- Preserve the user's existing work and keep changes focused on the requested issue.
- Before altering classification, capture, palettes, or recolouring, read the relevant engineering documentation under `docs/`; don't silently change unrelated numerical policies.
- Keep portraits, local camera test material, access tokens, browser-session traces, and sensitive environment files out of Git. The `tests/local/` folder is ignored for local-only photos.
- Browser processing and local-photo privacy are core product constraints. Do not add remote image analysis, analytics, storage, or external scripts without a deliberate privacy review.
- Don't claim automated software checks establish scientifically validated colour-season accuracy.
- When working on the public website, preserve the distinction between production and access-protected Vercel previews.

## Local development and checks

Use the Node.js version in `.nvmrc` (Node 24) and the existing lockfile.

```sh
npm ci
npm run dev
npm run check
```

`npm run check` runs TypeScript validation, tests, and a production build. `npm run lint` is also TypeScript validation, not a separate ESLint setup. If a command fails, report the actual current failure rather than treating old notes as active issues.

A preview or release should be reviewed for affected functionality as well as passing checks, especially camera operation on real devices, model loading, results, try-on, and privacy behavior.

AI-assisted development is documented transparently in [docs/AI_DEVELOPMENT.md](docs/AI_DEVELOPMENT.md).
