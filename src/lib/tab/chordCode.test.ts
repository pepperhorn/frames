import { describe, expect, it } from "vitest";
import type { Chord } from "svguitar";
import { chordToFretCode, fretCodeToChord, encodeFrets } from "./chordCode";

describe("chordCode", () => {
  it("encodes compact vs dashed", () => {
    expect(encodeFrets([-1, 0, 2, 2, 1, 0])).toBe("x02210");
    expect(encodeFrets([-1, -1, 12, 14, 14, 13])).toBe("x-x-12-14-14-13");
  });

  it("open chord (position 1): code = literal frets, low->high", () => {
    // C major: low E muted, A3, D2, G0, B1, e0  (string 6..1)
    const chord: Chord = {
      fingers: [
        [6, "x"], [5, 3], [4, 2], [3, 0], [2, 1], [1, 0],
      ],
      barres: [],
      position: 1,
    };
    expect(chordToFretCode(chord, 6)).toBe("x32010");
  });

  it("up-the-neck chord: absolute frets fold in the position", () => {
    // position 5, all fretted at relative 1 except one at 4 -> absolute 5 and 8
    const chord: Chord = {
      fingers: [
        [6, "x"], [5, "x"], [4, 1], [3, 1], [2, 1], [1, 4],
      ],
      barres: [],
      position: 5,
    };
    expect(chordToFretCode(chord, 6)).toBe("xx5558"); // single digits -> compact
  });

  it("round-trips an open chord through code and back", () => {
    const code = "x02210"; // Am
    const chord = fretCodeToChord(code, 6, "Am")!;
    expect(chordToFretCode(chord, 6)).toBe(code);
    expect(chord.title).toBe("Am");
  });

  it("round-trips a high-position chord with two-digit frets (dashed)", () => {
    const code = "x-x-10-12-12-11";
    const chord = fretCodeToChord(code, 6)!;
    expect(chord.position).toBe(10);
    expect(chordToFretCode(chord, 6)).toBe(code);
  });

  it("returns null for an invalid code", () => {
    expect(fretCodeToChord("0221", 6)).toBeNull(); // wrong string count
  });
});
