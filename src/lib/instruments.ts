import type { Chord } from "svguitar";
import guitarDb from "@tombatossals/chords-db/lib/guitar.json";
import ukuleleDb from "@tombatossals/chords-db/lib/ukulele.json";

export type InstrumentId = "guitar" | "bass" | "ukulele" | "guitar-top3";

export interface InstrumentConfig {
  id: InstrumentId;
  label: string;
  description: string;
  strings: number;
  frets: number;
  tuning: string[];
  presetSource: "chords-db" | "static";
}

export const INSTRUMENTS: Record<InstrumentId, InstrumentConfig> = {
  guitar: {
    id: "guitar",
    label: "Guitar",
    description: "Standard 6-string guitar (E A D G B E)",
    strings: 6,
    frets: 5,
    tuning: ["E", "A", "D", "G", "B", "E"],
    presetSource: "chords-db",
  },
  bass: {
    id: "bass",
    label: "Bass",
    description: "4-string bass (E A D G)",
    strings: 4,
    frets: 5,
    tuning: ["E", "A", "D", "G"],
    presetSource: "static",
  },
  ukulele: {
    id: "ukulele",
    label: "Ukulele",
    description: "Standard ukulele (G C E A)",
    strings: 4,
    frets: 5,
    tuning: ["G", "C", "E", "A"],
    presetSource: "chords-db",
  },
  "guitar-top3": {
    id: "guitar-top3",
    label: "Guitar (top 3)",
    description: "Full 6-string guitar, beginner voicings on the top 3 strings only (G B E)",
    strings: 6,
    frets: 4,
    tuning: ["E", "A", "D", "G", "B", "E"],
    presetSource: "static",
  },
};

export type ChordsDbPosition = {
  frets: number[];
  fingers: number[];
  baseFret: number;
  barres: number[];
  capo?: boolean;
  midi?: number[];
};

export type ChordsDbEntry = {
  key: string;
  suffix: string;
  positions: ChordsDbPosition[];
};

export type ChordsDb = {
  main: { strings: number; fretsOnChord: number; name: string };
  tunings: Record<string, string[]>;
  keys: string[];
  suffixes: string[];
  chords: Record<string, ChordsDbEntry[]>;
};

export const CHORDS_DB: Record<"guitar" | "ukulele", ChordsDb> = {
  guitar: guitarDb as unknown as ChordsDb,
  ukulele: ukuleleDb as unknown as ChordsDb,
};

/**
 * Convert a chords-db position into an svguitar Chord.
 * chords-db `frets` is ordered low-pitch -> high-pitch (string N down to string 1).
 * svguitar string numbering: 1 = highest pitch (last index in db array).
 */
export function dbPositionToChord(
  pos: ChordsDbPosition,
  stringCount: number,
  title?: string,
): Chord {
  const fingers: Chord["fingers"] = [];
  const barreFrets = new Set(pos.barres);

  pos.frets.forEach((fret, dbIdx) => {
    const stringNum = stringCount - dbIdx;
    if (fret === -1) {
      fingers.push([stringNum, "x"]);
      return;
    }
    if (fret === 0) {
      fingers.push([stringNum, 0]);
      return;
    }
    // skip strings that are part of a barre — barre will draw them
    if (barreFrets.has(fret)) return;
    const fingerNum = pos.fingers[dbIdx];
    const text = fingerNum && fingerNum > 0 ? String(fingerNum) : undefined;
    fingers.push(text ? [stringNum, fret, text] : [stringNum, fret]);
  });

  const barres: Chord["barres"] = pos.barres.map((fret) => {
    // find span of strings using this fret
    const playingIdxs = pos.frets
      .map((f, i) => (f === fret ? i : -1))
      .filter((i) => i >= 0);
    const stringNums = playingIdxs.map((i) => stringCount - i);
    const fromString = Math.max(...stringNums);
    const toString = Math.min(...stringNums);
    // finger label: usually 1 for the index finger barre
    const fingerNums = playingIdxs
      .map((i) => pos.fingers[i])
      .filter((n): n is number => typeof n === "number" && n > 0);
    const fingerLabel = fingerNums.length ? String(Math.min(...fingerNums)) : undefined;
    return { fromString, toString, fret, ...(fingerLabel ? { text: fingerLabel } : {}) };
  });

  return {
    fingers,
    barres,
    position: pos.baseFret,
    ...(title ? { title } : {}),
  };
}
