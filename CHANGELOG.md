# Changelog

All notable changes to this project are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.1.0.0] - 2026-05-21

### Added
- `POST /api/frame` endpoint that accepts a `FrameSpec` JSON body (chord or scale) and returns a fully styled SVG. `GET /api/frame` returns a usage example.
- Framework-agnostic rendering core under `src/lib/render/` (types, scaleToChord, postProcess, renderIntoElement, server, textMeasure, browserHost) — shared by both the browser UI and the API.
- Server-side text measurement via `opentype.js` using bundled TTFs for Poppins, Patrick Hand, Caveat, Shadows Into Light, and Inter, so re-anchoring and title auto-shrink work under svgdom.
- Headless Chromium rendering path (`browserHost.ts` + `/render-host` Astro page) for handdrawn-mode SVGs, which `svgdom` can't render cleanly.
- Vitest test suite (15 tests) covering `scaleToChord`, server rendering, and font measurement.
- Public fonts under `public/fonts/` (~2.5 MB) used by both the browser `@font-face` declarations and the server measurement shim.

### Changed
- Slimmed `FretboardChart.tsx` from 198 to 56 lines by delegating to `renderChordInto` from the new lib.
- `ScaleWorkbench.tsx` now imports `frameToChord` / `autoLabelFor` from the lib instead of redefining them.
- Astro switched to `output: 'server'` with the `@astrojs/node` standalone adapter. `src/pages/index.astro` is still prerendered.
- `Dockerfile` now builds on `mcr.microsoft.com/playwright:v1.60.0-jammy` (Chromium pre-installed) and runs `node ./dist/server/entry.mjs` instead of nginx.

### Removed
- `jsdom` dependency (replaced by `svgdom` for SVG rendering and `playwright` for handdrawn).
