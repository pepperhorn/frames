import { INSTRUMENTS, type InstrumentId } from "./instruments";

export type LabelMode = "note" | "degree" | "none";

export type DotShape = "circle" | "square" | "triangle";

export interface ScaleDot {
  string: number;
  fret: number;
  label?: string;
  color?: string;
  shape?: DotShape;
  isRoot?: boolean;
  isHighlight?: boolean;
}

export interface ScaleFrame {
  title: string;
  position: number;
  fretSpan: number;
  labelMode: LabelMode;
  rootColor: string;
  noteColor: string;
  highlightColor: string;
  dots: ScaleDot[];
}

export const SCALES = {
  major:           [0, 2, 4, 5, 7, 9, 11],
  naturalMinor:    [0, 2, 3, 5, 7, 8, 10],
  harmonicMinor:   [0, 2, 3, 5, 7, 8, 11],
  melodicMinor:    [0, 2, 3, 5, 7, 9, 11],
  dorian:          [0, 2, 3, 5, 7, 9, 10],
  phrygian:        [0, 1, 3, 5, 7, 8, 10],
  lydian:          [0, 2, 4, 6, 7, 9, 11],
  mixolydian:      [0, 2, 4, 5, 7, 9, 10],
  locrian:         [0, 1, 3, 5, 6, 8, 10],
  majorPentatonic: [0, 2, 4, 7, 9],
  minorPentatonic: [0, 3, 5, 7, 10],
  blues:           [0, 3, 5, 6, 7, 10],
} as const;

export type ScaleName = keyof typeof SCALES;

export const SCALE_LABELS: Record<ScaleName, string> = {
  major: "Major",
  naturalMinor: "Natural Minor",
  harmonicMinor: "Harmonic Minor",
  melodicMinor: "Melodic Minor",
  dorian: "Dorian",
  phrygian: "Phrygian",
  lydian: "Lydian",
  mixolydian: "Mixolydian",
  locrian: "Locrian",
  majorPentatonic: "Major Pentatonic",
  minorPentatonic: "Minor Pentatonic",
  blues: "Blues",
};

const SHARP_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLAT_NAMES  = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

export const KEY_OPTIONS = [
  "C", "C#", "Db", "D", "D#", "Eb", "E", "F", "F#", "Gb",
  "G", "G#", "Ab", "A", "A#", "Bb", "B",
] as const;

export type NoteName = (typeof KEY_OPTIONS)[number];

const PITCH_CLASS: Record<string, number> = {
  C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5,
  "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11,
};

export function noteToPitchClass(note: string): number {
  const pc = PITCH_CLASS[note];
  if (pc === undefined) throw new Error(`Unknown note: ${note}`);
  return pc;
}

function preferFlats(key: string): boolean {
  return key.includes("b") || key === "F";
}

export function pitchClassToName(pc: number, key: string): string {
  const idx = ((pc % 12) + 12) % 12;
  return preferFlats(key) ? FLAT_NAMES[idx] : SHARP_NAMES[idx];
}

const DEGREE_LABELS: Record<number, string> = {
  0: "1", 1: "b2", 2: "2", 3: "b3", 4: "3", 5: "4",
  6: "b5", 7: "5", 8: "b6", 9: "6", 10: "b7", 11: "7",
};

export function intervalToDegree(semitones: number): string {
  const i = ((semitones % 12) + 12) % 12;
  return DEGREE_LABELS[i] ?? String(i);
}

export interface PositionPreset {
  id: string;
  label: string;
  offsetFromRoot: number;
  span: number;
}

export const POSITIONS: Partial<Record<ScaleName, PositionPreset[]>> = {
  minorPentatonic: [
    { id: "box1", label: "Box 1 (root)",   offsetFromRoot: 0,  span: 4 },
    { id: "box2", label: "Box 2",          offsetFromRoot: 3,  span: 4 },
    { id: "box3", label: "Box 3",          offsetFromRoot: 5,  span: 4 },
    { id: "box4", label: "Box 4",          offsetFromRoot: 7,  span: 4 },
    { id: "box5", label: "Box 5",          offsetFromRoot: 10, span: 4 },
  ],
  majorPentatonic: [
    { id: "box1", label: "Box 1 (root)",   offsetFromRoot: 0,  span: 4 },
    { id: "box2", label: "Box 2",          offsetFromRoot: 2,  span: 4 },
    { id: "box3", label: "Box 3",          offsetFromRoot: 4,  span: 4 },
    { id: "box4", label: "Box 4",          offsetFromRoot: 7,  span: 4 },
    { id: "box5", label: "Box 5",          offsetFromRoot: 9,  span: 4 },
  ],
  major: [
    { id: "ionian",     label: "Ionian (root)",      offsetFromRoot: 0,  span: 5 },
    { id: "dorian",     label: "Dorian shape",       offsetFromRoot: 2,  span: 5 },
    { id: "phrygian",   label: "Phrygian shape",     offsetFromRoot: 4,  span: 5 },
    { id: "lydian",     label: "Lydian shape",       offsetFromRoot: 5,  span: 5 },
    { id: "mixolydian", label: "Mixolydian shape",   offsetFromRoot: 7,  span: 5 },
    { id: "aeolian",    label: "Aeolian shape",      offsetFromRoot: 9,  span: 5 },
    { id: "locrian",    label: "Locrian shape",      offsetFromRoot: 11, span: 5 },
  ],
};

/**
 * Given an instrument's tuning and a string number (1 = highest), return the
 * MIDI-style pitch class of the open string.
 */
function openStringPitchClass(instrumentId: InstrumentId, stringNum: number): number {
  const inst = INSTRUMENTS[instrumentId];
  // tuning is ordered low-pitch -> high-pitch; string 1 is the last entry.
  const tuningIdx = inst.strings - stringNum;
  const noteName = inst.tuning[tuningIdx];
  if (!noteName) throw new Error(`No tuning for string ${stringNum}`);
  return noteToPitchClass(noteName);
}

export function noteAt(instrumentId: InstrumentId, stringNum: number, fret: number): number {
  return (openStringPitchClass(instrumentId, stringNum) + fret) % 12;
}

export interface GenerateScaleOptions {
  key: NoteName;
  scale: ScaleName;
  instrument: InstrumentId;
  mode: "span" | "position";
  fromFret?: number;
  toFret?: number;
  positionId?: string;
  stringFilter?: number[];
  labelMode: LabelMode;
}

export interface GenerateScaleResult {
  dots: ScaleDot[];
  position: number;
  fretSpan: number;
}

export function resolveWindow(opts: GenerateScaleOptions): { position: number; fretSpan: number } {
  if (opts.mode === "span") {
    let from = Math.max(0, opts.fromFret ?? 0);
    let to = Math.max(from, opts.toFret ?? from + 4);
    if (to < from) [from, to] = [to, from];
    const position = Math.max(1, from || 1);
    const fretSpan = Math.max(1, to - from + 1);
    return { position, fretSpan };
  }
  const presets = POSITIONS[opts.scale] ?? [];
  const preset = presets.find((p) => p.id === opts.positionId) ?? presets[0];
  if (!preset) {
    return { position: 1, fretSpan: 5 };
  }
  const rootPc = noteToPitchClass(opts.key);
  // Find the lowest practical fret on the lowest-pitched string where the root sits,
  // then add the position offset.
  const inst = INSTRUMENTS[opts.instrument];
  const lowStringPc = openStringPitchClass(opts.instrument, inst.strings);
  const rootFretOnLowString = (rootPc - lowStringPc + 12) % 12;
  const start = rootFretOnLowString + preset.offsetFromRoot;
  const position = Math.max(1, start || 1);
  return { position, fretSpan: preset.span };
}

export function generateScale(opts: GenerateScaleOptions): GenerateScaleResult {
  const { position, fretSpan } = resolveWindow(opts);
  const rootPc = noteToPitchClass(opts.key);
  const intervals = SCALES[opts.scale];
  const scalePcs = new Set(intervals.map((i) => (rootPc + i) % 12));
  const inst = INSTRUMENTS[opts.instrument];
  const allStrings = Array.from({ length: inst.strings }, (_, i) => i + 1);
  const stringFilter =
    opts.stringFilter && opts.stringFilter.length > 0 ? opts.stringFilter : allStrings;

  const dots: ScaleDot[] = [];
  const fretStart = position;
  const fretEnd = position + fretSpan - 1;
  const includeOpen = position === 1;

  for (const stringNum of stringFilter) {
    const fretsToCheck: number[] = [];
    if (includeOpen) fretsToCheck.push(0);
    for (let f = fretStart; f <= fretEnd; f++) fretsToCheck.push(f);

    for (const fret of fretsToCheck) {
      const pc = noteAt(opts.instrument, stringNum, fret);
      if (!scalePcs.has(pc)) continue;
      const isRoot = pc === rootPc;
      const semitonesFromRoot = (pc - rootPc + 12) % 12;
      let label: string | undefined;
      if (opts.labelMode === "note") label = pitchClassToName(pc, opts.key);
      else if (opts.labelMode === "degree") label = intervalToDegree(semitonesFromRoot);
      const dot: ScaleDot = { string: stringNum, fret };
      if (isRoot) dot.isRoot = true;
      if (label !== undefined) dot.label = label;
      dots.push(dot);
    }
  }

  return { dots, position, fretSpan };
}

export function makeBlankScaleFrame(instrumentId: InstrumentId): ScaleFrame {
  const inst = INSTRUMENTS[instrumentId];
  return {
    title: "",
    position: 1,
    fretSpan: inst.frets,
    labelMode: "note",
    rootColor: "#dc2626",
    noteColor: "#0a0a0a",
    highlightColor: "#f59e0b",
    dots: [],
  };
}

export function mergeDots(existing: ScaleDot[], incoming: ScaleDot[]): ScaleDot[] {
  const key = (d: ScaleDot) => `${d.string}:${d.fret}`;
  const seen = new Map<string, ScaleDot>();
  for (const d of existing) seen.set(key(d), d);
  for (const d of incoming) seen.set(key(d), d);
  return Array.from(seen.values());
}
