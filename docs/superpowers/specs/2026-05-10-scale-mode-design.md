# Scale Mode — Design Spec

**Date:** 2026-05-10
**Status:** Approved, pending implementation plan

## Summary

Extend the existing svguitar-based chord builder with a parallel "Scale Mode" for visualizing scales, modes, and melodies on the fretboard. Scale Mode supports multiple dots per string, per-dot labels (note name / scale degree / custom), and an auto-generator that fills a fretboard region with the tones of a chosen key + scale.

The chord builder (`ChordWorkbench`) is unchanged in behavior. Scale Mode ships as a sibling component (`ScaleWorkbench`) sharing a small extracted `FretboardChart` wrapper around svguitar, plus shared SVG/PNG export helpers.

## Goals

- Visualize any scale (major modes, pentatonics, blues, harmonic minor, etc.) in any key on guitar / bass / ukulele.
- Render arbitrary melody / pattern shapes by manually placing dots.
- Keep all existing chord-builder functionality intact.
- Reuse export pipeline (SVG / PNG) and styling conventions from the chord builder.

## Non-goals (v1)

- Audio playback or MIDI export.
- Multiple frames side-by-side on one page.
- GuitarPro / MusicXML export.
- Persisted user-defined scale presets (localStorage).
- A complete CAGED position library beyond the ~5 pentatonic boxes and 7 major modes.

## Architecture

### File layout

| File | Purpose |
|---|---|
| `src/components/FretboardChart.tsx` | **New.** Generic svguitar wrapper. Extracted from current `ChordChart.tsx`. Accepts `Chord` + `ChordSettings`. |
| `src/components/ChordChart.tsx` | Becomes a thin re-export of `FretboardChart` for backward compatibility (or is replaced; see Migration). |
| `src/components/ChordWorkbench.tsx` | Existing chord builder. Refactored only to use the shared export helpers from `scaleExport.ts`. |
| `src/components/ScaleWorkbench.tsx` | **New.** Scale-mode workbench. Same two-column layout convention. |
| `src/lib/scales.ts` | **New.** Scale formulas, position presets, note math, `generateScale()` auto-fill. |
| `src/lib/scaleExport.ts` | **New.** Shared SVG / PNG download helpers (deduplicated from `ChordWorkbench`). |
| `src/pages/index.astro` | Add a top-level mode toggle: Chord / Scale. |

### Mode toggle

`index.astro` renders a tab switcher; the active tab mounts either `<ChordWorkbench />` or `<ScaleWorkbench />`. State does not cross modes — switching tabs resets the workbench to its default. (URL hash sync is out of scope.)

### Why a sibling component, not a mode prop

- The control surfaces diverge significantly: scale mode has no barres, has a scale generator, has a different dot-editing table, and uses absolute frets vs. relative.
- Sharing through `FretboardChart` + `scaleExport.ts` keeps the SVG/export plumbing DRY without coupling unrelated UIs.

## Data model

```ts
// src/lib/scales.ts

export type LabelMode = "note" | "degree" | "none";

export type DotShape = "circle" | "square" | "triangle";

export interface ScaleDot {
  string: number;        // 1 = highest pitch (matches svguitar convention)
  fret: number;          // absolute fret number (not relative to window position)
  label?: string;        // user override; if absent, derived from labelMode
  color?: string;        // user override; if absent, rootColor or noteColor
  shape?: DotShape;      // default "circle"
  isRoot?: boolean;      // true if this fret/string is a tonic of the current key
}

export interface ScaleFrame {
  title: string;
  position: number;      // starting fret of the visible window (svguitar `position`)
  fretSpan: number;      // visible fret count (svguitar `frets`); typical 4–7
  labelMode: LabelMode;
  rootColor: string;     // default "#dc2626" (red-600)
  noteColor: string;     // default "#0a0a0a"
  dots: ScaleDot[];
}
```

### Mapping to svguitar

svguitar's `Chord.fingers` array is `Array<[string, fret, text?]>` and accepts **multiple entries per string**. We project `ScaleFrame.dots` to `fingers` at render time:

- For each `ScaleDot`, push `[d.string, d.fret - position + 1, label]` if `position > 1` else `[d.string, d.fret, label]`.
  - svguitar interprets fret numbers as relative when `position > 1`, absolute when `position === 1`. We normalize to whatever svguitar expects.
- `barres` is always `[]` in scale mode.
- Per-dot color/shape uses svguitar's `FingerOptions` (the 3rd tuple element accepts either a `string` label *or* a `FingerOptions` object: `{ text, color, textColor, shape, strokeColor, strokeWidth }`). svguitar `Shape` enum supports `circle | square | triangle | pentagon`; we expose `circle | square | triangle` in v1. If a `ScaleDot` specifies any override, we emit the object form; otherwise the simple `[string, fret, label?]` tuple.
- `ChordSettings.frets` ← `fretSpan`. `ChordSettings.position` ← `position`.

**Open strings (fret 0):** stored as `fret: 0`. svguitar renders these above the nut. They're allowed in the dot table.

## Auto-generator

### Scale formulas

`src/lib/scales.ts` exports a `SCALES` map of name → semitone intervals from root:

```ts
export const SCALES = {
  major:            [0, 2, 4, 5, 7, 9, 11],
  naturalMinor:     [0, 2, 3, 5, 7, 8, 10],
  harmonicMinor:    [0, 2, 3, 5, 7, 8, 11],
  melodicMinor:     [0, 2, 3, 5, 7, 9, 11],
  dorian:           [0, 2, 3, 5, 7, 9, 10],
  phrygian:         [0, 1, 3, 5, 7, 8, 10],
  lydian:           [0, 2, 4, 6, 7, 9, 11],
  mixolydian:       [0, 2, 4, 5, 7, 9, 10],
  locrian:          [0, 1, 3, 5, 6, 8, 10],
  majorPentatonic:  [0, 2, 4, 7, 9],
  minorPentatonic:  [0, 3, 5, 7, 10],
  blues:            [0, 3, 5, 6, 7, 10],
};
```

### Position presets

`POSITIONS` is keyed by scale name and yields named windows:

```ts
{
  minorPentatonic: [
    { id: "box1", label: "Box 1", offsetFromRoot: 0,  span: 4 },
    { id: "box2", label: "Box 2", offsetFromRoot: 3,  span: 4 },
    // … boxes 3–5
  ],
  major: [
    { id: "ionian",  label: "Ionian (root)",  offsetFromRoot: 0,  span: 5 },
    { id: "dorian",  label: "Dorian shape",   offsetFromRoot: 2,  span: 5 },
    // … remaining modes as positions
  ],
}
```

`offsetFromRoot` is added to the fret of the lowest open-string root to produce the window's starting fret. v1 ships with pentatonic boxes 1–5 and major-scale modal positions; other scales can be added incrementally.

### `generateScale()` API

```ts
export interface GenerateScaleOptions {
  key: NoteName;                      // "A", "C#", "Eb", etc.
  scale: keyof typeof SCALES;
  instrument: InstrumentId;
  mode: "span" | "position";
  fromFret?: number;                  // span mode (inclusive)
  toFret?: number;                    // span mode (inclusive)
  positionId?: string;                // position mode
  stringFilter?: number[];            // optional; if omitted, all strings
  labelMode: LabelMode;
}

export interface GenerateScaleResult {
  dots: ScaleDot[];
  position: number;                   // window start
  fretSpan: number;                   // window length
}
```

**Algorithm:**
1. Compute the active window: `{ position, fretSpan }` from `mode` (span direct, or position lookup adding `offsetFromRoot` to the key's pitch class).
2. Build the set of in-scale pitch classes: `SCALES[scale].map(i => (KEY_PC[key] + i) % 12)`.
3. For each string in `stringFilter` (default = all strings of the instrument):
   - For each fret in `[position, position + fretSpan - 1]` (and `0` if `position === 1`):
     - Compute the note's pitch class from the open-string tuning + fret.
     - If it's in the scale set, push a `ScaleDot`. Mark `isRoot: true` if it's the tonic. Compute `label` per `labelMode`.
4. Return `{ dots, position, fretSpan }`.

`labelMode === "note"` → standard note name (sharp spellings). `"degree"` → "1", "b3", "5", etc. derived from the interval index. `"none"` → omit label.

### Generate vs. Add to existing

The Scale Generator card has two buttons:
- **Generate** — replaces `dots` with the generator output. Also overwrites `position` and `fretSpan`.
- **Add to existing** — merges generator output into current `dots` (deduping by `string + fret`). Leaves `position` / `fretSpan` alone.

## UI

### Layout

`ScaleWorkbench` mirrors `ChordWorkbench`'s two-column grid: controls left (`flex flex-col gap-6`), sticky preview right (`lg:sticky lg:top-6`).

### Cards (top → bottom)

1. **Instrument & Style** — identical to ChordWorkbench (instrument tabs, normal/handdrawn toggle). For `guitar-top3`, the default string filter pre-selects strings 1–3.

2. **Scale Generator**
   - Key (select: 12 chromatic notes with sharp + flat aliases)
   - Scale (select: 12 entries from `SCALES`)
   - Mode toggle: **Span** | **Position**
   - **Span mode:** From-fret (number, min 0) + To-fret (number)
   - **Position mode:** Position select (populated from `POSITIONS[scale]`)
   - String filter (checkbox row, one per string; "all" toggle)
   - Label mode (radio: Note / Degree / None)
   - Root color (color input; default `#dc2626`)
   - Note color (color input; default `#0a0a0a`)
   - **Generate** button (primary), **Add to existing** button (outline)

3. **Dots Editor** — table of current `dots`. Columns:
   - String (number input, 1..stringCount)
   - Fret (number input, 0..)
   - Label (text input; placeholder = auto-derived label)
   - Color (color input; placeholder = root/note default)
   - Shape (select: circle / square / triangle)
   - Root (checkbox)
   - Delete (✕ button)

   **+ Add dot** button at the bottom appends a blank row at string 1, fret current `position`.

4. **Diagram Settings** — analogous to ChordWorkbench: orientation, strings, fret span (replaces `frets`), colors, sizes, fonts. No barres section.

### Preview & export

Identical to ChordWorkbench: SVG preview in a sticky card, SVG + PNG download buttons, JSON debug card. All download logic lives in `src/lib/scaleExport.ts` and is reused by ChordWorkbench.

### Styling conventions

- Tailwind utilities + contextual class names (e.g., `scale-workbench`, `scale-generator-card`, `dots-editor`, `dot-row`).
- Poppins as the primary font.
- Note-text style follows the global SVG note-badge convention from `CLAUDE.md` (Poppins 600, white fill, dark stroke, `paint-order: stroke`). Applied via svguitar's `fingerTextColor` + `fontFamily`. If svguitar's default text rendering ignores stroke/paint-order, a post-render DOM pass on the preview SVG applies the style to dot labels.

## Edge cases

- **Multi-dot collisions on the same fret/string:** allowed; svguitar stacks them. No automatic merge.
- **Empty `dots`:** preview renders an empty fretboard with the configured window.
- **Span mode with fromFret > toFret:** swap before generating; show no error.
- **Position mode with no preset for a scale:** UI hides the Position toggle for that scale (falls back to Span).
- **String filter = empty:** treat as "all strings" (don't render an empty fretboard from a misclick).
- **Label override empty string:** treated as "no label" (auto-label still suppressed) — distinct from `undefined` which means "use auto label".
- **Switching instrument:** clears `dots`, resets `position`/`fretSpan` to instrument defaults.
- **Switching scale or key after generating:** does not auto-regenerate; user must click Generate again. Avoids surprise data loss.

## Migration

- `ChordChart.tsx` is replaced by `FretboardChart.tsx`. The export name `ChordChart` continues to work via `export { FretboardChart as ChordChart }` so existing imports in `ChordWorkbench` keep working without edits.
- Download helpers (`getSvgSource`, `triggerDownload`, `downloadSvg`, `downloadPng`) are moved verbatim from `ChordWorkbench` into `scaleExport.ts`. `ChordWorkbench` imports them. Behavior is unchanged.

## Testing strategy

This project doesn't currently have automated tests. v1 verification is manual:

- Visual regression: render every existing chord preset before and after the refactor; confirm no diff.
- Generator correctness: spot-check 5 scales × 3 keys (e.g., A minor pentatonic box 1, C major in open position, E dorian span 5–9). Confirm note count, root placement, and labels.
- Export: SVG + PNG download on a generated A minor pentatonic; visually inspect.
- Cross-instrument: generate on guitar, bass, and ukulele.

If the project later adopts a test runner, `scales.ts` is pure and easily unit-testable (`generateScale`, `noteFromStringFret`, `pitchClassToName`).

## Open questions / future work

- Persisted scale presets (localStorage).
- Side-by-side comparison frames (e.g., 5 pentatonic boxes on one page).
- Audio preview (Web Audio click-through).
- Richer position library (CAGED for all 12 keys).
- URL state encoding for shareable scale frames.
