# Tab Editor — Design Spec

**Date:** 2026-06-03
**Status:** Approved design, pre-implementation
**Branch context:** builds on `feat/render-api`

## Summary

Add a third **Tab** tab to the workbench (alongside Chord and Scale) that lets a
user write guitar tablature in a simple, forgiving text syntax and see it render
live as a native SVG tab staff. The user sets instrument/tuning, key, time
signature, and tempo in the UI; types beats in a dynamic text editor; and the
staff re-renders on every keystroke. A Play button uses `smplr` (MusyngKite
`electric_guitar_jazz` patch) to play the tab back with a moving cursor. SVG/PNG
export reuses the existing export pipeline.

The parsed model is deliberately renderer-agnostic so a **standard-notation
view** can be added later as an alternate renderer over the same data — that is a
future enhancement, not part of v1.

## Goals

- A beginner-friendly tab notation language that is simpler than VexTab/AlphaTex
  but covers durations, triplets, dotted notes, chords, fingerings, rests,
  repeats, and basic techniques.
- Live "render as you type" with no blank flashes: keep the last good render and
  surface parse problems on an inline error line.
- Auto-insert barlines from the time signature (beginner-friendly), with a manual
  `|` override for pickups / incomplete measures.
- Native SVG output consistent with the existing svguitar aesthetic, reusing the
  current fonts, color handling, and SVG/PNG export.
- Audible playback via `smplr`.

## Non-goals (v1)

- Standard music notation rendering (note heads / 5-line staff). The model is
  built to allow it later as an alternate view.
- Chord-name changes printed above the staff. Vertical headroom is reserved for
  them, but they are not parsed or rendered in v1.
- Patches for ukulele. v1 maps patches for guitar and bass (see Playback);
  ukulele falls back to `electric_guitar_jazz`. Tuning drives correct pitch
  regardless.
- Faithful synthesis of techniques (hammer/pull/bend/tap play as plain notes).
- Auto-bar strictness/validation UI (over/under-full measures are drawn as-is).

## Notation language

Beats are separated by **whitespace**. Each beat is split on `:`. If the first
segment is a duration keyword, it sets the duration; the remaining segments are
notes (more than one = a chord). Notes always contain `/` and duration keywords
never do, so the split is unambiguous.

```
q:5/2            quarter note, fret 5, string 2
3/2              fret 3, string 2 — inherits the current duration
e:1/3/2          eighth, finger 3, fret 1, string 2   (finger/fret/string)
q:2/4:3/5:2/6    quarter chord of three notes
ed:5/2           dotted eighth
|                forces a barline early (auto-barlines also inserted by time sig)
r   R            rest (uses current duration)
x   X            repeat the previous beat (expanded at parse time)
(h) (p) (b) (t)  technique on the beat, drawn under the stem
```

### Notes

- `fret/string` or `finger/fret/string`.
- **Strings are numbered 1 = highest-pitch string** (matches svguitar and the
  existing codebase). On the staff the top line is string 1 (high e).
- `finger` is optional and only shown when the fingerings toggle is on.

### Durations (sticky)

The current duration carries forward until changed. Default at the start of a
document is **quarter**.

A duration token is `base [t] [d]`:

- base: `s` sixteenth, `e` eighth, `q` quarter, `h` half, `w` whole
- `t` triplet (e.g. `et` eighth triplet, `qt` quarter triplet)
- `d` dotted (e.g. `ed` dotted eighth, `qd` dotted quarter)

Spelled-out forms are also accepted: `sixteenth`, `eighth`, `quarter`, `half`,
`whole`, with `-triplet` / `dotted-` modifiers (e.g. `dotted-eighth`,
`eighth-triplet`). Triplet + dotted together is permitted by the grammar but
unusual.

### Techniques

`(h)` hammer-on, `(p)` pull-off, `(b)` bend, `(t)` tap — or full words
`hammer pull bend tap`. Rendered as a small label under the stem of the beat it
attaches to. No slur arcs in v1.

### Rests & repeats

- `r` / `R` — rest for the current duration (an empty beat).
- `x` / `X` — repeat the previous beat; expanded to a copy at parse time.

### Barlines

- Auto-inserted: the parser tallies each beat's fractional length and closes a
  measure when it reaches `num/den` of the time signature.
- `|` forces a barline early (marks the measure as `forcedBarline`).
- A measure may be over- or under-full (e.g. pickup); it is drawn as written.

## Parsed model (renderer-agnostic contract)

Consumed by the renderer, the playback scheduler, and the future notation view.

```ts
type Duration = "w" | "h" | "ht" | "q" | "qt" | "e" | "et" | "s" | "st";

type TabNote = { string: number; fret: number; finger?: number };

type Beat = {
  notes: TabNote[];          // empty array = rest
  duration: Duration;
  dotted?: boolean;
  technique?: "h" | "p" | "b" | "t";
  isRest: boolean;
};

type Measure = { beats: Beat[]; forcedBarline: boolean };

type ParseError = { line: number; col?: number; message: string };

type TabDoc = {
  instrument: InstrumentId;
  tuning: string[];
  keySig: string;
  timeSig: { num: number; den: number };
  measures: Measure[];
  errors: ParseError[];
};
```

- `x`/`X` is expanded at parse time (copy of the previous beat).
- Auto-barlines are computed in the parser so the renderer just draws measures.
- Parsing never throws: an unreadable beat appends to `errors` and is skipped;
  the rest of the document still parses.

## Rendering

Split into a pure layout function and a dumb SVG component.

### `layoutTab(doc, opts)` — pure, testable

Turns a `TabDoc` into positioned primitives:

- N horizontal staff lines (one per string), top line = string 1.
- Left edge: tuning letters in place of a clef, plus a stacked `num/den` time
  signature.
- Fret-number glyphs centered on their string's line, with the line knocked out
  behind each digit (white rect) so it reads cleanly.
- Stems hanging below the bottom line; **always-horizontal beams** grouping
  eighths/sixteenths within a beat-group; triplets drawn with a bracket + "3".
- Technique labels under the stems.
- Barlines between measures (final barline heavier).
- Rest glyphs centered on the staff.
- Vertical headroom reserved above the staff for future chord names.
- **Line wrapping:** measures flow left-to-right and wrap to a new system (row)
  when the next measure would overflow the container width; each system repeats
  the tuning letters.

Returns systems with x/y for every primitive plus total width/height. Pure, so
beam grouping, barline placement, and wrapping are unit-tested.

### `<TabStaff>` — dumb React SVG component

Maps the layout primitives to `<line>/<text>/<rect>` SVG JSX. Produces real SVG
in the DOM, so existing `downloadSvgFromContainer` / `downloadPngFromContainer`
export works unchanged.

### Toggles

- **Beams/stems** (default on). Off → pure tab (fret numbers only).
- **Fingerings** (default off). On → render `finger` where present.

Uses Poppins and the existing color handling for visual consistency.

## Playback (`smplr`)

- **`lib/tab/pitch.ts`**: open-string MIDI per instrument (guitar
  `E2 A2 D3 G3 B3 E4`, 4-string bass `E1 A1 D2 G2`, 5-string bass adds low
  `B0` → `B0 E1 A1 D2 G2`, ukulele `G4 C4 E4 A4`); `string + fret → MIDI →
  frequency`.
- **`lib/tab/playback.ts`**: `buildSchedule(doc, bpm)` → ordered
  `{ atSec, durSec, midis[] }`. Quarter = `60/bpm` seconds, scaled by duration,
  ×2/3 for triplets, ×1.5 for dotted. Pure math → unit-tested.
- A thin player wraps `smplr`'s `Soundfont` instrument. The patch is chosen by
  instrument: guitar / guitar-top3 → MusyngKite `electric_guitar_jazz`, bass (4
  or 5 string) → MusyngKite `electric_bass_finger`, ukulele →
  `electric_guitar_jazz` (fallback). It starts the AudioContext on the Play
  click, schedules each beat's notes (chords fire together, rests advance
  silently), and drives a **cursor highlight** over the current beat via
  `requestAnimationFrame` against elapsed time. Techniques play as plain notes in
  v1.

## Files & integration

```
src/lib/tab/types.ts          # Beat / Measure / TabDoc / Duration
src/lib/tab/parse.ts          # parseTab(text, {instrument,key,timeSig}) -> TabDoc
src/lib/tab/pitch.ts          # open-string MIDI, string+fret -> midi -> freq
src/lib/tab/layout.ts         # layoutTab(doc, opts) -> positioned primitives
src/lib/tab/playback.ts       # buildSchedule + smplr player wrapper
src/lib/tab/*.test.ts         # vitest for parse, pitch, layout, playback timing
src/components/TabStaff.tsx    # pure SVG renderer
src/components/TabWorkbench.tsx# controls + editor + preview + play + export
src/components/Workbench.tsx    # add 3rd mode "tab"
```

`TabWorkbench` owns state (raw text, instrument, key, time signature, bpm,
toggles, and — when bass is selected — a 4/5-string choice), re-parses on each
keystroke, shows `doc.errors` on the inline error line, and keeps the last good
layout in the preview. Structure mirrors `ScaleWorkbench`. `Workbench.tsx`'s
`Mode` union gains `"tab"` and a third toggle button.

Bass string count is a dropdown shown only when bass is the instrument; 4 →
`E A D G`, 5 → adds a low `B` (`B E A D G`). Tuning and string count flow into
both the staff (number of lines, tuning letters) and `pitch.ts`. This lives as a
`bass-5` tuning in the tab layer rather than altering the shared `INSTRUMENTS`
map, so the Chord/Scale tabs are untouched.

New dependency: `smplr`.

## Testing

Vitest (already configured) covers:

- **parse**: sticky duration, dotted, triplets, chords, fingerings, rests, `x`
  repeat expansion, forced `|`, auto-barline tally, error collection (no throw).
- **pitch**: open-string MIDI and fret offsets per instrument.
- **layout**: beam grouping, barline positions, line-wrapping counts.
- **playback**: schedule timing math (durations, triplets, dotted, bpm).

Visual correctness is verified by eye on the dev server.

## Future enhancements (explicitly out of v1)

- Standard-notation alternate view over the same `TabDoc`.
- Chord-name changes above the staff.
- A dedicated ukulele patch (uses the guitar patch in v1).
- Technique-aware synthesis (real hammer/pull/bend/tap), slur arcs.
- Optional auto-bar validation/warnings for over/under-full measures.
