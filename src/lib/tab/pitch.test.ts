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
