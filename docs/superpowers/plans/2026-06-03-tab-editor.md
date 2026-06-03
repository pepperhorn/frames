# Tab Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a third "Tab" tab to the workbench that parses a simple tab-notation language, renders it live as a native SVG tab staff, and plays it back with `smplr`.

**Architecture:** A pure pipeline — `parseTab(text) → TabDoc → layoutTab() → <TabStaff> SVG`, plus `buildSchedule(doc, bpm) → smplr` for audio. All non-visual logic (parse, durations, pitch, layout, schedule) is pure and unit-tested with vitest; the React components are thin and verified by eye on the dev server. Mirrors the existing `ScaleWorkbench` structure and reuses the existing SVG/PNG export helpers.

**Tech Stack:** Astro + React 19, TypeScript, Tailwind, vitest, `smplr` (Soundfont/MusyngKite), existing `@/lib/scaleExport` for downloads.

---

## File structure

```
src/lib/tab/types.ts          # Duration, TabNote, Beat, Measure, TabDoc, etc. (types only)
src/lib/tab/instruments.ts    # TAB_INSTRUMENTS table: tuning, open-string MIDI, smplr patch
src/lib/tab/durations.ts      # duration fractions + token parsing + measure capacity
src/lib/tab/parse.ts          # parseTab(text, opts) -> TabDoc
src/lib/tab/pitch.ts          # noteToMidi / midiToFreq
src/lib/tab/layout.ts         # layoutTab(doc, opts) -> positioned primitives
src/lib/tab/playback.ts       # buildSchedule(doc, bpm) + createTabPlayer(...) (smplr)
src/lib/tab/*.test.ts         # vitest: durations, parse, pitch, layout, playback timing
src/components/TabStaff.tsx    # pure SVG renderer of a TabLayout
src/components/TabWorkbench.tsx# controls + editor + preview + play + export
src/components/Workbench.tsx    # MODIFY: add "tab" mode
```

Convention used throughout: **string 1 = highest-pitch string** (matches svguitar and the existing code). Tuning arrays and open-MIDI arrays are ordered string 1 → string N (high → low), so index 0 is the top staff line.

---

## Task 1: Install smplr

**Files:**
- Modify: `package.json` (via npm)

- [ ] **Step 1: Install the dependency**

Run: `npm install smplr@^0.26.0`
Expected: `package.json` gains `"smplr": "^0.26.0"` under dependencies; no errors.

- [ ] **Step 2: Verify it resolves**

Run: `node -e "import('smplr').then(m => console.log(typeof m.Soundfont))"`
Expected: prints `function`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add smplr for tab playback"
```

---

## Task 2: Core types

**Files:**
- Create: `src/lib/tab/types.ts`

- [ ] **Step 1: Write the types**

```ts
// src/lib/tab/types.ts

/** Base duration + optional triplet. Dotted is carried separately on Beat. */
export type Duration =
  | "w" | "wt"
  | "h" | "ht"
  | "q" | "qt"
  | "e" | "et"
  | "s" | "st";

export type Technique = "h" | "p" | "b" | "t";

export type TabInstrument = "guitar" | "bass4" | "bass5" | "ukulele";

export interface TabNote {
  string: number; // 1 = highest-pitch string
  fret: number;
  finger?: number;
}

export interface Beat {
  notes: TabNote[]; // empty = rest
  duration: Duration;
  dotted: boolean;
  technique?: Technique;
  isRest: boolean;
}

export interface Measure {
  beats: Beat[];
  forcedBarline: boolean; // true when closed by an explicit "|"
}

export interface ParseError {
  line: number; // 1-based
  message: string;
}

export interface TimeSig {
  num: number;
  den: number;
}

export interface TabDoc {
  instrument: TabInstrument;
  tuning: string[]; // string 1 -> N
  keySig: string;
  timeSig: TimeSig;
  stringCount: number;
  measures: Measure[];
  errors: ParseError[];
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors from this file.

- [ ] **Step 3: Commit**

```bash
git add src/lib/tab/types.ts
git commit -m "feat: tab core types"
```

---

## Task 3: Instruments table

**Files:**
- Create: `src/lib/tab/instruments.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/tab/instruments.test.ts
import { describe, expect, it } from "vitest";
import { TAB_INSTRUMENTS } from "./instruments";

describe("TAB_INSTRUMENTS", () => {
  it("guitar is 6 strings, top line is high E (MIDI 64)", () => {
    const g = TAB_INSTRUMENTS.guitar;
    expect(g.tuning).toEqual(["E", "B", "G", "D", "A", "E"]);
    expect(g.openMidi).toEqual([64, 59, 55, 50, 45, 40]);
    expect(g.patch).toBe("electric_guitar_jazz");
  });

  it("5-string bass adds a low B below the 4-string set", () => {
    expect(TAB_INSTRUMENTS.bass4.openMidi).toEqual([43, 38, 33, 28]);
    expect(TAB_INSTRUMENTS.bass5.openMidi).toEqual([43, 38, 33, 28, 23]);
    expect(TAB_INSTRUMENTS.bass5.patch).toBe("electric_bass_finger");
  });

  it("ukulele uses the banjo patch and reentrant high-G tuning", () => {
    const u = TAB_INSTRUMENTS.ukulele;
    expect(u.openMidi).toEqual([69, 64, 60, 67]);
    expect(u.patch).toBe("banjo");
  });

  it("tuning length always matches openMidi length", () => {
    for (const cfg of Object.values(TAB_INSTRUMENTS)) {
      expect(cfg.tuning.length).toBe(cfg.openMidi.length);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/tab/instruments.test.ts`
Expected: FAIL — cannot find module `./instruments`.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/tab/instruments.ts
import type { TabInstrument } from "./types";

export interface TabInstrumentConfig {
  id: TabInstrument;
  label: string;
  tuning: string[]; // string 1 -> N (high -> low)
  openMidi: number[]; // same order as tuning
  patch: string; // MusyngKite soundfont instrument name
}

export const TAB_INSTRUMENTS: Record<TabInstrument, TabInstrumentConfig> = {
  guitar: {
    id: "guitar",
    label: "Guitar",
    tuning: ["E", "B", "G", "D", "A", "E"],
    openMidi: [64, 59, 55, 50, 45, 40],
    patch: "electric_guitar_jazz",
  },
  bass4: {
    id: "bass4",
    label: "Bass (4)",
    tuning: ["G", "D", "A", "E"],
    openMidi: [43, 38, 33, 28],
    patch: "electric_bass_finger",
  },
  bass5: {
    id: "bass5",
    label: "Bass (5)",
    tuning: ["G", "D", "A", "E", "B"],
    openMidi: [43, 38, 33, 28, 23],
    patch: "electric_bass_finger",
  },
  ukulele: {
    id: "ukulele",
    label: "Ukulele",
    tuning: ["A", "E", "C", "G"],
    openMidi: [69, 64, 60, 67],
    patch: "banjo",
  },
};

export function stringCountFor(instrument: TabInstrument): number {
  return TAB_INSTRUMENTS[instrument].tuning.length;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/tab/instruments.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/tab/instruments.ts src/lib/tab/instruments.test.ts
git commit -m "feat: tab instrument table"
```

---

## Task 4: Durations (fractions, token parsing, capacity)

**Files:**
- Create: `src/lib/tab/durations.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/tab/durations.test.ts
import { describe, expect, it } from "vitest";
import {
  DURATION_FRACTION,
  beatFraction,
  measureCapacity,
  parseDurationToken,
} from "./durations";

describe("durations", () => {
  it("fraction of a whole note per duration", () => {
    expect(DURATION_FRACTION.w).toBeCloseTo(1);
    expect(DURATION_FRACTION.q).toBeCloseTo(1 / 4);
    expect(DURATION_FRACTION.e).toBeCloseTo(1 / 8);
    expect(DURATION_FRACTION.et).toBeCloseTo(1 / 12);
    expect(DURATION_FRACTION.st).toBeCloseTo(1 / 24);
  });

  it("dotted adds half again", () => {
    expect(beatFraction("q", true)).toBeCloseTo(3 / 8);
    expect(beatFraction("e", false)).toBeCloseTo(1 / 8);
  });

  it("measure capacity = num/den", () => {
    expect(measureCapacity({ num: 4, den: 4 })).toBeCloseTo(1);
    expect(measureCapacity({ num: 6, den: 8 })).toBeCloseTo(0.75);
  });

  it("parses shorthand duration tokens", () => {
    expect(parseDurationToken("q")).toEqual({ duration: "q", dotted: false });
    expect(parseDurationToken("ed")).toEqual({ duration: "e", dotted: true });
    expect(parseDurationToken("et")).toEqual({ duration: "et", dotted: false });
    expect(parseDurationToken("std")).toEqual({ duration: "st", dotted: true });
  });

  it("parses spelled-out duration tokens", () => {
    expect(parseDurationToken("eighth")).toEqual({ duration: "e", dotted: false });
    expect(parseDurationToken("dotted-eighth")).toEqual({ duration: "e", dotted: true });
    expect(parseDurationToken("eighth-triplet")).toEqual({ duration: "et", dotted: false });
  });

  it("returns null for non-durations (notes, junk)", () => {
    expect(parseDurationToken("5/2")).toBeNull();
    expect(parseDurationToken("zz")).toBeNull();
    expect(parseDurationToken("")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/tab/durations.test.ts`
Expected: FAIL — cannot find module `./durations`.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/tab/durations.ts
import type { Duration, TimeSig } from "./types";

export const DURATION_FRACTION: Record<Duration, number> = {
  w: 1,
  wt: 2 / 3,
  h: 1 / 2,
  ht: 1 / 3,
  q: 1 / 4,
  qt: 1 / 6,
  e: 1 / 8,
  et: 1 / 12,
  s: 1 / 16,
  st: 1 / 24,
};

export function beatFraction(duration: Duration, dotted: boolean): number {
  return DURATION_FRACTION[duration] * (dotted ? 1.5 : 1);
}

export function measureCapacity(timeSig: TimeSig): number {
  return timeSig.num / timeSig.den;
}

const BASE_LETTER: Record<string, "s" | "e" | "q" | "h" | "w"> = {
  s: "s",
  e: "e",
  q: "q",
  h: "h",
  w: "w",
};

const SPELLED: Record<string, "s" | "e" | "q" | "h" | "w"> = {
  sixteenth: "s",
  eighth: "e",
  quarter: "q",
  half: "h",
  whole: "w",
};

function build(base: "s" | "e" | "q" | "h" | "w", triplet: boolean, dotted: boolean) {
  const duration = (triplet ? `${base}t` : base) as Duration;
  return { duration, dotted };
}

export function parseDurationToken(
  seg: string,
): { duration: Duration; dotted: boolean } | null {
  if (!seg) return null;
  const token = seg.toLowerCase();

  // Shorthand: <base>[t][d]
  const m = /^(s|e|q|h|w)(t)?(d)?$/.exec(token);
  if (m) return build(BASE_LETTER[m[1]], Boolean(m[2]), Boolean(m[3]));

  // Spelled-out: hyphen-separated base + modifiers
  const parts = token.split("-");
  let base: "s" | "e" | "q" | "h" | "w" | null = null;
  let triplet = false;
  let dotted = false;
  for (const p of parts) {
    if (SPELLED[p]) {
      if (base) return null; // two base words = invalid
      base = SPELLED[p];
    } else if (p === "triplet") triplet = true;
    else if (p === "dotted") dotted = true;
    else return null; // unknown word
  }
  if (!base) return null;
  return build(base, triplet, dotted);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/tab/durations.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/tab/durations.ts src/lib/tab/durations.test.ts
git commit -m "feat: tab duration parsing and fractions"
```

---

## Task 5: Pitch mapping

**Files:**
- Create: `src/lib/tab/pitch.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/tab/pitch.test.ts
import { describe, expect, it } from "vitest";
import { noteToMidi, midiToFreq } from "./pitch";

describe("pitch", () => {
  it("open high-E string on guitar is MIDI 64", () => {
    expect(noteToMidi("guitar", { string: 1, fret: 0 })).toBe(64);
  });

  it("fret adds semitones", () => {
    expect(noteToMidi("guitar", { string: 1, fret: 5 })).toBe(69); // A4
    expect(noteToMidi("guitar", { string: 6, fret: 3 })).toBe(43); // G2
  });

  it("5-string bass low B open is MIDI 23", () => {
    expect(noteToMidi("bass5", { string: 5, fret: 0 })).toBe(23);
  });

  it("midiToFreq: A4 = 440Hz", () => {
    expect(midiToFreq(69)).toBeCloseTo(440, 1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/tab/pitch.test.ts`
Expected: FAIL — cannot find module `./pitch`.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/tab/pitch.ts
import { TAB_INSTRUMENTS } from "./instruments";
import type { TabInstrument, TabNote } from "./types";

export function noteToMidi(instrument: TabInstrument, note: TabNote): number {
  const open = TAB_INSTRUMENTS[instrument].openMidi[note.string - 1];
  return open + note.fret;
}

export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/tab/pitch.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/tab/pitch.ts src/lib/tab/pitch.test.ts
git commit -m "feat: tab pitch mapping"
```

---

## Task 6: Parser

**Files:**
- Create: `src/lib/tab/parse.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/tab/parse.test.ts
import { describe, expect, it } from "vitest";
import { parseTab } from "./parse";
import type { TimeSig } from "./types";

const ts: TimeSig = { num: 4, den: 4 };
const opts = { instrument: "guitar" as const, keySig: "C", timeSig: ts };

describe("parseTab", () => {
  it("parses a single note with explicit duration", () => {
    const doc = parseTab("q:5/2", opts);
    expect(doc.errors).toEqual([]);
    const beat = doc.measures[0].beats[0];
    expect(beat.duration).toBe("q");
    expect(beat.notes).toEqual([{ string: 2, fret: 5 }]);
    expect(beat.isRest).toBe(false);
  });

  it("duration is sticky until changed", () => {
    const doc = parseTab("e:5/2 7/2 q:3/1", opts);
    const beats = doc.measures.flatMap((m) => m.beats);
    expect(beats[0].duration).toBe("e");
    expect(beats[1].duration).toBe("e"); // inherited
    expect(beats[2].duration).toBe("q");
  });

  it("default starting duration is quarter", () => {
    const doc = parseTab("5/2", opts);
    expect(doc.measures[0].beats[0].duration).toBe("q");
  });

  it("parses finger/fret/string", () => {
    const doc = parseTab("e:1/3/2", opts);
    expect(doc.measures[0].beats[0].notes).toEqual([
      { string: 2, fret: 3, finger: 1 },
    ]);
  });

  it("parses a chord (colon-joined notes)", () => {
    const doc = parseTab("q:2/4:3/5:2/6", opts);
    expect(doc.measures[0].beats[0].notes).toEqual([
      { string: 4, fret: 2 },
      { string: 5, fret: 3 },
      { string: 6, fret: 2 },
    ]);
  });

  it("parses dotted duration", () => {
    const doc = parseTab("ed:5/2", opts);
    const beat = doc.measures[0].beats[0];
    expect(beat.duration).toBe("e");
    expect(beat.dotted).toBe(true);
  });

  it("rest uses current duration", () => {
    const doc = parseTab("h:r", opts);
    const beat = doc.measures[0].beats[0];
    expect(beat.isRest).toBe(true);
    expect(beat.notes).toEqual([]);
    expect(beat.duration).toBe("h");
  });

  it("x repeats the previous beat", () => {
    const doc = parseTab("q:5/2 x", opts);
    const beats = doc.measures.flatMap((m) => m.beats);
    expect(beats[1].notes).toEqual([{ string: 2, fret: 5 }]);
    expect(beats[1]).not.toBe(beats[0]); // a copy, not the same object
  });

  it("technique token attaches to the previous beat", () => {
    const doc = parseTab("q:5/2 (h)", opts);
    expect(doc.measures.flatMap((m) => m.beats)[0].technique).toBe("h");
  });

  it("auto-bars when a measure fills (4 quarters in 4/4)", () => {
    const doc = parseTab("q:1/1 q:1/1 q:1/1 q:1/1 q:2/1", opts);
    expect(doc.measures.length).toBe(2);
    expect(doc.measures[0].beats.length).toBe(4);
    expect(doc.measures[1].beats.length).toBe(1);
  });

  it("a forced | closes a measure early", () => {
    const doc = parseTab("q:1/1 | q:1/1", opts);
    expect(doc.measures.length).toBe(2);
    expect(doc.measures[0].forcedBarline).toBe(true);
    expect(doc.measures[0].beats.length).toBe(1);
  });

  it("collects errors without throwing and keeps parsing", () => {
    const doc = parseTab("q:5/2 q:9/9/9/9 q:3/1", opts);
    expect(doc.errors.length).toBe(1);
    expect(doc.errors[0].line).toBe(1);
    // the two valid beats still parsed
    expect(doc.measures.flatMap((m) => m.beats).length).toBe(2);
  });

  it("rejects an out-of-range string", () => {
    const doc = parseTab("q:5/9", opts); // guitar has 6 strings
    expect(doc.errors.length).toBe(1);
    expect(doc.measures.flatMap((m) => m.beats).length).toBe(0);
  });

  it("tracks line numbers in errors", () => {
    const doc = parseTab("q:5/2\nq:9/9/9/9", opts);
    expect(doc.errors[0].line).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/tab/parse.test.ts`
Expected: FAIL — cannot find module `./parse`.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/tab/parse.ts
import { beatFraction, measureCapacity, parseDurationToken } from "./durations";
import { stringCountFor, TAB_INSTRUMENTS } from "./instruments";
import type {
  Beat,
  Duration,
  Measure,
  ParseError,
  TabDoc,
  TabInstrument,
  TabNote,
  Technique,
  TimeSig,
} from "./types";

export interface ParseOptions {
  instrument: TabInstrument;
  keySig: string;
  timeSig: TimeSig;
}

const TECHNIQUE_TOKENS: Record<string, Technique> = {
  "(h)": "h",
  "(p)": "p",
  "(b)": "b",
  "(t)": "t",
  hammer: "h",
  pull: "p",
  bend: "b",
  tap: "t",
};

const EPS = 1e-9;

function parseNote(seg: string, stringCount: number): TabNote | null {
  const parts = seg.split("/");
  if (parts.length !== 2 && parts.length !== 3) return null;
  const nums = parts.map((p) => Number(p));
  if (nums.some((n) => !Number.isInteger(n))) return null;

  let finger: number | undefined;
  let fret: number;
  let string: number;
  if (parts.length === 3) {
    [finger, fret, string] = nums;
    if (finger < 1 || finger > 5) return null;
  } else {
    [fret, string] = nums;
  }
  if (fret < 0) return null;
  if (string < 1 || string > stringCount) return null;
  return finger === undefined ? { string, fret } : { string, fret, finger };
}

export function parseTab(text: string, opts: ParseOptions): TabDoc {
  const stringCount = stringCountFor(opts.instrument);
  const capacity = measureCapacity(opts.timeSig);

  const measures: Measure[] = [];
  const errors: ParseError[] = [];

  let curMeasure: Beat[] = [];
  let curFrac = 0;
  let curDuration: Duration = "q";
  let curDotted = false;
  let lastBeat: Beat | null = null;

  function closeMeasure(forced: boolean) {
    if (curMeasure.length === 0) return;
    measures.push({ beats: curMeasure, forcedBarline: forced });
    curMeasure = [];
    curFrac = 0;
  }

  function pushBeat(beat: Beat) {
    curMeasure.push(beat);
    lastBeat = beat;
    curFrac += beatFraction(beat.duration, beat.dotted);
    if (curFrac >= capacity - EPS) closeMeasure(false);
  }

  const lines = text.split("\n");
  lines.forEach((line, idx) => {
    const lineNo = idx + 1;
    const tokens = line.trim().split(/\s+/).filter(Boolean);

    for (const raw of tokens) {
      // Barline
      if (raw === "|") {
        closeMeasure(true);
        continue;
      }
      // Technique attaches to the previous beat
      const tech = TECHNIQUE_TOKENS[raw.toLowerCase()];
      if (tech) {
        if (lastBeat) lastBeat.technique = tech;
        else errors.push({ line: lineNo, message: `technique "${raw}" has no preceding note` });
        continue;
      }
      // Repeat previous beat
      if (raw === "x" || raw === "X") {
        if (!lastBeat) {
          errors.push({ line: lineNo, message: `"${raw}" has no preceding beat to repeat` });
          continue;
        }
        const copy: Beat = {
          notes: lastBeat.notes.map((n) => ({ ...n })),
          duration: lastBeat.duration,
          dotted: lastBeat.dotted,
          technique: lastBeat.technique,
          isRest: lastBeat.isRest,
        };
        pushBeat(copy);
        continue;
      }

      // Beat: colon-split, optional leading duration prefix
      const segs = raw.split(":");
      let rest = segs;
      const dur = parseDurationToken(segs[0]);
      if (dur) {
        curDuration = dur.duration;
        curDotted = dur.dotted;
        rest = segs.slice(1);
      }

      // Rest beat: empty payload or explicit r/R
      if (rest.length === 0 || (rest.length === 1 && (rest[0] === "r" || rest[0] === "R"))) {
        pushBeat({ notes: [], duration: curDuration, dotted: curDotted, isRest: true });
        continue;
      }

      // Note / chord beat
      const notes: TabNote[] = [];
      let ok = true;
      for (const seg of rest) {
        const note = parseNote(seg, stringCount);
        if (!note) {
          errors.push({ line: lineNo, message: `couldn't read "${raw}"` });
          ok = false;
          break;
        }
        notes.push(note);
      }
      if (!ok) continue;
      pushBeat({ notes, duration: curDuration, dotted: curDotted, isRest: false });
    }
  });

  closeMeasure(false);

  return {
    instrument: opts.instrument,
    tuning: TAB_INSTRUMENTS[opts.instrument].tuning,
    keySig: opts.keySig,
    timeSig: opts.timeSig,
    stringCount,
    measures,
    errors,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/tab/parse.test.ts`
Expected: PASS (14 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/tab/parse.ts src/lib/tab/parse.test.ts
git commit -m "feat: tab parser"
```

---

## Task 7: Layout

**Files:**
- Create: `src/lib/tab/layout.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/tab/layout.test.ts
import { describe, expect, it } from "vitest";
import { parseTab } from "./parse";
import { layoutTab, LAYOUT } from "./layout";
import type { TimeSig } from "./types";

const ts: TimeSig = { num: 4, den: 4 };
const opts = { instrument: "guitar" as const, keySig: "C", timeSig: ts };

function layoutFor(src: string, width = 900) {
  const doc = parseTab(src, opts);
  return layoutTab(doc, {
    width,
    tuning: doc.tuning,
    stringCount: doc.stringCount,
    timeSig: doc.timeSig,
    showStems: true,
    showFingerings: false,
  });
}

describe("layoutTab", () => {
  it("places every beat exactly once across systems", () => {
    const src = "q:1/1 q:1/1 q:1/1 q:1/1 q:2/1 q:2/1 q:2/1 q:2/1";
    const placed = layoutFor(src).systems.flatMap((s) => s.beats);
    expect(placed.length).toBe(8);
  });

  it("assigns a unique sequential globalBeatIndex", () => {
    const placed = layoutFor("q:1/1 q:1/1 q:1/1 q:1/1").systems.flatMap((s) => s.beats);
    expect(placed.map((b) => b.globalBeatIndex)).toEqual([0, 1, 2, 3]);
  });

  it("wraps to multiple systems when the width is small", () => {
    // 8 full measures, very narrow target width
    const src = Array(8).fill("q:1/1 q:1/1 q:1/1 q:1/1").join(" ");
    const layout = layoutFor(src, 200);
    expect(layout.systems.length).toBeGreaterThan(1);
  });

  it("draws one barline per completed measure; last is final", () => {
    const layout = layoutFor("q:1/1 q:1/1 q:1/1 q:1/1 q:2/1 q:2/1 q:2/1 q:2/1", 900);
    const barlines = layout.systems.flatMap((s) => s.barlines);
    expect(barlines.length).toBe(2);
    expect(barlines[barlines.length - 1].final).toBe(true);
  });

  it("beams consecutive eighths into one group, broken by a quarter", () => {
    // 2 eighths, a quarter, 2 eighths -> two distinct beam groups, quarter unbeamed
    const beats = layoutFor("e:1/1 1/1 q:1/1 e:1/1 1/1").systems.flatMap((s) => s.beats);
    const groups = beats.map((b) => b.beamGroup);
    expect(groups[0]).not.toBeNull();
    expect(groups[0]).toBe(groups[1]); // first pair shares a group
    expect(groups[2]).toBeNull(); // quarter not beamed
    expect(groups[3]).toBe(groups[4]); // second pair shares a group
    expect(groups[3]).not.toBe(groups[0]); // different group than the first pair
  });

  it("eighth has 1 flag, sixteenth 2, quarter 0", () => {
    const beats = layoutFor("e:1/1 s:1/1 q:1/1").systems.flatMap((s) => s.beats);
    expect(beats.map((b) => b.flags)).toEqual([1, 2, 0]);
  });

  it("groups consecutive triplet beats and tags non-triplets null", () => {
    const beats = layoutFor("et:1/1 1/1 1/1 q:1/1").systems.flatMap((s) => s.beats);
    const tg = beats.map((b) => b.tripletGroup);
    expect(tg[0]).not.toBeNull();
    expect(tg[0]).toBe(tg[1]);
    expect(tg[1]).toBe(tg[2]); // the three eighth-triplets share a group
    expect(tg[3]).toBeNull(); // the quarter is not a triplet
  });

  it("top staff line uses TOP_PAD offset and string spacing", () => {
    const layout = layoutFor("q:1/1");
    const sys = layout.systems[0];
    expect(sys.lineYs.length).toBe(6);
    expect(sys.lineYs[0]).toBe(LAYOUT.TOP_PAD);
    expect(sys.lineYs[1] - sys.lineYs[0]).toBe(LAYOUT.LINE_GAP);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/tab/layout.test.ts`
Expected: FAIL — cannot find module `./layout`.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/tab/layout.ts
import { beatFraction } from "./durations";
import type { Beat, Duration, Measure, TabDoc, Technique, TimeSig } from "./types";

export const LAYOUT = {
  LINE_GAP: 14,
  LEFT_PAD: 48,
  RIGHT_PAD: 16,
  TOP_PAD: 32,
  STEM_LEN: 20,
  SYSTEM_GAP: 72,
  MEASURE_PAD: 16,
  BEAT_MIN_W: 28,
  BEAT_SCALE: 150,
  BOTTOM_PAD: 40,
} as const;

export interface PlacedBeat {
  x: number; // center x of the beat slot
  measureIndex: number;
  globalBeatIndex: number;
  notes: { string: number; fret: number; finger?: number }[];
  duration: Duration;
  dotted: boolean;
  technique?: Technique;
  isRest: boolean;
  beamGroup: number | null; // shared id for beamed runs; null if not beam-eligible
  tripletGroup: number | null; // shared id for consecutive triplet beats; null otherwise
  flags: number; // 0 = quarter or longer, 1 = eighth, 2 = sixteenth
}

export interface PlacedBarline {
  x: number;
  final: boolean;
}

export interface TabSystem {
  yTop: number;
  lineYs: number[];
  lineX0: number;
  lineX1: number;
  beats: PlacedBeat[];
  barlines: PlacedBarline[];
}

export interface TabLayout {
  systems: TabSystem[];
  width: number;
  height: number;
  stringCount: number;
  tuning: string[];
  timeSig: TimeSig;
  showStems: boolean;
  showFingerings: boolean;
}

export interface LayoutOptions {
  width: number;
  tuning: string[];
  stringCount: number;
  timeSig: TimeSig;
  showStems: boolean;
  showFingerings: boolean;
}

function flagsFor(duration: Duration): number {
  const base = duration.endsWith("t") ? duration.slice(0, -1) : duration;
  if (base === "e") return 1;
  if (base === "s") return 2;
  return 0;
}

function beatWidth(beat: Beat): number {
  const frac = beatFraction(beat.duration, beat.dotted);
  return LAYOUT.BEAT_MIN_W + frac * LAYOUT.BEAT_SCALE;
}

function measureWidth(measure: Measure): number {
  const beats = measure.beats.reduce((sum, b) => sum + beatWidth(b), 0);
  return beats + LAYOUT.MEASURE_PAD;
}

export function layoutTab(doc: TabDoc, opts: LayoutOptions): TabLayout {
  const avail = opts.width - LAYOUT.LEFT_PAD - LAYOUT.RIGHT_PAD;
  const staffHeight = (opts.stringCount - 1) * LAYOUT.LINE_GAP;

  // 1. Greedy pack measures into systems by width (always >=1 measure per system).
  const rows: Measure[][] = [];
  let row: Measure[] = [];
  let rowWidth = 0;
  for (const measure of doc.measures) {
    const w = measureWidth(measure);
    if (row.length > 0 && rowWidth + w > avail) {
      rows.push(row);
      row = [];
      rowWidth = 0;
    }
    row.push(measure);
    rowWidth += w;
  }
  if (row.length > 0) rows.push(row);

  // 2. Place beats/barlines per system; assign global indices + beam groups.
  const systems: TabSystem[] = [];
  let globalBeatIndex = 0;
  let beamGroupSeq = 0;
  let tripletGroupSeq = 0;
  const totalMeasures = doc.measures.length;
  let measureCursor = 0;

  rows.forEach((rowMeasures, rowIdx) => {
    const yTop = LAYOUT.TOP_PAD + rowIdx * (staffHeight + LAYOUT.SYSTEM_GAP);
    const lineYs = Array.from({ length: opts.stringCount }, (_, i) => yTop + i * LAYOUT.LINE_GAP);

    const beats: PlacedBeat[] = [];
    const barlines: PlacedBarline[] = [];
    let x = LAYOUT.LEFT_PAD;

    rowMeasures.forEach((measure) => {
      const localMeasureIndex = measureCursor;

      // Beam grouping within this measure: runs of beam-eligible beats,
      // broken by a non-eligible beat or a rest.
      let activeGroup: number | null = null;
      const groupForBeat: (number | null)[] = [];
      measure.beats.forEach((b) => {
        const eligible = !b.isRest && flagsFor(b.duration) > 0;
        if (!eligible) {
          activeGroup = null;
          groupForBeat.push(null);
          return;
        }
        if (activeGroup === null) activeGroup = beamGroupSeq++;
        groupForBeat.push(activeGroup);
      });

      // Triplet grouping: runs of triplet-duration beats (duration ends in "t"),
      // broken by any non-triplet beat. Each run >=1 gets a "3" bracket.
      let activeTriplet: number | null = null;
      const tripletForBeat: (number | null)[] = [];
      measure.beats.forEach((b) => {
        const isTriplet = b.duration.endsWith("t");
        if (!isTriplet) {
          activeTriplet = null;
          tripletForBeat.push(null);
          return;
        }
        if (activeTriplet === null) activeTriplet = tripletGroupSeq++;
        tripletForBeat.push(activeTriplet);
      });

      measure.beats.forEach((b, i) => {
        const w = beatWidth(b);
        beats.push({
          x: x + w / 2,
          measureIndex: localMeasureIndex,
          globalBeatIndex: globalBeatIndex++,
          notes: b.notes,
          duration: b.duration,
          dotted: b.dotted,
          technique: b.technique,
          isRest: b.isRest,
          beamGroup: groupForBeat[i],
          tripletGroup: tripletForBeat[i],
          flags: flagsFor(b.duration),
        });
        x += w;
      });

      const barX = x + LAYOUT.MEASURE_PAD / 2;
      barlines.push({ x: barX, final: localMeasureIndex === totalMeasures - 1 });
      x += LAYOUT.MEASURE_PAD;
      measureCursor += 1;
    });

    systems.push({
      yTop,
      lineYs,
      lineX0: LAYOUT.LEFT_PAD,
      lineX1: x,
      beats,
      barlines,
    });
  });

  const lastSystem = systems[systems.length - 1];
  const height =
    (lastSystem ? lastSystem.yTop + staffHeight : LAYOUT.TOP_PAD) +
    LAYOUT.STEM_LEN +
    LAYOUT.BOTTOM_PAD;

  return {
    systems,
    width: opts.width,
    height,
    stringCount: opts.stringCount,
    tuning: opts.tuning,
    timeSig: opts.timeSig,
    showStems: opts.showStems,
    showFingerings: opts.showFingerings,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/tab/layout.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/tab/layout.ts src/lib/tab/layout.test.ts
git commit -m "feat: tab layout engine"
```

---

## Task 8: Playback schedule + smplr player

**Files:**
- Create: `src/lib/tab/playback.ts`

- [ ] **Step 1: Write the failing test** (timing math only — the smplr player is not unit-tested)

```ts
// src/lib/tab/playback.test.ts
import { describe, expect, it } from "vitest";
import { parseTab } from "./parse";
import { buildSchedule } from "./playback";
import type { TimeSig } from "./types";

const ts: TimeSig = { num: 4, den: 4 };
const opts = { instrument: "guitar" as const, keySig: "C", timeSig: ts };

describe("buildSchedule", () => {
  it("a quarter note at 120bpm lasts 0.5s and starts at 0", () => {
    const sched = buildSchedule(parseTab("q:5/2", opts), 120);
    expect(sched).toHaveLength(1);
    expect(sched[0].atSec).toBeCloseTo(0);
    expect(sched[0].durSec).toBeCloseTo(0.5);
  });

  it("notes start back to back", () => {
    const sched = buildSchedule(parseTab("q:5/2 e:5/2", opts), 120);
    expect(sched[1].atSec).toBeCloseTo(0.5); // after the quarter
    expect(sched[1].durSec).toBeCloseTo(0.25); // eighth
  });

  it("triplet quarter is two-thirds of a quarter", () => {
    const sched = buildSchedule(parseTab("qt:5/2", opts), 120);
    expect(sched[0].durSec).toBeCloseTo(0.5 * (2 / 3));
  });

  it("dotted quarter is 1.5x a quarter", () => {
    const sched = buildSchedule(parseTab("qd:5/2", opts), 120);
    expect(sched[0].durSec).toBeCloseTo(0.75);
  });

  it("a rest advances time but emits no midis", () => {
    const sched = buildSchedule(parseTab("q:r q:5/2", opts), 120);
    expect(sched[0].midis).toEqual([]);
    expect(sched[1].atSec).toBeCloseTo(0.5);
  });

  it("a chord emits one midi per note", () => {
    const sched = buildSchedule(parseTab("q:0/1:0/2:0/3", opts), 120);
    expect(sched[0].midis).toEqual([64, 59, 55]);
  });

  it("carries globalBeatIndex for cursor sync", () => {
    const sched = buildSchedule(parseTab("q:5/2 q:5/2", opts), 120);
    expect(sched.map((s) => s.globalBeatIndex)).toEqual([0, 1]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/tab/playback.test.ts`
Expected: FAIL — cannot find module `./playback`.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/tab/playback.ts
import { Soundfont } from "smplr";
import { beatFraction } from "./durations";
import { TAB_INSTRUMENTS } from "./instruments";
import { noteToMidi } from "./pitch";
import type { TabDoc } from "./types";

export interface ScheduledBeat {
  atSec: number;
  durSec: number;
  midis: number[];
  globalBeatIndex: number;
}

/** Pure timing math — unit tested. quarter = 60/bpm seconds. */
export function buildSchedule(doc: TabDoc, bpm: number): ScheduledBeat[] {
  const quarterSec = 60 / bpm;
  const sched: ScheduledBeat[] = [];
  let t = 0;
  let globalBeatIndex = 0;
  for (const measure of doc.measures) {
    for (const beat of measure.beats) {
      // fraction-of-whole * 4 = number of quarter-notes
      const durSec = beatFraction(beat.duration, beat.dotted) * 4 * quarterSec;
      const midis = beat.isRest
        ? []
        : beat.notes.map((n) => noteToMidi(doc.instrument, n));
      sched.push({ atSec: t, durSec, midis, globalBeatIndex: globalBeatIndex++ });
      t += durSec;
    }
  }
  return sched;
}

export interface TabPlayerHandle {
  stop: () => void;
}

/**
 * Load the right MusyngKite patch, schedule every beat against the AudioContext
 * clock, and drive an onCursor callback for the moving highlight. Must be called
 * from a user gesture (Play click) so the AudioContext can start.
 */
export async function createTabPlayer(
  doc: TabDoc,
  bpm: number,
  callbacks: { onCursor: (globalBeatIndex: number) => void; onEnd: () => void },
): Promise<TabPlayerHandle> {
  const context = new AudioContext();
  await context.resume();

  const patch = TAB_INSTRUMENTS[doc.instrument].patch;
  const instrument = Soundfont(context, { instrument: patch });
  await instrument.load;

  const sched = buildSchedule(doc, bpm);
  const start = context.currentTime + 0.1;
  let stopped = false;
  const timers: ReturnType<typeof setTimeout>[] = [];

  for (const beat of sched) {
    for (const midi of beat.midis) {
      instrument.start({
        note: midi,
        time: start + beat.atSec,
        duration: beat.durSec,
      });
    }
    // Cursor highlight, driven off wall-clock relative to audio start.
    timers.push(
      setTimeout(() => {
        if (!stopped) callbacks.onCursor(beat.globalBeatIndex);
      }, beat.atSec * 1000 + 100),
    );
  }

  const totalMs =
    (sched.length ? sched[sched.length - 1].atSec + sched[sched.length - 1].durSec : 0) * 1000 +
    150;
  timers.push(
    setTimeout(() => {
      if (!stopped) callbacks.onEnd();
    }, totalMs),
  );

  return {
    stop: () => {
      stopped = true;
      timers.forEach(clearTimeout);
      instrument.stop();
      void context.close();
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/tab/playback.test.ts`
Expected: PASS (7 tests). (Importing `smplr` at module top is fine — vitest only calls `buildSchedule`, never `createTabPlayer`.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/tab/playback.ts src/lib/tab/playback.test.ts
git commit -m "feat: tab playback schedule and smplr player"
```

---

## Task 9: TabStaff SVG renderer

**Files:**
- Create: `src/components/TabStaff.tsx`

This is a pure presentational component (no unit test — verified by eye in Task 11). It draws a `TabLayout` to SVG.

- [ ] **Step 1: Write the component**

```tsx
// src/components/TabStaff.tsx
import type { ReactElement } from "react";
import { LAYOUT, type PlacedBeat, type TabLayout, type TabSystem } from "@/lib/tab/layout";

interface TabStaffProps {
  layout: TabLayout;
  cursorIndex?: number | null;
  fontFamily?: string;
  color?: string;
  backgroundColor?: string;
  className?: string;
}

const NUMBER_FONT_SIZE = 13;
const TUNING_FONT_SIZE = 11;

export function TabStaff({
  layout,
  cursorIndex = null,
  fontFamily = "Poppins, sans-serif",
  color = "#0a0a0a",
  backgroundColor = "transparent",
  className,
}: TabStaffProps) {
  return (
    <svg
      className={className}
      width={layout.width}
      height={layout.height}
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      xmlns="http://www.w3.org/2000/svg"
      style={{ fontFamily }}
    >
      <rect x={0} y={0} width={layout.width} height={layout.height} fill={backgroundColor} />
      {layout.systems.map((sys, i) => (
        <SystemView
          key={i}
          sys={sys}
          layout={layout}
          showTimeSig={i === 0}
          stemBaseY={sys.lineYs[layout.stringCount - 1]}
          color={color}
          cursorIndex={cursorIndex}
          fontFamily={fontFamily}
        />
      ))}
    </svg>
  );
}

function SystemView({
  sys,
  layout,
  showTimeSig,
  stemBaseY,
  color,
  cursorIndex,
  fontFamily,
}: {
  sys: TabSystem;
  layout: TabLayout;
  showTimeSig: boolean;
  stemBaseY: number;
  color: string;
  cursorIndex: number | null;
  fontFamily: string;
}) {
  const beamY = stemBaseY + LAYOUT.STEM_LEN;
  return (
    <g className="tab-system">
      {/* Staff lines */}
      {sys.lineYs.map((y, i) => (
        <line
          key={`line-${i}`}
          x1={sys.lineX0}
          y1={y}
          x2={sys.lineX1}
          y2={y}
          stroke={color}
          strokeWidth={1}
        />
      ))}

      {/* Tuning letters (clef substitute) */}
      {layout.tuning.map((t, i) => (
        <text
          key={`tuning-${i}`}
          x={10}
          y={sys.lineYs[i]}
          fontSize={TUNING_FONT_SIZE}
          fontFamily={fontFamily}
          fontWeight={600}
          fill={color}
          textAnchor="middle"
          dominantBaseline="central"
        >
          {t}
        </text>
      ))}

      {/* Time signature on the first system */}
      {showTimeSig && (
        <g className="tab-timesig">
          <text x={30} y={sys.lineYs[Math.floor(layout.stringCount / 2) - 1] ?? sys.lineYs[0]}
            fontSize={16} fontWeight={700} fill={color} textAnchor="middle" dominantBaseline="central">
            {layout.timeSig.num}
          </text>
          <text x={30} y={sys.lineYs[Math.ceil(layout.stringCount / 2)] ?? sys.lineYs[1]}
            fontSize={16} fontWeight={700} fill={color} textAnchor="middle" dominantBaseline="central">
            {layout.timeSig.den}
          </text>
        </g>
      )}

      {/* Barlines */}
      {sys.barlines.map((bar, i) => (
        <line
          key={`bar-${i}`}
          x1={bar.x}
          y1={sys.lineYs[0]}
          x2={bar.x}
          y2={sys.lineYs[layout.stringCount - 1]}
          stroke={color}
          strokeWidth={bar.final ? 3 : 1.5}
        />
      ))}

      {/* Beats */}
      {sys.beats.map((beat) => (
        <BeatView
          key={beat.globalBeatIndex}
          beat={beat}
          sys={sys}
          layout={layout}
          stemBaseY={stemBaseY}
          color={color}
          fontFamily={fontFamily}
          highlighted={cursorIndex === beat.globalBeatIndex}
        />
      ))}

      {/* Beams (one horizontal line per multi-note group) */}
      {layout.showStems && drawBeams(sys, beamY, color)}

      {/* Triplet brackets with a "3" */}
      {layout.showStems && drawTriplets(sys, beamY, color, fontFamily)}
    </g>
  );
}

function drawTriplets(sys: TabSystem, beamY: number, color: string, fontFamily: string) {
  const groups = new Map<number, PlacedBeat[]>();
  for (const b of sys.beats) {
    if (b.tripletGroup === null) continue;
    const arr = groups.get(b.tripletGroup) ?? [];
    arr.push(b);
    groups.set(b.tripletGroup, arr);
  }
  const out: ReactElement[] = [];
  const y = beamY + 9; // just below the beam/flag row
  for (const [id, members] of groups) {
    const x0 = members[0].x;
    const x1 = members[members.length - 1].x;
    const mid = (x0 + x1) / 2;
    // light bracket
    out.push(
      <path
        key={`trip-${id}`}
        d={`M ${x0} ${y - 3} L ${x0} ${y} L ${mid - 5} ${y} M ${mid + 5} ${y} L ${x1} ${y} L ${x1} ${y - 3}`}
        stroke={color}
        strokeWidth={0.8}
        fill="none"
      />,
    );
    out.push(
      <text
        key={`trip-label-${id}`}
        x={mid}
        y={y}
        fontSize={9}
        fontFamily={fontFamily}
        fontStyle="italic"
        fill={color}
        textAnchor="middle"
        dominantBaseline="central"
      >
        3
      </text>,
    );
  }
  return out;
}

function drawBeams(sys: TabSystem, beamY: number, color: string) {
  const groups = new Map<number, PlacedBeat[]>();
  for (const b of sys.beats) {
    if (b.beamGroup === null || b.isRest) continue;
    const arr = groups.get(b.beamGroup) ?? [];
    arr.push(b);
    groups.set(b.beamGroup, arr);
  }
  const out: ReactElement[] = [];
  for (const [id, members] of groups) {
    if (members.length < 2) continue; // singletons get a flag in BeatView
    const x0 = members[0].x;
    const x1 = members[members.length - 1].x;
    const maxFlags = Math.max(...members.map((m) => m.flags));
    for (let f = 0; f < maxFlags; f++) {
      out.push(
        <line
          key={`beam-${id}-${f}`}
          x1={x0}
          y1={beamY - f * 5}
          x2={x1}
          y2={beamY - f * 5}
          stroke={color}
          strokeWidth={3}
        />,
      );
    }
  }
  return out;
}

function BeatView({
  beat,
  sys,
  layout,
  stemBaseY,
  color,
  fontFamily,
  highlighted,
}: {
  beat: PlacedBeat;
  sys: TabSystem;
  layout: TabLayout;
  stemBaseY: number;
  color: string;
  fontFamily: string;
  highlighted: boolean;
}) {
  const beamY = stemBaseY + LAYOUT.STEM_LEN;
  const isFlaggedSingleton =
    layout.showStems && beat.beamGroup !== null && !beat.isRest && isSingleton(sys, beat);

  return (
    <g className="tab-beat">
      {highlighted && (
        <rect
          x={beat.x - 10}
          y={sys.lineYs[0] - 8}
          width={20}
          height={(layout.stringCount - 1) * LAYOUT.LINE_GAP + 16}
          fill="#3b82f6"
          opacity={0.15}
          rx={3}
        />
      )}

      {beat.isRest ? (
        <text
          x={beat.x}
          y={sys.lineYs[Math.floor(layout.stringCount / 2)]}
          fontSize={NUMBER_FONT_SIZE}
          fontFamily={fontFamily}
          fontStyle="italic"
          fill={color}
          textAnchor="middle"
          dominantBaseline="central"
        >
          𝄽
        </text>
      ) : (
        beat.notes.map((n, i) => {
          const y = sys.lineYs[n.string - 1];
          return (
            <g key={i} className="tab-note">
              {/* knock out the staff line behind the number */}
              <rect
                x={beat.x - 7}
                y={y - 8}
                width={14}
                height={16}
                fill={layoutBg(layout)}
              />
              <text
                x={beat.x}
                y={y}
                fontSize={NUMBER_FONT_SIZE}
                fontFamily={fontFamily}
                fontWeight={600}
                fill={color}
                textAnchor="middle"
                dominantBaseline="central"
              >
                {n.fret}
              </text>
              {layout.showFingerings && n.finger && (
                <text
                  x={beat.x + 9}
                  y={y - 7}
                  fontSize={9}
                  fontFamily={fontFamily}
                  fill={color}
                  textAnchor="middle"
                  dominantBaseline="central"
                >
                  {n.finger}
                </text>
              )}
            </g>
          );
        })
      )}

      {/* Stem */}
      {layout.showStems && !beat.isRest && beat.duration !== "w" && beat.duration !== "wt" && (
        <line
          x1={beat.x}
          y1={stemBaseY}
          x2={beat.x}
          y2={beamY}
          stroke={color}
          strokeWidth={1.5}
        />
      )}

      {/* Flag for an un-beamed eighth/sixteenth */}
      {isFlaggedSingleton &&
        Array.from({ length: beat.flags }).map((_, f) => (
          <line
            key={`flag-${f}`}
            x1={beat.x}
            y1={beamY - f * 5}
            x2={beat.x + 7}
            y2={beamY - f * 5}
            stroke={color}
            strokeWidth={3}
          />
        ))}

      {/* Dot for dotted durations */}
      {layout.showStems && beat.dotted && !beat.isRest && (
        <circle cx={beat.x + 6} cy={stemBaseY + 3} r={1.6} fill={color} />
      )}

      {/* Technique label under the stem */}
      {beat.technique && (
        <text
          x={beat.x}
          y={beamY + 12}
          fontSize={10}
          fontFamily={fontFamily}
          fontStyle="italic"
          fill={color}
          textAnchor="middle"
          dominantBaseline="central"
        >
          {beat.technique.toUpperCase()}
        </text>
      )}
    </g>
  );
}

function isSingleton(sys: TabSystem, beat: PlacedBeat): boolean {
  if (beat.beamGroup === null) return false;
  return sys.beats.filter((b) => b.beamGroup === beat.beamGroup && !b.isRest).length === 1;
}

function layoutBg(layout: TabLayout): string {
  // Numbers sit on lines; knock the line out with the page background. We use
  // white as a safe default — the preview card background is white.
  return "#ffffff";
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/TabStaff.tsx
git commit -m "feat: TabStaff SVG renderer"
```

---

## Task 10: TabWorkbench

**Files:**
- Create: `src/components/TabWorkbench.tsx`

Owns all UI state, parses on each keystroke, keeps the last good layout, plays back, and exports. Reuses existing `Card`, `Button`, `Input`, `Label`, `Select`, and the export helpers.

- [ ] **Step 1: Write the component**

```tsx
// src/components/TabWorkbench.tsx
import { useMemo, useRef, useState } from "react";
import { TabStaff } from "./TabStaff";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select } from "./ui/select";
import { parseTab } from "@/lib/tab/parse";
import { layoutTab, type TabLayout } from "@/lib/tab/layout";
import { createTabPlayer, type TabPlayerHandle } from "@/lib/tab/playback";
import { TAB_INSTRUMENTS } from "@/lib/tab/instruments";
import type { TabInstrument } from "@/lib/tab/types";
import {
  downloadPngFromContainer,
  downloadSvgFromContainer,
  safeFilename,
} from "@/lib/scaleExport";

type InstrumentUi = "guitar" | "bass" | "ukulele";

const KEYS = ["C", "G", "D", "A", "E", "B", "F#", "F", "Bb", "Eb", "Ab", "Db"];
const TIME_SIGS = ["4/4", "3/4", "2/4", "6/8", "12/8"];

const SAMPLE = `q:0/3 e:0/2 0/1 q:1/2 | h:2/3 q:r q:3/4
e:0/1 0/2 (h) q:2/2 q:3/2`;

export function TabWorkbench() {
  const [text, setText] = useState(SAMPLE);
  const [instrumentUi, setInstrumentUi] = useState<InstrumentUi>("guitar");
  const [bassStrings, setBassStrings] = useState<4 | 5>(4);
  const [keySig, setKeySig] = useState("C");
  const [timeSigStr, setTimeSigStr] = useState("4/4");
  const [bpm, setBpm] = useState(96);
  const [showStems, setShowStems] = useState(true);
  const [showFingerings, setShowFingerings] = useState(false);
  const [cursorIndex, setCursorIndex] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);

  const instrument: TabInstrument =
    instrumentUi === "guitar"
      ? "guitar"
      : instrumentUi === "ukulele"
      ? "ukulele"
      : bassStrings === 5
      ? "bass5"
      : "bass4";

  const timeSig = useMemo(() => {
    const [num, den] = timeSigStr.split("/").map(Number);
    return { num, den };
  }, [timeSigStr]);

  const doc = useMemo(
    () => parseTab(text, { instrument, keySig, timeSig }),
    [text, instrument, keySig, timeSig],
  );

  // Keep the last layout that had no parse errors so the preview never blanks.
  const lastGood = useRef<TabLayout | null>(null);
  const layout = useMemo(() => {
    const l = layoutTab(doc, {
      width: 880,
      tuning: doc.tuning,
      stringCount: doc.stringCount,
      timeSig: doc.timeSig,
      showStems,
      showFingerings,
    });
    if (doc.errors.length === 0) lastGood.current = l;
    return doc.errors.length === 0 ? l : lastGood.current ?? l;
  }, [doc, showStems, showFingerings]);

  const playerRef = useRef<TabPlayerHandle | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);

  const stop = () => {
    playerRef.current?.stop();
    playerRef.current = null;
    setPlaying(false);
    setCursorIndex(null);
  };

  const play = async () => {
    stop();
    setPlaying(true);
    playerRef.current = await createTabPlayer(doc, bpm, {
      onCursor: (i) => setCursorIndex(i),
      onEnd: () => stop(),
    });
  };

  const filename = (ext: string) => safeFilename(["tab", TAB_INSTRUMENTS[instrument].label], ext);
  const downloadSvg = () => downloadSvgFromContainer(previewRef.current, filename("svg"));
  const downloadPng = () =>
    downloadPngFromContainer(previewRef.current, filename("png"), { backgroundColor: "#ffffff" });

  return (
    <div className="tab-workbench grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,520px)]">
      <div className="tab-controls flex flex-col gap-6">
        <Card className="tab-setup-card">
          <CardHeader>
            <CardTitle className="text-lg">Instrument & Time</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="instrument-tabs flex flex-wrap gap-2">
              {(["guitar", "bass", "ukulele"] as InstrumentUi[]).map((id) => (
                <Button
                  key={id}
                  variant={id === instrumentUi ? "default" : "outline"}
                  size="sm"
                  onClick={() => setInstrumentUi(id)}
                >
                  {id[0].toUpperCase() + id.slice(1)}
                </Button>
              ))}
              {instrumentUi === "bass" && (
                <Select
                  value={String(bassStrings)}
                  onChange={(e) => setBassStrings(Number(e.target.value) as 4 | 5)}
                >
                  <option value="4">4-string</option>
                  <option value="5">5-string</option>
                </Select>
              )}
            </div>
            <div className="setup-grid grid grid-cols-3 gap-3">
              <Label>
                <span>Key</span>
                <Select value={keySig} onChange={(e) => setKeySig(e.target.value)}>
                  {KEYS.map((k) => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </Select>
              </Label>
              <Label>
                <span>Time</span>
                <Select value={timeSigStr} onChange={(e) => setTimeSigStr(e.target.value)}>
                  {TIME_SIGS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </Select>
              </Label>
              <Label>
                <span>Tempo (BPM)</span>
                <Input
                  type="number"
                  min={30}
                  max={300}
                  value={bpm}
                  onChange={(e) => setBpm(Math.max(30, Number(e.target.value) || 96))}
                />
              </Label>
            </div>
            <div className="toggles flex flex-wrap gap-2 items-center pt-2 border-t">
              <Button
                variant={showStems ? "default" : "outline"}
                size="sm"
                onClick={() => setShowStems((s) => !s)}
              >
                Beams/stems: {showStems ? "on" : "off"}
              </Button>
              <Button
                variant={showFingerings ? "default" : "outline"}
                size="sm"
                onClick={() => setShowFingerings((s) => !s)}
              >
                Fingerings: {showFingerings ? "on" : "off"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="tab-editor-card">
          <CardHeader>
            <CardTitle className="text-lg">Tab</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <textarea
              className="tab-editor-textarea w-full min-h-[220px] rounded-md border p-3 font-mono text-sm"
              value={text}
              spellCheck={false}
              onChange={(e) => setText(e.target.value)}
            />
            {doc.errors.length > 0 ? (
              <div className="tab-errors text-xs text-red-600">
                {doc.errors.map((err, i) => (
                  <div key={i}>line {err.line}: {err.message}</div>
                ))}
              </div>
            ) : (
              <div className="tab-help text-xs text-muted-foreground">
                e.g. <code>q:5/2</code> note · <code>q:2/4:3/5</code> chord ·{" "}
                <code>ed:</code> dotted · <code>(h)</code> hammer · <code>r</code> rest ·{" "}
                <code>x</code> repeat · <code>|</code> barline
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="tab-preview lg:sticky lg:top-6 self-start flex flex-col gap-4">
        <Card className="preview-card">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-lg">Preview</CardTitle>
            <div className="preview-actions flex gap-2">
              {playing ? (
                <Button size="sm" variant="outline" onClick={stop} className="stop-btn">
                  Stop
                </Button>
              ) : (
                <Button size="sm" onClick={play} className="play-btn">
                  ▶ Play
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={downloadSvg} className="download-svg-btn">
                SVG
              </Button>
              <Button size="sm" variant="outline" onClick={downloadPng} className="download-png-btn">
                PNG
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div ref={previewRef} className="preview-svg-wrap overflow-x-auto bg-white rounded">
              <TabStaff layout={layout} cursorIndex={cursorIndex} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/TabWorkbench.tsx
git commit -m "feat: TabWorkbench UI"
```

---

## Task 11: Wire the third tab + manual verification

**Files:**
- Modify: `src/components/Workbench.tsx`

- [ ] **Step 1: Add the "tab" mode**

Replace the contents of `src/components/Workbench.tsx` with:

```tsx
import { useState } from "react";
import { ChordWorkbench } from "./ChordWorkbench";
import { ScaleWorkbench } from "./ScaleWorkbench";
import { TabWorkbench } from "./TabWorkbench";
import { Button } from "./ui/button";

type Mode = "chord" | "scale" | "tab";

export function Workbench() {
  const [mode, setMode] = useState<Mode>("chord");
  return (
    <div className="workbench-root flex flex-col gap-6">
      <div className="mode-toggle flex gap-2 items-center">
        <span className="mode-label text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Mode
        </span>
        <Button variant={mode === "chord" ? "default" : "outline"} size="sm" onClick={() => setMode("chord")}>
          Chord
        </Button>
        <Button variant={mode === "scale" ? "default" : "outline"} size="sm" onClick={() => setMode("scale")}>
          Scale
        </Button>
        <Button variant={mode === "tab" ? "default" : "outline"} size="sm" onClick={() => setMode("tab")}>
          Tab
        </Button>
      </div>
      {mode === "chord" && <ChordWorkbench />}
      {mode === "scale" && <ScaleWorkbench />}
      {mode === "tab" && <TabWorkbench />}
    </div>
  );
}
```

- [ ] **Step 2: Run the full test suite**

Run: `npm test`
Expected: all tab suites pass alongside the existing suites; no failures.

- [ ] **Step 3: Typecheck the whole project**

Run: `npx astro check`
Expected: 0 errors (warnings about pre-existing code are acceptable; no new errors from `src/lib/tab/*` or the new components).

- [ ] **Step 4: Manual verification on the dev server**

The dev server is already running at `http://localhost:4321/` (restart with `npm run dev -- --host 0.0.0.0` if needed). Verify by eye:
- [ ] Click the **Tab** mode button — the editor + preview appear.
- [ ] The sample renders: 6 staff lines, tuning letters `E B G D A E` down the left, a `4/4` time signature, fret numbers sitting on the lines with the line knocked out behind each digit.
- [ ] Eighth notes are beamed with a horizontal beam; the quarter has a bare stem; the half/whole have appropriate stems; the rest shows a rest glyph; the `(h)` shows an `H` under its beat.
- [ ] Type a triplet (e.g. `et:1/1 1/1 1/1`) — the three beats get a `3` bracket beneath them.
- [ ] Type a deliberately broken token (e.g. `q:9/9/9/9`) — the preview keeps the last good render and an inline `line N: couldn't read ...` appears.
- [ ] Toggle **Beams/stems** off — only fret numbers remain. Toggle **Fingerings** on with a `finger/fret/string` note — the finger digit appears.
- [ ] Switch to **Bass** → a 4/5-string dropdown appears and the staff changes to 4 (or 5) lines with `G D A E` tuning.
- [ ] Click **Play** — audio plays through the MusyngKite patch (jazz guitar for guitar, finger bass for bass, banjo for ukulele) and a highlight cursor moves beat-to-beat; **Stop** halts it.
- [ ] Click **SVG** and **PNG** — files download and open correctly.

- [ ] **Step 5: Commit**

```bash
git add src/components/Workbench.tsx
git commit -m "feat: add Tab tab to the workbench"
```

---

## Notes for the implementer

- **Float epsilon:** measure filling uses `curFrac >= capacity - 1e-9`. Triplet fractions (1/12, 1/24) are exact enough at the scales involved; the tests assert measure counts, so don't switch to strict equality.
- **`smplr` import in tests:** `playback.test.ts` only exercises `buildSchedule`, which doesn't touch `Soundfont`. The top-level `import { Soundfont } from "smplr"` is evaluated but never called, so no AudioContext is needed in jsdom/node.
- **String numbering** is `1 = highest pitch` everywhere. Open-MIDI arrays in `instruments.ts` are ordered to match (index 0 = string 1). Don't reorder them.
- **Background knock-out** in `TabStaff` uses white (`#ffffff`) to match the preview card. If a configurable page background is added later, thread it into `layoutBg`.
- **Out of scope (do not build):** standard-notation view, chord-name row above the staff, per-technique synthesis, auto-bar validation warnings. Headroom (`TOP_PAD`) is already reserved for the chord-name row.
```
