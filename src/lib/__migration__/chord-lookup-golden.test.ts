// src/lib/__migration__/chord-lookup-golden.test.ts
//
// Behaviour lock for `lib/tab/chordLookup.ts`, the third module the
// chordl-guitar migration retires.
//
// Two things here will move when chordl-guitar's `lookupGuitarChord` replaces
// it, and both should move visibly rather than silently:
//
//  1. `entry.positions[0]` is taken unconditionally. Sub-project 1 added
//     canonical-position selection, so any chord whose canonical shape is not
//     position 0 returns different frets afterwards.
//  2. Absolute frets are computed as `baseFret - 1 + f`. That is the arithmetic
//     the boundary spec records as a constraint ("must use baseFret + frets[i]
//     - 1, not frets[i]"), and frames already gets it right. It must stay right.
//
// The snapshot covers the whole shipped vocabulary, so a diff shows exactly
// which chords changed and by how much.
import { describe, expect, it } from "vitest";
import { lookupChordFrets } from "@/lib/tab/chordLookup";
import { CHORDS_DB } from "@/lib/instruments";
import type { TabInstrument } from "@/lib/tab/types";

interface DbEntry {
  key: string;
  suffix: string;
  positions: { frets: number[]; baseFret: number }[];
}
type Db = { chords: Record<string, DbEntry[]> };

function entriesOf(kit: "guitar" | "ukulele"): DbEntry[] {
  const db = (CHORDS_DB as unknown as Record<string, Db>)[kit];
  return Object.keys(db.chords).flatMap((k) => db.chords[k]);
}

/** The labels a user would actually type for an entry. */
function labelsFor(e: DbEntry): string[] {
  const roots = e.key.replace("sharp", "#");
  const suffixes = e.suffix === "major" ? [""] : e.suffix === "minor" ? ["m", "min"] : [e.suffix];
  return suffixes.map((s) => `${roots}${s}`);
}

describe("chord lookup golden master — the whole shipped vocabulary", () => {
  it.each(["guitar", "ukulele"] as const)("%s", (kit) => {
    const lines: string[] = [];
    for (const e of entriesOf(kit)) {
      for (const label of labelsFor(e)) {
        const frets = lookupChordFrets(label, kit as TabInstrument);
        lines.push(`${label.padEnd(12)} ${frets ? frets.join(" ") : "null"}`);
      }
    }
    expect(lines.length).toBeGreaterThan(400);
    expect(lines.join("\n")).toMatchSnapshot();
  });
});

describe("the fret arithmetic the spec calls out", () => {
  // `baseFret - 1 + f`, not a raw `f`. Verified against the database rather
  // than asserted from memory: every non-open shape must land on the absolute
  // fret its baseFret implies.
  it("resolves barre shapes to absolute frets, not relative ones", () => {
    const withBase = entriesOf("guitar").filter((e) => (e.positions[0]?.baseFret ?? 1) > 1);
    expect(withBase.length).toBeGreaterThan(0);
    const wrong: string[] = [];
    for (const e of withBase) {
      const pos = e.positions[0];
      const label = labelsFor(e)[0];
      const got = lookupChordFrets(label, "guitar");
      if (!got) continue;
      const expected = pos.frets.map((f) => (f <= 0 ? f : pos.baseFret - 1 + f));
      if (got.join(",") !== expected.join(",")) {
        wrong.push(`${label}: ${got.join(" ")} != ${expected.join(" ")}`);
      }
    }
    expect(wrong).toEqual([]);
  });

  it("keeps muted and open strings as -1 and 0", () => {
    // Sentinels, not fret numbers — baseFret must never be added to them.
    const am = lookupChordFrets("Am", "guitar");
    expect(am).toEqual([-1, 0, 2, 2, 1, 0]);
    const uke = lookupChordFrets("C", "ukulele");
    expect(uke).toEqual([0, 0, 0, 3]);
  });
});

describe("lookup contract", () => {
  // KNOWN DEFECT, pinned deliberately so the migration's diff reads as a fix.
  //
  // `rootAliases()` is called with `entry.key`, which chords-db spells "C#" and
  // "F#". Its alias table is keyed "Csharp", "Dsharp", "Fsharp", "Gsharp",
  // "Asharp" — five of its eight entries can never match, because that spelling
  // only ever appears as the *object* key of `db.chords`, not on the entry.
  //
  // The flat-spelled roots (Eb, Ab, Bb) do match and register both spellings.
  // The sharp-spelled ones register only the sharp. So "Db" and "Gb" are
  // unfindable, and a user typing them in the tab editor silently gets no
  // chord frame.
  //
  // chordl-guitar's `lookupGuitarChord` resolves all ten enharmonics on both
  // guitar and ukulele, so adopting it repairs this. When it does, this test
  // is the one to delete.
  it("does not accept flat spellings of the sharp-keyed roots (known defect)", () => {
    expect(lookupChordFrets("C#", "guitar")).not.toBeNull();
    expect(lookupChordFrets("Db", "guitar")).toBeNull();
    expect(lookupChordFrets("F#", "guitar")).not.toBeNull();
    expect(lookupChordFrets("Gb", "guitar")).toBeNull();
  });

  it("does accept both spellings of the flat-keyed roots", () => {
    // These work because chords-db spells them "Eb"/"Ab"/"Bb", which the alias
    // table happens to key correctly.
    expect(lookupChordFrets("Eb", "guitar")).toEqual(lookupChordFrets("D#", "guitar"));
    expect(lookupChordFrets("Ab", "guitar")).toEqual(lookupChordFrets("G#", "guitar"));
    expect(lookupChordFrets("A#m", "guitar")).toEqual(lookupChordFrets("Bbm", "guitar"));
  });

  it("accepts both minor spellings", () => {
    expect(lookupChordFrets("Am", "guitar")).toEqual(lookupChordFrets("Amin", "guitar"));
  });

  it("is case- and whitespace-insensitive", () => {
    expect(lookupChordFrets("  am  ", "guitar")).toEqual(lookupChordFrets("Am", "guitar"));
  });

  it("returns null for bass, which ships no chord library", () => {
    expect(lookupChordFrets("Am", "bass4")).toBeNull();
    expect(lookupChordFrets("Am", "bass5")).toBeNull();
  });

  it("returns null for an unknown label rather than guessing", () => {
    expect(lookupChordFrets("Hmaj17", "guitar")).toBeNull();
  });

  it("hands back a copy, so a caller cannot poison the cache", () => {
    const first = lookupChordFrets("Am", "guitar")!;
    first[0] = 99;
    expect(lookupChordFrets("Am", "guitar")![0]).toBe(-1);
  });
});
