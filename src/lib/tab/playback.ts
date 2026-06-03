// src/lib/tab/playback.ts
import { Soundfont } from "smplr";
import { beatFraction } from "./durations";
import { TAB_INSTRUMENTS } from "./instruments";
import { noteToMidi } from "./pitch";
import type { TabDoc } from "./types";

export interface ScheduledBeat {
  atSec: number;
  durSec: number;
  midis: number[];
  globalBeatIndex: number;
}

/** Pure timing math — unit tested. quarter = 60/bpm seconds. */
export function buildSchedule(doc: TabDoc, bpm: number): ScheduledBeat[] {
  const quarterSec = 60 / bpm;
  const sched: ScheduledBeat[] = [];
  let t = 0;
  let globalBeatIndex = 0;
  for (const measure of doc.measures) {
    for (const beat of measure.beats) {
      // fraction-of-whole * 4 = number of quarter-notes
      const durSec = beatFraction(beat.duration, beat.dotted) * 4 * quarterSec;
      const midis = beat.isRest
        ? []
        : beat.notes.map((n) => noteToMidi(doc.instrument, n));
      sched.push({ atSec: t, durSec, midis, globalBeatIndex: globalBeatIndex++ });
      t += durSec;
    }
  }
  return sched;
}

export interface TabPlayerHandle {
  stop: () => void;
}

/**
 * Load the right MusyngKite patch, schedule every beat against the AudioContext
 * clock, and drive an onCursor callback for the moving highlight. Must be called
 * from a user gesture (Play click) so the AudioContext can start.
 */
export async function createTabPlayer(
  doc: TabDoc,
  bpm: number,
  callbacks: { onCursor: (globalBeatIndex: number) => void; onEnd: () => void },
): Promise<TabPlayerHandle> {
  const context = new AudioContext();
  await context.resume();

  const patch = TAB_INSTRUMENTS[doc.instrument].patch;
  const instrument = Soundfont(context, { instrument: patch });
  await instrument.load;

  const sched = buildSchedule(doc, bpm);
  const start = context.currentTime + 0.1;
  let stopped = false;
  const timers: ReturnType<typeof setTimeout>[] = [];

  for (const beat of sched) {
    for (const midi of beat.midis) {
      instrument.start({
        note: midi,
        time: start + beat.atSec,
        duration: beat.durSec,
      });
    }
    // Cursor highlight, driven off wall-clock relative to audio start.
    timers.push(
      setTimeout(() => {
        if (!stopped) callbacks.onCursor(beat.globalBeatIndex);
      }, beat.atSec * 1000 + 100),
    );
  }

  const totalMs =
    (sched.length ? sched[sched.length - 1].atSec + sched[sched.length - 1].durSec : 0) * 1000 +
    150;
  timers.push(
    setTimeout(() => {
      if (!stopped) callbacks.onEnd();
    }, totalMs),
  );

  return {
    stop: () => {
      stopped = true;
      timers.forEach(clearTimeout);
      instrument.stop();
      void context.close();
    },
  };
}
