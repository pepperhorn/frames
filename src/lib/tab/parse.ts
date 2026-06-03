// src/lib/tab/parse.ts
import { beatFraction, measureCapacity, parseDurationToken } from "./durations";
import { stringCountFor, TAB_INSTRUMENTS } from "./instruments";
import type {
  Beat,
  ChordAnnotation,
  Duration,
  Measure,
  ParseError,
  TabDoc,
  TabInstrument,
  TabNote,
  Technique,
  TimeSig,
} from "./types";

export interface ParseOptions {
  instrument: TabInstrument;
  keySig: string;
  timeSig: TimeSig;
}

const TECHNIQUE_TOKENS: Record<string, Technique> = {
  "(h)": "h",
  "(p)": "p",
  "(b)": "b",
  "(t)": "t",
  hammer: "h",
  pull: "p",
  bend: "b",
  tap: "t",
};

const EPS = 1e-9;

/** A whitespace token inside [..] is a fret-code if it's all digits/x (compact,
 *  one char per string) or dash-separated fret numbers (for frets above 9). */
function isFretCode(s: string): boolean {
  return /^[0-9xX]{2,}$/.test(s) || /^([0-9]+|[xX])(-([0-9]+|[xX]))+$/.test(s);
}

function parseFretCode(code: string, stringCount: number): number[] | null {
  const segs = code.includes("-") ? code.split("-") : code.split("");
  const frets = segs.map((c) => (c === "x" || c === "X" ? -1 : Number(c)));
  if (frets.some((f) => !Number.isInteger(f) || f < -1)) return null;
  if (frets.length !== stringCount) return null;
  return frets;
}

/** Parse the inside of a [..] token into a chord annotation. Syntax:
 *  [Am] label only · [x02210] frame only · [Am:x02210] label + frame
 *  (label and fret-code separated by ":"). */
function parseChordToken(
  content: string,
  stringCount: number,
): { ann: ChordAnnotation } | { error: string } | null {
  const trimmed = content.trim();
  if (!trimmed) return null;

  let labelStr = "";
  let codeStr = "";
  const ci = trimmed.indexOf(":");
  if (ci >= 0) {
    labelStr = trimmed.slice(0, ci).trim();
    codeStr = trimmed.slice(ci + 1).trim();
  } else if (isFretCode(trimmed)) {
    codeStr = trimmed;
  } else {
    labelStr = trimmed;
  }

  const label = labelStr || undefined;
  let frame: { frets: number[] } | undefined;
  if (codeStr) {
    const frets = parseFretCode(codeStr, stringCount);
    if (!frets) {
      return { error: `chord code "${codeStr}" must have ${stringCount} strings (low to high)` };
    }
    frame = { frets };
  }
  if (!label && !frame) return null;
  return { ann: { label, frame } };
}

function parseNote(seg: string, stringCount: number): TabNote | null {
  const parts = seg.split("/");
  if (parts.length !== 2 && parts.length !== 3) return null;
  const nums = parts.map((p) => Number(p));
  if (nums.some((n) => !Number.isInteger(n))) return null;

  let finger: number | undefined;
  let fret: number;
  let string: number;
  if (parts.length === 3) {
    [finger, fret, string] = nums;
    if (finger < 1 || finger > 5) return null;
  } else {
    [fret, string] = nums;
  }
  if (fret < 0) return null;
  if (string < 1 || string > stringCount) return null;
  return finger === undefined ? { string, fret } : { string, fret, finger };
}

export function parseTab(text: string, opts: ParseOptions): TabDoc {
  const stringCount = stringCountFor(opts.instrument);
  const capacity = measureCapacity(opts.timeSig);

  const measures: Measure[] = [];
  const errors: ParseError[] = [];

  let curMeasure: Beat[] = [];
  let curFrac = 0;
  let curDuration: Duration = "q";
  let curDotted = false;
  let lastBeat: Beat | null = null;
  let pendingChord: ChordAnnotation | null = null;
  let pendingChordLine = 0;

  function closeMeasure(forced: boolean) {
    if (curMeasure.length === 0) return;
    measures.push({ beats: curMeasure, forcedBarline: forced });
    curMeasure = [];
    curFrac = 0;
  }

  function pushBeat(beat: Beat) {
    if (pendingChord) {
      beat.chord = pendingChord;
      pendingChord = null;
    }
    curMeasure.push(beat);
    lastBeat = beat;
    curFrac += beatFraction(beat.duration, beat.dotted);
    if (curFrac >= capacity - EPS) closeMeasure(false);
  }

  const lines = text.split("\n");
  lines.forEach((line, idx) => {
    const lineNo = idx + 1;
    // Match [..] groups (which may contain spaces) or any non-space run.
    const tokens = line.match(/\[[^\]]*\]|\S+/g) ?? [];

    for (const raw of tokens) {
      // Barline
      if (raw === "|") {
        closeMeasure(true);
        continue;
      }
      // Chord annotation attaches to the NEXT beat
      if (raw.startsWith("[") && raw.endsWith("]")) {
        const res = parseChordToken(raw.slice(1, -1), stringCount);
        if (res && "error" in res) {
          errors.push({ line: lineNo, message: res.error });
        } else if (res) {
          pendingChord = res.ann;
          pendingChordLine = lineNo;
        }
        continue;
      }
      // Technique attaches to the previous beat
      const tech = TECHNIQUE_TOKENS[raw.toLowerCase()];
      if (tech) {
        if (lastBeat) lastBeat.technique = tech;
        else errors.push({ line: lineNo, message: `technique "${raw}" has no preceding note` });
        continue;
      }
      // Repeat previous beat
      if (raw === "x" || raw === "X") {
        if (!lastBeat) {
          errors.push({ line: lineNo, message: `"${raw}" has no preceding beat to repeat` });
          continue;
        }
        const copy: Beat = {
          notes: lastBeat.notes.map((n) => ({ ...n })),
          duration: lastBeat.duration,
          dotted: lastBeat.dotted,
          technique: lastBeat.technique,
          isRest: lastBeat.isRest,
        };
        pushBeat(copy);
        continue;
      }

      // Beat: colon-split, optional leading duration prefix
      const segs = raw.split(":");
      let rest = segs;
      const dur = parseDurationToken(segs[0]);
      if (dur) {
        curDuration = dur.duration;
        curDotted = dur.dotted;
        rest = segs.slice(1);
      }

      // Rest beat: empty payload or explicit r/R
      if (rest.length === 0 || (rest.length === 1 && (rest[0] === "r" || rest[0] === "R"))) {
        pushBeat({ notes: [], duration: curDuration, dotted: curDotted, isRest: true });
        continue;
      }

      // Note / chord beat
      const notes: TabNote[] = [];
      let ok = true;
      for (const seg of rest) {
        const note = parseNote(seg, stringCount);
        if (!note) {
          errors.push({ line: lineNo, message: `couldn't read "${raw}"` });
          ok = false;
          break;
        }
        notes.push(note);
      }
      if (!ok) continue;
      pushBeat({ notes, duration: curDuration, dotted: curDotted, isRest: false });
    }
  });

  closeMeasure(false);

  if (pendingChord) {
    errors.push({ line: pendingChordLine, message: "chord annotation has no following note" });
  }

  return {
    instrument: opts.instrument,
    tuning: TAB_INSTRUMENTS[opts.instrument].tuning,
    keySig: opts.keySig,
    timeSig: opts.timeSig,
    stringCount,
    measures,
    errors,
  };
}
