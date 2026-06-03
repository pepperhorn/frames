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
