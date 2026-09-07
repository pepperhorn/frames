// src/lib/__migration__/fretboard-golden.test.ts
//
// Behaviour lock for the chordl-guitar migration.
//
// frames carries four open-string tables in three orientations. `lib/notes.ts`
// and `lib/scales.ts` store MIDI low->high and index with
// `strings - stringNum`; `lib/tab/instruments.ts` stores it high->low and
// indexes with `string - 1`. Both are correct today, and they agree only
// because each table's arithmetic matches its own orientation.
//
// Adopting chordl-guitar's low->high `openMidi` flips the tab layer's
// orientation. If an index is not flipped with it, every note is still a
// plausible pitch — just the wrong one. No crash, no type error, and only the
// ukulele's reentrant tuning makes it obvious by ear.
//
// So this pins the *relationship*, not only the values: the two subsystems
// must keep agreeing note for note, and the pitch shape of each instrument
// must survive. It is deliberately mechanism-agnostic — it calls the public
// entry points and does not care which table answers.
import { describe, expect, it } from "vitest";
import { noteToMidi } from "@/lib/tab/pitch";
import { TAB_INSTRUMENTS, stringCountFor } from "@/lib/tab/instruments";
import { stringFretToMidi, midiToName } from "@/lib/notes";
import { INSTRUMENTS, type InstrumentId } from "@/lib/instruments";
import type { TabInstrument } from "@/lib/tab/types";

const FRETS = 24;

/** Instruments the tab layer and the chord/scale layer both describe. */
const SHARED: { tab: TabInstrument; chord: InstrumentId }[] = [
  { tab: "guitar", chord: "guitar" },
  { tab: "ukulele", chord: "ukulele" },
  { tab: "bass4", chord: "bass" },
];

function sweep(fn: (stringNum: number, fret: number) => number, strings: number) {
  const rows: string[] = [];
  for (let s = 1; s <= strings; s++) {
    const midis: number[] = [];
    for (let f = 0; f <= FRETS; f++) midis.push(fn(s, f));
    rows.push(`string ${s}: ${midis.join(" ")}`);
  }
  return rows.join("\n");
}

describe("fretboard golden master — every string, every fret", () => {
  // The whole fretboard as a snapshot. Any change to a tuning table, an index,
  // or an orientation moves at least one number here.
  for (const id of Object.keys(TAB_INSTRUMENTS) as TabInstrument[]) {
    it(`tab layer: ${id}`, () => {
      const out = sweep((s, f) => noteToMidi(id, { string: s, fret: f }), stringCountFor(id));
      expect(out).toMatchSnapshot();
    });
  }

  for (const id of Object.keys(INSTRUMENTS) as InstrumentId[]) {
    it(`chord/scale layer: ${id}`, () => {
      const out = sweep((s, f) => stringFretToMidi(id, s, f), INSTRUMENTS[id].strings);
      expect(out).toMatchSnapshot();
    });
  }
});

describe("the two orientations must agree", () => {
  // The invariant a wrong flip breaks. `notes.ts` indexes low->high with
  // `strings - stringNum`; `tab/pitch.ts` indexes high->low with `string - 1`.
  // Same string number, same pitch — reached through opposite array orders.
  it.each(SHARED)("$tab and $chord answer identically", ({ tab, chord }) => {
    const strings = stringCountFor(tab);
    expect(strings).toBe(INSTRUMENTS[chord].strings);
    const mismatches: string[] = [];
    for (let s = 1; s <= strings; s++) {
      for (let f = 0; f <= FRETS; f++) {
        const viaTab = noteToMidi(tab, { string: s, fret: f });
        const viaChord = stringFretToMidi(chord, s, f);
        if (viaTab !== viaChord) {
          mismatches.push(`string ${s} fret ${f}: tab ${viaTab} vs chord ${viaChord}`);
        }
      }
    }
    expect(mismatches).toEqual([]);
  });
});

describe("string 1 is the highest-pitched string", () => {
  // The convention both layers encode. A reversed array with unreversed
  // arithmetic inverts this and nothing else complains.
  it.each(["guitar", "bass4", "bass5"] as TabInstrument[])("%s open strings descend", (id) => {
    const open = Array.from({ length: stringCountFor(id) }, (_, i) =>
      noteToMidi(id, { string: i + 1, fret: 0 })
    );
    expect(open).toEqual([...open].sort((a, b) => b - a));
  });

  it("ukulele is reentrant and must NOT descend", () => {
    // The canary. Standard reentrant tuning puts the G above the C and E, so
    // the ukulele is the one instrument whose open strings are not monotonic.
    // A reversal bug that leaves the others plausible shows up here.
    const open = Array.from({ length: stringCountFor("ukulele") }, (_, i) =>
      noteToMidi("ukulele", { string: i + 1, fret: 0 })
    );
    expect(open).toEqual([69, 64, 60, 67]); // A4 E4 C4 G4
    expect(open).not.toEqual([...open].sort((a, b) => b - a));
    expect(open[3]).toBeGreaterThan(open[2]); // the high G
  });
});

describe("named open strings", () => {
  // Values as names, so a diff is readable by a guitarist and not only by a
  // machine. Named per instrument rather than snapshotted.
  it("guitar reads E4 B3 G3 D3 A2 E2 from string 1", () => {
    const names = Array.from({ length: 6 }, (_, i) =>
      midiToName(noteToMidi("guitar", { string: i + 1, fret: 0 }))
    );
    expect(names).toEqual(["E4", "B3", "G3", "D3", "A2", "E2"]);
  });

  it("ukulele reads A4 E4 C4 G4 from string 1", () => {
    const names = Array.from({ length: 4 }, (_, i) =>
      midiToName(noteToMidi("ukulele", { string: i + 1, fret: 0 }))
    );
    expect(names).toEqual(["A4", "E4", "C4", "G4"]);
  });

  it("4- and 5-string bass agree on their shared strings", () => {
    const four = Array.from({ length: 4 }, (_, i) =>
      noteToMidi("bass4", { string: i + 1, fret: 0 })
    );
    const five = Array.from({ length: 5 }, (_, i) =>
      noteToMidi("bass5", { string: i + 1, fret: 0 })
    );
    expect(four).toEqual(five.slice(0, 4));
    expect(midiToName(five[4])).toBe("B0");
  });
});
