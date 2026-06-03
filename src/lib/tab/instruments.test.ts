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
