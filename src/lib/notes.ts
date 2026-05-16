import type { Chord } from "svguitar";
import { INSTRUMENTS, type InstrumentId } from "./instruments";
import type { ScaleDot } from "./scales";

export interface NoteInfo {
  name: string;
  midi: number;
}

const NOTE_NAMES = [
  "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
];

/**
 * MIDI numbers of each open string, ordered low-pitch -> high-pitch to match
 * INSTRUMENTS[].tuning. Ukulele uses standard reentrant tuning (high G).
 */
const OPEN_STRING_MIDI: Record<InstrumentId, number[]> = {
  guitar: [40, 45, 50, 55, 59, 64], // E2 A2 D3 G3 B3 E4
  "guitar-top3": [40, 45, 50, 55, 59, 64],
  bass: [28, 33, 38, 43], // E1 A1 D2 G2
  ukulele: [67, 60, 64, 69], // G4 C4 E4 A4
};

export function midiToName(midi: number): string {
  const name = NOTE_NAMES[((midi % 12) + 12) % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${name}${octave}`;
}

function openStringMidi(instrument: InstrumentId, stringNum: number): number {
  const inst = INSTRUMENTS[instrument];
  const tuningIdx = inst.strings - stringNum;
  const midi = OPEN_STRING_MIDI[instrument]?.[tuningIdx];
  if (midi === undefined) {
    throw new Error(`No open-string MIDI for string ${stringNum} on ${instrument}`);
  }
  return midi;
}

/** Absolute fretted pitch as a MIDI number (fret 0 = open string). */
export function stringFretToMidi(
  instrument: InstrumentId,
  stringNum: number,
  absoluteFret: number,
): number {
  return openStringMidi(instrument, stringNum) + absoluteFret;
}

function toNoteInfos(midis: number[]): NoteInfo[] {
  const unique = Array.from(new Set(midis)).sort((a, b) => a - b);
  return unique.map((m) => ({ name: midiToName(m), midi: m }));
}

/** Ascending, de-duplicated notes for every dot rendered in a scale frame. */
export function notesFromScaleDots(
  instrument: InstrumentId,
  dots: ScaleDot[],
): NoteInfo[] {
  const midis = dots.map((d) => stringFretToMidi(instrument, d.string, d.fret));
  return toNoteInfos(midis);
}

/**
 * Ascending, de-duplicated notes for a svguitar Chord. `chord.position` is the
 * absolute fret of the first displayed fret; finger fret values are relative to
 * it (1 = the fret at `position`), 0 = open string, "x" = muted (skipped).
 */
export function notesFromChord(
  instrument: InstrumentId,
  chord: Chord,
): NoteInfo[] {
  const basePosition = chord.position && chord.position > 0 ? chord.position : 1;
  const midis: number[] = [];

  for (const finger of chord.fingers) {
    const [stringNum, value] = finger;
    if (value === "x" || value === undefined) continue;
    const fretValue = typeof value === "number" ? value : Number(value);
    if (Number.isNaN(fretValue)) continue;
    const absoluteFret = fretValue === 0 ? 0 : basePosition - 1 + fretValue;
    midis.push(stringFretToMidi(instrument, stringNum, absoluteFret));
  }

  for (const barre of chord.barres ?? []) {
    const from = Math.max(barre.fromString, barre.toString);
    const to = Math.min(barre.fromString, barre.toString);
    const absoluteFret = basePosition - 1 + barre.fret;
    for (let s = to; s <= from; s++) {
      if (chord.fingers.some((f) => f[0] === s)) continue;
      midis.push(stringFretToMidi(instrument, s, absoluteFret));
    }
  }

  return toNoteInfos(midis);
}
