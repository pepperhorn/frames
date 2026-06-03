// src/lib/tab/instruments.ts
import type { TabInstrument } from "./types";

export interface TabInstrumentConfig {
  id: TabInstrument;
  label: string;
  tuning: string[]; // string 1 -> N (high -> low)
  openMidi: number[]; // same order as tuning
  patch: string; // MusyngKite soundfont instrument name
}

export const TAB_INSTRUMENTS: Record<TabInstrument, TabInstrumentConfig> = {
  guitar: {
    id: "guitar",
    label: "Guitar",
    tuning: ["E", "B", "G", "D", "A", "E"],
    openMidi: [64, 59, 55, 50, 45, 40],
    patch: "electric_guitar_jazz",
  },
  bass4: {
    id: "bass4",
    label: "Bass (4)",
    tuning: ["G", "D", "A", "E"],
    openMidi: [43, 38, 33, 28],
    patch: "electric_bass_finger",
  },
  bass5: {
    id: "bass5",
    label: "Bass (5)",
    tuning: ["G", "D", "A", "E", "B"],
    openMidi: [43, 38, 33, 28, 23],
    patch: "electric_bass_finger",
  },
  ukulele: {
    id: "ukulele",
    label: "Ukulele",
    tuning: ["A", "E", "C", "G"],
    openMidi: [69, 64, 60, 67],
    patch: "banjo",
  },
};

export function stringCountFor(instrument: TabInstrument): number {
  return TAB_INSTRUMENTS[instrument].tuning.length;
}
