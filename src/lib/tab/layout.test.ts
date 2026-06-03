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
