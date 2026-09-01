import type { Chord } from "svguitar";

export interface StaticPreset {
  key: string;
  suffix: string;
  chord: Chord;
}

/**
 * Bass presets — common root-fifth ("power chord") shapes for 4-string bass (E A D G).
 * String 1 = G (high), String 4 = E (low).
 * Frets: [stringNumber, fret, fingerLabel?]
 */
export const BASS_PRESETS: StaticPreset[] = [
  {
    key: "E",
    suffix: "5",
    chord: {
      fingers: [
        [4, 0],
        [3, 2, "2"],
        [2, "x"],
        [1, "x"],
      ],
      barres: [],
    },
  },
  {
    key: "A",
    suffix: "5",
    chord: {
      fingers: [
        [3, 0],
        [2, 2, "2"],
        [4, "x"],
        [1, "x"],
      ],
      barres: [],
    },
  },
  {
    key: "D",
    suffix: "5",
    chord: {
      fingers: [
        [2, 0],
        [1, 2, "2"],
        [4, "x"],
        [3, "x"],
      ],
      barres: [],
    },
  },
  {
    key: "G",
    suffix: "5",
    chord: {
      fingers: [
        [1, 0],
        [4, 3, "3"],
        [3, "x"],
        [2, "x"],
      ],
      barres: [],
    },
  },
  {
    key: "F",
    suffix: "5",
    chord: {
      fingers: [
        [4, 1, "1"],
        [3, 3, "3"],
        [2, "x"],
        [1, "x"],
      ],
      barres: [],
    },
  },
  {
    key: "G",
    suffix: "5 (low)",
    chord: {
      fingers: [
        [4, 3, "1"],
        [3, 5, "3"],
        [2, "x"],
        [1, "x"],
      ],
      barres: [],
    },
  },
  {
    key: "C",
    suffix: "5",
    chord: {
      fingers: [
        [3, 3, "1"],
        [2, 5, "3"],
        [4, "x"],
        [1, "x"],
      ],
      barres: [],
    },
  },
  {
    key: "B",
    suffix: "5",
    chord: {
      fingers: [
        [4, "x"],
        [3, 2, "1"],
        [2, 4, "3"],
        [1, "x"],
      ],
      barres: [],
    },
  },
];
/**
 * Beginner top-3-string guitar voicings, re-exported from the package that owns them.
 *
 * These were vendored here on 2026-04-30 and never updated. chordl-guitar's table
 * was authored later as a superset, so the local copy had fallen ten chords behind
 * — Bm, F, D7, E7, A7, Am7, Dm7, Em7, Fmaj7 and Gm were all unreachable through
 * /api/frame and the workbench. Re-exporting keeps that from drifting again.
 *
 * Note these presets already mute strings 4-6; the previous local copy carried
 * strings 1-3 only and relied on each call site padding them.
 */
export { GUITAR_TOP3_PRESETS } from "@pepperhorn/chordl-guitar";
