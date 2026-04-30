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
 * Beginner top-3-string guitar voicings (strings G, B, E — string 3,2,1).
 * Component is configured with strings: 3, so string 1 = high E, string 3 = G.
 */
export const GUITAR_TOP3_PRESETS: StaticPreset[] = [
  {
    key: "C",
    suffix: "major",
    chord: {
      fingers: [
        [3, 0],
        [2, 1, "1"],
        [1, 0],
      ],
      barres: [],
    },
  },
  {
    key: "G",
    suffix: "major",
    chord: {
      fingers: [
        [3, 0],
        [2, 0],
        [1, 3, "3"],
      ],
      barres: [],
    },
  },
  {
    key: "D",
    suffix: "major",
    chord: {
      fingers: [
        [3, 2, "1"],
        [2, 3, "3"],
        [1, 2, "2"],
      ],
      barres: [],
    },
  },
  {
    key: "A",
    suffix: "major",
    chord: {
      fingers: [
        [3, 2, "1"],
        [2, 2, "2"],
        [1, 0],
      ],
      barres: [],
    },
  },
  {
    key: "E",
    suffix: "minor",
    chord: {
      fingers: [
        [3, 0],
        [2, 0],
        [1, 0],
      ],
      barres: [],
    },
  },
  {
    key: "A",
    suffix: "minor",
    chord: {
      fingers: [
        [3, 2, "2"],
        [2, 1, "1"],
        [1, 0],
      ],
      barres: [],
    },
  },
  {
    key: "D",
    suffix: "minor",
    chord: {
      fingers: [
        [3, 2, "2"],
        [2, 3, "3"],
        [1, 1, "1"],
      ],
      barres: [],
    },
  },
  {
    key: "E",
    suffix: "major",
    chord: {
      fingers: [
        [3, 1, "1"],
        [2, 0],
        [1, 0],
      ],
      barres: [],
    },
  },
  {
    key: "C",
    suffix: "7",
    chord: {
      fingers: [
        [3, 0],
        [2, 1, "1"],
        [1, 3, "3"],
      ],
      barres: [],
    },
  },
  {
    key: "G",
    suffix: "7",
    chord: {
      fingers: [
        [3, 0],
        [2, 0],
        [1, 1, "1"],
      ],
      barres: [],
    },
  },
];
