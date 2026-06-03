import { CHORDS_DB } from "@/lib/instruments";
import type { ChordsDb } from "@/lib/instruments";
import type { TabInstrument } from "./types";

// chords-db only ships guitar + ukulele voicings.
function dbFor(instrument: TabInstrument): ChordsDb | null {
  if (instrument === "guitar") return CHORDS_DB.guitar;
  if (instrument === "ukulele") return CHORDS_DB.ukulele;
  return null; // bass has no chord library
}

// chords-db spells some roots sharp, some flat; accept both enharmonic forms.
function rootAliases(key: string): string[] {
  const map: Record<string, string[]> = {
    Csharp: ["C#", "Db"],
    Dsharp: ["D#", "Eb"],
    Eb: ["Eb", "D#"],
    Fsharp: ["F#", "Gb"],
    Gsharp: ["G#", "Ab"],
    Ab: ["Ab", "G#"],
    Asharp: ["A#", "Bb"],
    Bb: ["Bb", "A#"],
  };
  return map[key] ?? [key];
}

function suffixAliases(suffix: string): string[] {
  if (suffix === "major") return [""];
  if (suffix === "minor") return ["m", "min"];
  return [suffix];
}

// Build a lowercase name -> absolute frets (low->high) map once per kit.
const cache = new Map<ChordsDb, Map<string, number[]>>();
function nameMap(db: ChordsDb): Map<string, number[]> {
  const cached = cache.get(db);
  if (cached) return cached;
  const map = new Map<string, number[]>();
  for (const key of Object.keys(db.chords)) {
    for (const entry of db.chords[key]) {
      const pos = entry.positions[0];
      if (!pos) continue;
      // chords-db frets are relative to baseFret; -1 muted, 0 open.
      const frets = pos.frets.map((f) => (f <= 0 ? f : pos.baseFret - 1 + f));
      for (const root of rootAliases(entry.key)) {
        for (const sfx of suffixAliases(entry.suffix)) {
          const name = `${root}${sfx}`.toLowerCase();
          if (!map.has(name)) map.set(name, frets);
        }
      }
    }
  }
  cache.set(db, map);
  return map;
}

/** Best-effort lookup of a chord label (e.g. "Am", "G7", "F#m") to a voicing's
 *  absolute frets (low -> high). Returns null when unknown or unsupported. */
export function lookupChordFrets(label: string, instrument: TabInstrument): number[] | null {
  const db = dbFor(instrument);
  if (!db) return null;
  const frets = nameMap(db).get(label.trim().toLowerCase());
  return frets ? [...frets] : null;
}
