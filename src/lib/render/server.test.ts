import { describe, expect, it } from "vitest";
import { renderFrameToSvg } from "./server";
import type { FrameSpec } from "./types";

// Integration tests for the svgdom rendering path (normal style only).
// Handdrawn requires Playwright and a running dev server, which is out of
// scope for the unit test suite — it's verified via the curl smoke tests in
// the PR description.

describe("renderFrameToSvg (normal style)", () => {
  it("renders a chord spec to a valid <svg> string", async () => {
    const spec: FrameSpec = {
      kind: "chord",
      chord: {
        title: "C",
        fingers: [
          [5, 3],
          [4, 2],
          [2, 1],
          [1, 0],
          [6, "x"],
        ],
        barres: [],
      },
    };
    const { svg, width, height } = await renderFrameToSvg(spec);
    expect(svg).toMatch(/^<svg/);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain("viewBox=");
    expect(width).toBeGreaterThan(0);
    expect(height).toBeGreaterThan(0);
  });

  it("renders a scale spec via frameToChord", async () => {
    const spec: FrameSpec = {
      kind: "scale",
      instrument: "guitar",
      key: "A",
      frame: {
        title: "A Minor Pentatonic",
        position: 5,
        fretSpan: 4,
        labelMode: "note",
        rootColor: "#dc2626",
        noteColor: "#0a0a0a",
        highlightColor: "#f59e0b",
        dots: [
          { string: 6, fret: 5, isRoot: true },
          { string: 6, fret: 8 },
          { string: 1, fret: 5, isRoot: true },
        ],
      },
    };
    const { svg } = await renderFrameToSvg(spec);
    expect(svg).toMatch(/<svg/);
    expect(svg).toContain("A Minor Pentatonic"); // title rendered
  });

  it("applies the requested font-family to text nodes", async () => {
    const spec: FrameSpec = {
      kind: "chord",
      chord: {
        title: "Am",
        fingers: [[2, 1]],
        barres: [],
      },
      settings: { fontFamily: "Inter, sans-serif" },
    };
    const { svg } = await renderFrameToSvg(spec);
    expect(svg).toContain('font-family="Inter, sans-serif"');
  });
});
