// src/lib/tab/types.ts

/** Base duration + optional triplet. Dotted is carried separately on Beat. */
export type Duration =
  | "w" | "wt"
  | "h" | "ht"
  | "q" | "qt"
  | "e" | "et"
  | "s" | "st";

export type Technique = "h" | "p" | "b" | "t";

export type TabInstrument = "guitar" | "bass4" | "bass5" | "ukulele";

export interface TabNote {
  string: number; // 1 = highest-pitch string
  fret: number;
  finger?: number;
}

export interface Beat {
  notes: TabNote[]; // empty = rest
  duration: Duration;
  dotted: boolean;
  technique?: Technique;
  isRest: boolean;
}

export interface Measure {
  beats: Beat[];
  forcedBarline: boolean; // true when closed by an explicit "|"
}

export interface ParseError {
  line: number; // 1-based
  message: string;
}

export interface TimeSig {
  num: number;
  den: number;
}

export interface TabDoc {
  instrument: TabInstrument;
  tuning: string[]; // string 1 -> N
  keySig: string;
  timeSig: TimeSig;
  stringCount: number;
  measures: Measure[];
  errors: ParseError[];
}
