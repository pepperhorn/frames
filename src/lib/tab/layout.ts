// src/lib/tab/layout.ts
import { beatFraction } from "./durations";
import type { Beat, Duration, Measure, TabDoc, Technique, TimeSig } from "./types";

export const LAYOUT = {
  LINE_GAP: 14,
  LEFT_PAD: 60,
  RIGHT_PAD: 16,
  TOP_PAD: 32,
  STEM_LEN: 20,
  SYSTEM_GAP: 72,
  MEASURE_PAD: 16,
  BEAT_MIN_W: 28,
  BEAT_SCALE: 150,
  BOTTOM_PAD: 56,
} as const;

export interface PlacedBeat {
  x: number; // center x of the beat slot
  measureIndex: number;
  globalBeatIndex: number;
  notes: { string: number; fret: number; finger?: number }[];
  duration: Duration;
  dotted: boolean;
  technique?: Technique;
  isRest: boolean;
  beamGroup: number | null; // shared id for beamed runs; null if not beam-eligible
  tripletGroup: number | null; // shared id for consecutive triplet beats; null otherwise
  flags: number; // 0 = quarter or longer, 1 = eighth, 2 = sixteenth
}

export interface PlacedBarline {
  x: number;
  final: boolean;
}

export interface TabSystem {
  yTop: number;
  lineYs: number[];
  lineX0: number;
  lineX1: number;
  beats: PlacedBeat[];
  barlines: PlacedBarline[];
}

export interface TabLayout {
  systems: TabSystem[];
  width: number;
  height: number;
  stringCount: number;
  tuning: string[];
  timeSig: TimeSig;
  showStems: boolean;
  showFingerings: boolean;
}

export interface LayoutOptions {
  width: number;
  tuning: string[];
  stringCount: number;
  timeSig: TimeSig;
  showStems: boolean;
  showFingerings: boolean;
}

function flagsFor(duration: Duration): number {
  const base = duration.endsWith("t") ? duration.slice(0, -1) : duration;
  if (base === "e") return 1;
  if (base === "s") return 2;
  return 0;
}

function beatWidth(beat: Beat): number {
  const frac = beatFraction(beat.duration, beat.dotted);
  return LAYOUT.BEAT_MIN_W + frac * LAYOUT.BEAT_SCALE;
}

function measureWidth(measure: Measure): number {
  const beats = measure.beats.reduce((sum, b) => sum + beatWidth(b), 0);
  return beats + LAYOUT.MEASURE_PAD;
}

export function layoutTab(doc: TabDoc, opts: LayoutOptions): TabLayout {
  const avail = opts.width - LAYOUT.LEFT_PAD - LAYOUT.RIGHT_PAD;
  const staffHeight = (opts.stringCount - 1) * LAYOUT.LINE_GAP;

  // 1. Greedy pack measures into systems by width (always >=1 measure per system).
  const rows: Measure[][] = [];
  let row: Measure[] = [];
  let rowWidth = 0;
  for (const measure of doc.measures) {
    const w = measureWidth(measure);
    if (row.length > 0 && rowWidth + w > avail) {
      rows.push(row);
      row = [];
      rowWidth = 0;
    }
    row.push(measure);
    rowWidth += w;
  }
  if (row.length > 0) rows.push(row);

  // 2. Place beats/barlines per system; assign global indices + beam groups.
  const systems: TabSystem[] = [];
  let globalBeatIndex = 0;
  let beamGroupSeq = 0;
  let tripletGroupSeq = 0;
  const totalMeasures = doc.measures.length;
  let measureCursor = 0;

  rows.forEach((rowMeasures, rowIdx) => {
    const yTop = LAYOUT.TOP_PAD + rowIdx * (staffHeight + LAYOUT.SYSTEM_GAP);
    const lineYs = Array.from({ length: opts.stringCount }, (_, i) => yTop + i * LAYOUT.LINE_GAP);

    const beats: PlacedBeat[] = [];
    const barlines: PlacedBarline[] = [];
    let x = LAYOUT.LEFT_PAD;

    rowMeasures.forEach((measure) => {
      const localMeasureIndex = measureCursor;

      // Beam grouping within this measure: runs of beam-eligible beats,
      // broken by a non-eligible beat or a rest.
      let activeGroup: number | null = null;
      const groupForBeat: (number | null)[] = [];
      measure.beats.forEach((b) => {
        const eligible = !b.isRest && flagsFor(b.duration) > 0;
        if (!eligible) {
          activeGroup = null;
          groupForBeat.push(null);
          return;
        }
        if (activeGroup === null) activeGroup = beamGroupSeq++;
        groupForBeat.push(activeGroup);
      });

      // Triplet grouping: runs of triplet-duration beats (duration ends in "t"),
      // broken by any non-triplet beat. Each run >=1 gets a "3" bracket.
      let activeTriplet: number | null = null;
      const tripletForBeat: (number | null)[] = [];
      measure.beats.forEach((b) => {
        const isTriplet = b.duration.endsWith("t");
        if (!isTriplet) {
          activeTriplet = null;
          tripletForBeat.push(null);
          return;
        }
        if (activeTriplet === null) activeTriplet = tripletGroupSeq++;
        tripletForBeat.push(activeTriplet);
      });

      measure.beats.forEach((b, i) => {
        const w = beatWidth(b);
        beats.push({
          x: x + w / 2,
          measureIndex: localMeasureIndex,
          globalBeatIndex: globalBeatIndex++,
          notes: b.notes,
          duration: b.duration,
          dotted: b.dotted,
          technique: b.technique,
          isRest: b.isRest,
          beamGroup: groupForBeat[i],
          tripletGroup: tripletForBeat[i],
          flags: flagsFor(b.duration),
        });
        x += w;
      });

      const barX = x + LAYOUT.MEASURE_PAD / 2;
      barlines.push({ x: barX, final: localMeasureIndex === totalMeasures - 1 });
      x += LAYOUT.MEASURE_PAD;
      measureCursor += 1;
    });

    systems.push({
      yTop,
      lineYs,
      lineX0: LAYOUT.LEFT_PAD,
      lineX1: x,
      beats,
      barlines,
    });
  });

  const lastSystem = systems[systems.length - 1];
  const height =
    (lastSystem ? lastSystem.yTop + staffHeight : LAYOUT.TOP_PAD) +
    LAYOUT.STEM_LEN +
    LAYOUT.BOTTOM_PAD;

  return {
    systems,
    width: opts.width,
    height,
    stringCount: opts.stringCount,
    tuning: opts.tuning,
    timeSig: opts.timeSig,
    showStems: opts.showStems,
    showFingerings: opts.showFingerings,
  };
}
