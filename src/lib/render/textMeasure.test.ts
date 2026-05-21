import { describe, expect, it } from "vitest";
import { measureText } from "./textMeasure";

describe("measureText", () => {
  it("returns metrics for a bundled font", () => {
    const m = measureText("Poppins, sans-serif", 600, 24, "Hello");
    expect(m).not.toBeNull();
    expect(m!.width).toBeGreaterThan(0);
    expect(m!.height).toBeGreaterThan(0);
    expect(m!.ascender).toBeGreaterThan(0);
    expect(m!.descender).toBeLessThan(0);
  });

  it("scales width with font size", () => {
    const small = measureText("Poppins, sans-serif", 400, 12, "Hello")!;
    const large = measureText("Poppins, sans-serif", 400, 48, "Hello")!;
    expect(large.width).toBeGreaterThan(small.width * 3);
  });

  it("returns null for unbundled (system fallback) families", () => {
    expect(measureText("Georgia, serif", 400, 16, "x")).toBeNull();
    expect(measureText("Comic Sans MS", 400, 16, "x")).toBeNull();
  });

  it("returns null for empty/missing family", () => {
    expect(measureText(null, 400, 16, "x")).toBeNull();
    expect(measureText("", 400, 16, "x")).toBeNull();
  });

  it("handles quoted family names from CSS font-family strings", () => {
    const m = measureText("'Patrick Hand', cursive", 400, 24, "Am");
    expect(m).not.toBeNull();
    expect(m!.width).toBeGreaterThan(0);
  });
});
