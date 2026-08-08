# frames Characterization Tests Implementation Plan (Phase A)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pin the observable behaviour of every frames module the chordl-guitar migration will touch, so a later migration can be proved not to have changed it.

**Architecture:** Five test files, no production code changes, no dependency changes. These are **characterization tests**: they assert what the code does *today*, not what it should do. A discovered bug is recorded, not fixed — fixing it would move the target that Phases C and D are measured against.

**Tech Stack:** TypeScript (ESM), Vitest 4, npm.

**Spec:** `docs/superpowers/specs/2026-08-09-frames-migration-design.md` (in the chordl repo)

## Global Constraints

- Repository: `/home/shaun/frames`. All paths below are relative to it. This is a **different repo** from chordl — never edit anything under `/home/shaun/chordl`.
- Run tests with `npm test` (→ `vitest run`). Config at `vitest.config.ts`: `include: ["src/**/*.test.ts"]` (note: `.test.tsx` is **not** matched), `testTimeout: 30000`, `@` alias → `./src`.
- **No production code may change.** Not one line under `src/` that isn't a `*.test.ts` file. No `package.json` change, no new dependency.
- **These are characterization tests.** If behaviour looks wrong, pin it as-is and record it under "Observed oddities" in your report. Do not fix it, do not write the test as an aspiration, do not add `.skip`.
- Where an expected value cannot be derived by reading the code with certainty (MIDI arrays, generated dot lists), **run the code, capture the actual output, and pin it** — with a comment saying the value was captured, not designed. Never guess a value and adjust until it passes.
- Repo style: double quotes, 2-space indent.
- Baseline: 10 test files, ~72 tests, zero failures. Confirm this before starting.
- Work on a branch off the current default branch: `test/characterization`.

---

### Task 1: `dbPositionToChord` — the string-order flip

**Files:**
- Create: `src/lib/instruments.test.ts`

**Interfaces:**
- Consumes: `dbPositionToChord`, `INSTRUMENTS`, `CHORDS_DB`, `type ChordsDbPosition` from `src/lib/instruments.ts`
- Produces: nothing — tests only

**Why first:** this is the highest-risk untested function in the repo. It inverts string order (`stringNum = stringCount - dbIdx`), infers barre spans and finger labels, and everything else in chord mode depends on it.

- [ ] **Step 1: Write the test**

Create `src/lib/instruments.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { dbPositionToChord, INSTRUMENTS, CHORDS_DB } from "./instruments";
import type { ChordsDbPosition } from "./instruments";

// Characterization tests: these pin what dbPositionToChord does today, ahead of
// the chordl-guitar migration. They are not a specification of what it should do.

describe("dbPositionToChord — string numbering", () => {
  it("maps chords-db index 0 (lowest string) to the highest svguitar string number", () => {
    // Open C: x32010, baseFret 1. chords-db index 0 is the low E string.
    const pos: ChordsDbPosition = {
      frets: [-1, 3, 2, 0, 1, 0],
      fingers: [0, 3, 2, 0, 1, 0],
      baseFret: 1,
      barres: [],
    };
    const chord = dbPositionToChord(pos, 6);
    const byString = new Map(chord.fingers.map((f) => [f[0], f]));

    // index 0 -> string 6, index 5 -> string 1
    expect(byString.get(6)?.[1]).toBe("x");
    expect(byString.get(1)?.[1]).toBe(0);
    expect(byString.get(5)?.[1]).toBe(3);
  });

  it("sets position from baseFret", () => {
    const pos: ChordsDbPosition = {
      frets: [1, 3, 3, 2, 1, 1],
      fingers: [1, 3, 4, 2, 1, 1],
      baseFret: 8,
      barres: [1],
    };
    expect(dbPositionToChord(pos, 6).position).toBe(8);
  });

  it("passes the title through when given, and omits it when not", () => {
    const pos: ChordsDbPosition = {
      frets: [0, 0, 0, 0], fingers: [0, 0, 0, 0], baseFret: 1, barres: [],
    };
    expect(dbPositionToChord(pos, 4, "C").title).toBe("C");
    expect(dbPositionToChord(pos, 4).title).toBeUndefined();
  });
});

describe("dbPositionToChord — barres", () => {
  it("spans the barre across the strings that play that fret, and omits them from fingers", () => {
    // F major, baseFret 1, barre at fret 1 across all six strings.
    const pos: ChordsDbPosition = {
      frets: [1, 3, 3, 2, 1, 1],
      fingers: [1, 3, 4, 2, 1, 1],
      baseFret: 1,
      barres: [1],
    };
    const chord = dbPositionToChord(pos, 6);

    expect(chord.barres).toHaveLength(1);
    const barre = chord.barres![0];
    expect(barre.fret).toBe(1);
    // fromString is the highest string number (lowest pitch), toString the lowest
    expect(barre.fromString).toBeGreaterThan(barre.toString);

    // strings covered by the barre are not repeated as individual fingers
    const fingerStrings = chord.fingers.map((f) => f[0]);
    for (let s = barre.toString; s <= barre.fromString; s++) {
      const idx = 6 - s;
      if (pos.frets[idx] === 1) expect(fingerStrings).not.toContain(s);
    }
  });

  it("labels the barre with the lowest finger number playing it", () => {
    const pos: ChordsDbPosition = {
      frets: [1, 1, 3, 3, 3, 1],
      fingers: [1, 1, 2, 3, 4, 1],
      baseFret: 3,
      barres: [1],
    };
    expect(dbPositionToChord(pos, 6).barres![0].text).toBe("1");
  });
});

describe("dbPositionToChord — muted and open", () => {
  it("emits \"x\" for muted and 0 for open, with no finger text", () => {
    const pos: ChordsDbPosition = {
      frets: [-1, -1, 0, 2, 3, 2],
      fingers: [0, 0, 0, 1, 3, 2],
      baseFret: 1,
      barres: [],
    };
    const chord = dbPositionToChord(pos, 6);
    const byString = new Map(chord.fingers.map((f) => [f[0], f]));

    expect(byString.get(6)?.[1]).toBe("x");
    expect(byString.get(5)?.[1]).toBe("x");
    expect(byString.get(4)?.[1]).toBe(0);
    expect(byString.get(4)?.[2]).toBeUndefined();
  });

  it("attaches finger text only when the finger number is greater than zero", () => {
    const pos: ChordsDbPosition = {
      frets: [-1, 3, 2, 0, 1, 0],
      fingers: [0, 3, 2, 0, 1, 0],
      baseFret: 1,
      barres: [],
    };
    const chord = dbPositionToChord(pos, 6);
    const byString = new Map(chord.fingers.map((f) => [f[0], f]));
    expect(byString.get(5)?.[2]).toBe("3");
    expect(byString.get(3)?.[2]).toBeUndefined(); // open string
  });
});

describe("dbPositionToChord — against real chords-db data", () => {
  it("round-trips every guitar C major position without throwing", () => {
    const entry = CHORDS_DB.guitar.chords.C.find((e) => e.suffix === "major")!;
    for (const pos of entry.positions) {
      const chord = dbPositionToChord(pos, INSTRUMENTS.guitar.strings, "C");
      expect(chord.fingers.length).toBeGreaterThan(0);
      expect(chord.position).toBe(pos.baseFret);
      for (const f of chord.fingers) {
        expect(f[0]).toBeGreaterThanOrEqual(1);
        expect(f[0]).toBeLessThanOrEqual(6);
      }
    }
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `npx vitest run src/lib/instruments.test.ts`
Expected: PASS. If any assertion fails, the *assertion* is wrong about current behaviour — read the code, correct the assertion to match what the code actually does, and note it in your report. Do not change `src/lib/instruments.ts`.

- [ ] **Step 3: Run the full suite**

Run: `npm test`
Expected: baseline 10 files plus this one, zero failures.

- [ ] **Step 4: Commit**

```bash
git add src/lib/instruments.test.ts
git commit -m "test: characterize dbPositionToChord ahead of the chordl-guitar migration

Pins string-order inversion, barre span and label inference, muted/open
handling, and a round-trip over real chords-db C major positions."
```

---

### Task 2: `notes.ts` — the public `notes` field

**Files:**
- Create: `src/lib/notes.test.ts`

**Interfaces:**
- Consumes: `midiToName`, `stringFretToMidi`, `notesFromChord`, `notesFromScaleDots`, `type NoteInfo` from `src/lib/notes.ts`
- Produces: nothing — tests only

**Why it matters:** these feed the API response's `notes` and `noteNames` fields and the `X-Note-Midi` header. Their output is contract, and the module holds its own private `OPEN_STRING_MIDI` table that the migration will delete.

**Behaviour worth knowing before you write:** `stringFretToMidi` takes an **svguitar string number** (1 = highest pitch) and converts internally with `inst.strings - stringNum`. `notesFromChord` treats `chord.position` as the absolute fret of the first displayed fret, so a finger value of `1` means fret `position`, while `0` always means an open string regardless of position. Both `notesFrom*` helpers de-duplicate and sort ascending.

- [ ] **Step 1: Write the test**

Create `src/lib/notes.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { midiToName, stringFretToMidi, notesFromChord, notesFromScaleDots } from "./notes";
import type { Chord } from "svguitar";

// Characterization tests: pinning current behaviour ahead of the migration.

describe("midiToName", () => {
  it("uses sharps and the MIDI 60 = C4 convention", () => {
    expect(midiToName(60)).toBe("C4");
    expect(midiToName(40)).toBe("E2");
    expect(midiToName(61)).toBe("C#4");
    expect(midiToName(59)).toBe("B3");
  });
});

describe("stringFretToMidi", () => {
  it("indexes by svguitar string number, 1 being the highest-pitched string", () => {
    // guitar OPEN_STRING_MIDI is low->high [40,45,50,55,59,64]; string 1 is the last.
    expect(stringFretToMidi("guitar", 1, 0)).toBe(64);
    expect(stringFretToMidi("guitar", 6, 0)).toBe(40);
    expect(stringFretToMidi("guitar", 6, 3)).toBe(43);
  });

  it("handles the ukulele's reentrant tuning", () => {
    // low->high [67,60,64,69]; string 1 -> 69, string 4 -> 67 (the high G)
    expect(stringFretToMidi("ukulele", 1, 0)).toBe(69);
    expect(stringFretToMidi("ukulele", 4, 0)).toBe(67);
  });

  it("throws for a string number the instrument does not have", () => {
    expect(() => stringFretToMidi("ukulele", 6, 0)).toThrow();
  });
});

describe("notesFromChord", () => {
  it("treats finger fret values as relative to position, and 0 as open", () => {
    const chord: Chord = {
      fingers: [[6, "x"], [5, 3, "3"], [4, 2, "2"], [3, 0], [2, 1, "1"], [1, 0]],
      barres: [],
      position: 1,
    };
    // Open C: C3 E3 G3 C4 E4
    expect(notesFromChord("guitar", chord).map((n) => n.midi)).toEqual([48, 52, 55, 60, 64]);
  });

  it("offsets by position when the window does not start at the nut", () => {
    const chord: Chord = {
      fingers: [[6, 1], [5, 3], [4, 3], [3, 2], [2, 1], [1, 1]],
      barres: [],
      position: 8,
    };
    // finger value 1 means fret 8, not fret 1
    expect(notesFromChord("guitar", chord).map((n) => n.midi)).toEqual([48, 55, 60, 64, 67, 72]);
  });

  it("includes barred strings that carry no explicit finger", () => {
    const chord: Chord = {
      fingers: [[5, 3], [4, 3], [3, 2]],
      barres: [{ fromString: 6, toString: 1, fret: 1 }],
      position: 1,
    };
    const midis = notesFromChord("guitar", chord).map((n) => n.midi);
    expect(midis).toContain(41); // string 6 at fret 1
    expect(midis).toContain(65); // string 1 at fret 1
  });

  it("skips muted strings", () => {
    const chord: Chord = { fingers: [[6, "x"], [1, 0]], barres: [], position: 1 };
    expect(notesFromChord("guitar", chord).map((n) => n.midi)).toEqual([64]);
  });

  it("de-duplicates and sorts ascending", () => {
    const chord: Chord = { fingers: [[1, 0], [1, 0], [6, 0]], barres: [], position: 1 };
    expect(notesFromChord("guitar", chord).map((n) => n.midi)).toEqual([40, 64]);
  });
});

describe("notesFromScaleDots", () => {
  it("converts dots by string and fret, de-duplicated and ascending", () => {
    const dots = [
      { string: 6, fret: 0 } as never,
      { string: 6, fret: 3 } as never,
      { string: 6, fret: 0 } as never,
    ];
    const out = notesFromScaleDots("guitar", dots);
    expect(out.map((n) => n.midi)).toEqual([40, 43]);
    expect(out.map((n) => n.name)).toEqual(["E2", "G2"]);
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `npx vitest run src/lib/notes.test.ts`
Expected: PASS. Any failure means an assertion mis-describes current behaviour — correct the assertion, not the source, and note it.

- [ ] **Step 3: Run the full suite and commit**

Run: `npm test`

```bash
git add src/lib/notes.test.ts
git commit -m "test: characterize notes.ts, which feeds the public notes field

Pins string numbering, position-relative fret handling, barre inclusion,
de-duplication, and the reentrant ukulele case."
```

---

### Task 3: `apiFrame` — the chord path

**Files:**
- Create: `src/lib/apiFrame.test.ts`

**Interfaces:**
- Consumes: `resolveFrameRequest`, `FrameRequestError` from `src/lib/apiFrame.ts`
- Produces: nothing — tests only

**Why this is the most important task in the plan:** `resolveFrameRequest` is the whole public HTTP contract and has no tests. Everything below is observable by an API consumer.

**Exact behaviours to pin** (read from the source, not guessed):

- `req.key` is a **raw chords-db container key** — callers pass `"Csharp"`, not `"C#"`. No aliasing.
- `req.suffix` is an **exact chords-db suffix** — `"major"`, `"minor"`, `"7"`. No aliasing.
- `positionIndex` defaults to 0 and indexes `entry.positions` directly.
- Out-of-range gives `Position ${positionIndex} out of range (have ${entry.positions.length})` — the count is leaked, so it is contract.
- Unknown chord gives `No "${key}${suffix}" chord for ${instrument}` — **no space** between key and suffix.
- The preset path (bass, guitar-top3) gives `No "${key} ${suffix}" preset for ${instrument}` — **with a space**. That inconsistency is real; pin it.
- `positionIndex` is **ignored entirely** on the preset path.
- An array `fingers` is a raw passthrough: `key`, `suffix` and `positionIndex` are ignored.
- An invalid `instrument` is **silently coerced to `"guitar"`**, not rejected.
- Default title is `${entry.key}${suffix === "major" ? "" : suffix}`.
- `guitar-top3` appends `[4,"x"], [5,"x"], [6,"x"]` to the preset's fingers.

- [ ] **Step 1: Write the test**

Create `src/lib/apiFrame.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { resolveFrameRequest, FrameRequestError } from "./apiFrame";

// Characterization tests for the public /api/frame contract. These pin current
// behaviour ahead of the chordl-guitar migration, including behaviour that is
// arguably wrong (noted inline). Do not "fix" anything here.

const chordReq = (chord: Record<string, unknown>, rest: Record<string, unknown> = {}) =>
  ({ mode: "chord", chord, ...rest }) as unknown;

describe("resolveFrameRequest — request validation", () => {
  it("rejects a non-object body", () => {
    expect(() => resolveFrameRequest(null)).toThrow(FrameRequestError);
    expect(() => resolveFrameRequest("nope")).toThrow(FrameRequestError);
  });

  it("rejects an unknown mode", () => {
    expect(() => resolveFrameRequest({ mode: "tab" })).toThrow(/must be "chord" or "scale"/);
  });

  it("requires a chord object in chord mode", () => {
    expect(() => resolveFrameRequest({ mode: "chord" })).toThrow(/requires a `chord` object/);
  });

  it("requires both key and suffix when fingers are not supplied", () => {
    expect(() => resolveFrameRequest(chordReq({ key: "C" }))).toThrow(/requires `key` and `suffix`/);
  });

  it("silently coerces an unknown instrument to guitar rather than rejecting it", () => {
    const r = resolveFrameRequest(chordReq({ key: "C", suffix: "major" }, { instrument: "banjo" }));
    expect(r.instrument).toBe("guitar");
  });
});

describe("resolveFrameRequest — chords-db path", () => {
  it("looks up by raw chords-db key and exact suffix", () => {
    const r = resolveFrameRequest(chordReq({ key: "C", suffix: "major" }));
    expect(r.chord.fingers.length).toBeGreaterThan(0);
    expect(r.instrument).toBe("guitar");
  });

  it("requires chords-db's own key spelling, not the musical one", () => {
    // "Csharp" is the container key; "C#" is not and yields no entry.
    expect(() => resolveFrameRequest(chordReq({ key: "C#", suffix: "major" }))).toThrow(
      /No "C#major" chord for guitar/,
    );
  });

  it("defaults positionIndex to 0 and indexes chords-db order directly", () => {
    const first = resolveFrameRequest(chordReq({ key: "C", suffix: "major" }));
    const explicit = resolveFrameRequest(chordReq({ key: "C", suffix: "major", positionIndex: 0 }));
    expect(explicit.chord).toEqual(first.chord);

    const second = resolveFrameRequest(chordReq({ key: "C", suffix: "major", positionIndex: 1 }));
    expect(second.chord).not.toEqual(first.chord);
  });

  it("reports the available position count when the index is out of range", () => {
    expect(() =>
      resolveFrameRequest(chordReq({ key: "C", suffix: "major", positionIndex: 99 })),
    ).toThrow(/^Position 99 out of range \(have \d+\)$/);
  });

  it("omits the suffix from the default title only for major", () => {
    expect(resolveFrameRequest(chordReq({ key: "C", suffix: "major" })).chord.title).toBe("C");
    expect(resolveFrameRequest(chordReq({ key: "C", suffix: "7" })).chord.title).toBe("C7");
  });

  it("prefers an explicit title", () => {
    const r = resolveFrameRequest(chordReq({ key: "C", suffix: "major", title: "Do" }));
    expect(r.chord.title).toBe("Do");
  });

  it("errors with key and suffix run together, without a space", () => {
    expect(() => resolveFrameRequest(chordReq({ key: "C", suffix: "nope" }))).toThrow(
      'No "Cnope" chord for guitar',
    );
  });
});

describe("resolveFrameRequest — preset path", () => {
  it("errors with a space between key and suffix, unlike the chords-db path", () => {
    // The inconsistency is real and observable. Pinned deliberately.
    expect(() =>
      resolveFrameRequest(chordReq({ key: "C", suffix: "nope" }, { instrument: "guitar-top3" })),
    ).toThrow('No "C nope" preset for guitar-top3');
  });

  it("ignores positionIndex entirely", () => {
    const a = resolveFrameRequest(chordReq({ key: "C", suffix: "major" }, { instrument: "guitar-top3" }));
    const b = resolveFrameRequest(
      chordReq({ key: "C", suffix: "major", positionIndex: 3 }, { instrument: "guitar-top3" }),
    );
    expect(b.chord).toEqual(a.chord);
  });

  it("mutes strings 4-6 for guitar-top3", () => {
    const r = resolveFrameRequest(chordReq({ key: "C", suffix: "major" }, { instrument: "guitar-top3" }));
    for (const s of [4, 5, 6]) {
      expect(r.chord.fingers.find((f) => f[0] === s)?.[1]).toBe("x");
    }
  });

  it("accepts the legacy \"bass\" instrument id", () => {
    const r = resolveFrameRequest(chordReq({ key: "C", suffix: "5" }, { instrument: "bass" }));
    expect(r.instrument).toBe("bass");
    expect(r.chord.fingers.length).toBeGreaterThan(0);
  });
});

describe("resolveFrameRequest — raw passthrough", () => {
  it("ignores key, suffix and positionIndex when fingers is an array", () => {
    const r = resolveFrameRequest(
      chordReq({ fingers: [[1, 0], [2, 1]], key: "C", suffix: "major", positionIndex: 99 }),
    );
    expect(r.chord.fingers).toEqual([[1, 0], [2, 1]]);
    expect(r.chord.barres).toEqual([]);
  });

  it("carries position and title through only when set", () => {
    const withPos = resolveFrameRequest(chordReq({ fingers: [[1, 0]], position: 5, title: "X" }));
    expect(withPos.chord.position).toBe(5);
    expect(withPos.chord.title).toBe("X");

    const without = resolveFrameRequest(chordReq({ fingers: [[1, 0]] }));
    expect(without.chord.position).toBeUndefined();
    expect(without.chord.title).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run and reconcile**

Run: `npx vitest run src/lib/apiFrame.test.ts`

Some expected values here were derived by reading the source rather than executing it. Where an assertion fails, **read the code, determine what it actually does, and correct the assertion** — then record the discrepancy in your report, because a wrong belief about the contract is exactly what this task exists to eliminate. Never edit `src/lib/apiFrame.ts`.

- [ ] **Step 3: Run the full suite and commit**

Run: `npm test`

```bash
git add src/lib/apiFrame.test.ts
git commit -m "test: characterize the /api/frame chord path

Pins raw chords-db key/suffix lookup, positionIndex semantics and bounds,
default titles, the preset path's divergent error string, guitar-top3 muting,
raw-fingers passthrough, and silent coercion of unknown instruments."
```

---

### Task 4: `apiFrame` — the scale path and response envelope

**Files:**
- Modify: `src/lib/apiFrame.test.ts` (append)

**Interfaces:**
- Consumes: `resolveFrameRequest`, `FrameRequestError`
- Produces: nothing — tests only

**Behaviours to pin:** `scale.key` is validated against `KEY_OPTIONS` and `scale.scale` against `SCALES`, each with its own 400 message. `mode` defaults to `"position"` and `labelMode` to `"note"`. Settings merge in a fixed order — `baseSettings(instrument)` first, then the scale result's `fretSpan` overrides `frets`, then the caller's `settings` spread last and wins. `ResolvedFrame` always carries `chord`, `settings`, `instrument` and `notes`.

- [ ] **Step 1: Append the tests**

```ts
describe("resolveFrameRequest — scale path", () => {
  const scaleReq = (scale: Record<string, unknown>, rest: Record<string, unknown> = {}) =>
    ({ mode: "scale", scale, ...rest }) as unknown;

  it("requires a scale object", () => {
    expect(() => resolveFrameRequest({ mode: "scale" })).toThrow(FrameRequestError);
  });

  it("rejects a key outside KEY_OPTIONS", () => {
    expect(() => resolveFrameRequest(scaleReq({ key: "H", scale: "major" }))).toThrow(/Invalid key/);
  });

  it("rejects an unknown scale name", () => {
    expect(() => resolveFrameRequest(scaleReq({ key: "C", scale: "bebop" }))).toThrow(/Invalid scale/);
  });

  it("resolves a valid scale into a chord with dots and notes", () => {
    const r = resolveFrameRequest(scaleReq({ key: "C", scale: "major" }));
    expect(r.chord.fingers.length).toBeGreaterThan(0);
    expect(r.notes.length).toBeGreaterThan(0);
  });
});

describe("resolveFrameRequest — settings merge order", () => {
  it("lets the caller's settings win over the instrument defaults", () => {
    const r = resolveFrameRequest({
      mode: "chord",
      chord: { key: "C", suffix: "major" },
      settings: { title: "override", frets: 9 },
    } as unknown);
    expect(r.settings.title).toBe("override");
    expect(r.settings.frets).toBe(9);
  });

  it("derives strings and tuning from the instrument", () => {
    const uke = resolveFrameRequest({
      mode: "chord",
      instrument: "ukulele",
      chord: { key: "C", suffix: "major" },
    } as unknown);
    expect(uke.settings.strings).toBe(4);
    expect(uke.settings.tuning).toEqual(["G", "C", "E", "A"]);
  });
});

describe("resolveFrameRequest — resolved shape", () => {
  it("always returns chord, settings, instrument and notes", () => {
    const r = resolveFrameRequest({ mode: "chord", chord: { key: "C", suffix: "major" } } as unknown);
    expect(Object.keys(r).sort()).toEqual(["chord", "instrument", "notes", "settings"]);
    for (const n of r.notes) {
      expect(typeof n.name).toBe("string");
      expect(typeof n.midi).toBe("number");
    }
  });
});
```

- [ ] **Step 2: Run, reconcile, and commit**

Run: `npx vitest run src/lib/apiFrame.test.ts` then `npm test`

The settings-merge assertions are the ones most likely to need reconciling — verify the actual merge order by reading `resolveFrameRequest` and correct the assertions to match.

```bash
git add src/lib/apiFrame.test.ts
git commit -m "test: characterize the /api/frame scale path and response envelope

Pins key and scale validation messages, the settings merge order, and the
ResolvedFrame shape."
```

---

### Task 5: `tab/chordLookup` — absolute frets from position 0

**Files:**
- Create: `src/lib/tab/chordLookup.test.ts`

**Interfaces:**
- Consumes: `lookupChordFrets` from `src/lib/tab/chordLookup.ts`
- Produces: nothing — tests only

**Behaviours to pin:** returns **absolute** frets low→high via `pos.frets.map(f => f <= 0 ? f : pos.baseFret - 1 + f)`; uses **`entry.positions[0]` only**; aliases enharmonic roots and suffixes (unlike `apiFrame`, which aliases nothing); returns `null` for bass and for unknown chords. The contrast with `apiFrame`'s strictness is itself worth pinning — two lookup paths in the same repo disagree about aliasing.

- [ ] **Step 1: Write the test**

```ts
import { describe, it, expect } from "vitest";
import { lookupChordFrets } from "./chordLookup";

// Characterization tests: pinning current behaviour ahead of the migration.

describe("lookupChordFrets", () => {
  it("returns absolute frets, low string first", () => {
    const frets = lookupChordFrets("C", "guitar");
    expect(frets).not.toBeNull();
    expect(frets!.length).toBe(6);
    for (const f of frets!) expect(f).toBeGreaterThanOrEqual(-1);
  });

  it("resolves baseFret into absolute fret numbers", () => {
    // Whatever shape comes back, no positive fret may be below its baseFret window.
    const frets = lookupChordFrets("F", "guitar")!;
    const positive = frets.filter((f) => f > 0);
    expect(positive.length).toBeGreaterThan(0);
  });

  it("aliases enharmonic roots, unlike the /api/frame path", () => {
    expect(lookupChordFrets("F#m", "guitar")).not.toBeNull();
    expect(lookupChordFrets("Gbm", "guitar")).not.toBeNull();
  });

  it("aliases suffixes", () => {
    expect(lookupChordFrets("Am", "guitar")).not.toBeNull();
    expect(lookupChordFrets("Amin", "guitar")).not.toBeNull();
  });

  it("returns null for bass, which chords-db does not cover", () => {
    expect(lookupChordFrets("C", "bass4")).toBeNull();
    expect(lookupChordFrets("C", "bass5")).toBeNull();
  });

  it("returns null for an unknown chord rather than guessing", () => {
    expect(lookupChordFrets("H7", "guitar")).toBeNull();
  });

  it("is stable across calls (cached)", () => {
    expect(lookupChordFrets("C", "guitar")).toEqual(lookupChordFrets("C", "guitar"));
  });
});
```

- [ ] **Step 2: Run, reconcile, and commit**

Run: `npx vitest run src/lib/tab/chordLookup.test.ts` then `npm test`

```bash
git add src/lib/tab/chordLookup.test.ts
git commit -m "test: characterize tab/chordLookup

Pins absolute-fret derivation, position-0-only lookup, enharmonic and suffix
aliasing, and null for bass and unknown chords."
```

---

### Task 6: Record the baseline

**Files:**
- Create: `docs/superpowers/characterization-baseline.md`

**Interfaces:**
- Consumes: the four test files from Tasks 1–5
- Produces: the document Phases C and D are measured against

- [ ] **Step 1: Write the record**

Capture, in a short document: the total test count after this plan; a list of every behaviour pinned that is arguably a bug (the two divergent error-message formats, silent instrument coercion, `positionIndex` ignored on the preset path, and anything you found while reconciling); and one line stating that these tests must pass unchanged after the migration, with any intentional change called out in its PR.

This is the deliverable Phase C is graded against. Keep it to a page.

- [ ] **Step 2: Run the full suite and commit**

Run: `npm test`
Expected: baseline 10 files plus 4 new files, zero failures.

```bash
git add docs/superpowers/characterization-baseline.md
git commit -m "docs: record the characterization baseline for the migration"
```

---

## Self-Review

**Spec coverage:** Phase A of the spec names four modules — `apiFrame.ts` (Tasks 3, 4), `notes.ts` (Task 2), `instruments.ts` (Task 1), `tab/chordLookup.ts` (Task 5) — plus the acceptance record (Task 6).

**A note on the test values:** several expected values in Tasks 3 and 4 were derived by reading source rather than executing it. Each of those steps instructs the implementer to reconcile against actual behaviour and report the discrepancy. That is deliberate: for characterization tests, a mismatch between what the plan believed and what the code does is *the finding*, not a failure.

**Out of scope:** no production changes, no dependency on chordl-guitar, no `scales.ts` tests (Phase E territory), and no fixes for anything discovered.
