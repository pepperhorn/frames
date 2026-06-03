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
