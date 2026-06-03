// src/lib/tab/pitch.ts
import { TAB_INSTRUMENTS } from "./instruments";
import type { TabInstrument, TabNote } from "./types";

export function noteToMidi(instrument: TabInstrument, note: TabNote): number {
  const open = TAB_INSTRUMENTS[instrument].openMidi[note.string - 1];
  return open + note.fret;
}

export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}
