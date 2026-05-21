import { describe, expect, it } from "vitest";
import { autoLabelFor, frameToChord } from "./scaleToChord";
import type { ScaleFrame } from "@/lib/scales";

function frame(partial: Partial<ScaleFrame> = {}): ScaleFrame {
  return {
    title: "",
    position: 1,
    fretSpan: 5,
    labelMode: "note",
    rootColor: "#dc2626",
    noteColor: "#0a0a0a",
    highlightColor: "#f59e0b",
    dots: [],
    ...partial,
  };
}

describe("autoLabelFor", () => {
  it("returns undefined when labelMode is none", () => {
    expect(
      autoLabelFor({ string: 6, fret: 5 }, frame({ labelMode: "none" }), {
        instrument: "guitar",
        key: "A",
      }),
    ).toBeUndefined();
  });

  it("returns the note name for note mode", () => {
    // Guitar low E (string 6), fret 5 → A
    expect(
      autoLabelFor({ string: 6, fret: 5 }, frame({ labelMode: "note" }), {
        instrument: "guitar",
        key: "A",
      }),
    ).toBe("A");
  });

  it("returns the scale degree for degree mode", () => {
    // Low E fret 5 (A) is the root of A scale → "1"
    expect(
      autoLabelFor({ string: 6, fret: 5 }, frame({ labelMode: "degree" }), {
        instrument: "guitar",
        key: "A",
      }),
    ).toBe("1");
    // Low E fret 8 (C) in A minor pentatonic is the b3 → "♭3"
    expect(
      autoLabelFor({ string: 6, fret: 8 }, frame({ labelMode: "degree" }), {
        instrument: "guitar",
        key: "A",
      }),
    ).toBe("b3");
  });
});

describe("frameToChord", () => {
  it("translates absolute fret numbers to fret-window-relative positions", () => {
    const chord = frameToChord(
      frame({
        position: 5,
        dots: [
          { string: 6, fret: 5 }, // → relFret 1
          { string: 5, fret: 7 }, // → relFret 3
        ],
      }),
      { instrument: "guitar", key: "A" },
    );
    // fingers may be [string, fret] or [string, fret, label/options]
    const positions = chord.fingers.map((f) => [f[0], f[1]] as const);
    expect(positions).toContainEqual([6, 1]);
    expect(positions).toContainEqual([5, 3]);
  });

  it("preserves open strings (fret 0) regardless of position", () => {
    const chord = frameToChord(
      frame({
        position: 5,
        dots: [{ string: 1, fret: 0 }],
      }),
      { instrument: "guitar", key: "A" },
    );
    expect(chord.fingers).toContainEqual(
      expect.arrayContaining([1, 0]),
    );
  });

  it("drops dots that fall below the fret window", () => {
    const chord = frameToChord(
      frame({
        position: 5,
        dots: [
          { string: 6, fret: 2 }, // would be relFret -2, dropped
          { string: 6, fret: 5 }, // relFret 1, kept
        ],
      }),
      { instrument: "guitar", key: "A" },
    );
    expect(chord.fingers).toHaveLength(1);
    expect(chord.fingers[0][1]).toBe(1);
  });

  it("attaches color/shape options for root and highlight dots", () => {
    const chord = frameToChord(
      frame({
        position: 5,
        rootColor: "#ff0000",
        dots: [{ string: 6, fret: 5, isRoot: true }],
      }),
      { instrument: "guitar", key: "A" },
    );
    const finger = chord.fingers[0];
    expect(finger).toHaveLength(3);
    const opts = finger[2] as { color?: string };
    expect(opts.color).toBe("#ff0000");
  });
});
