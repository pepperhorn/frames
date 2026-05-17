import type { Chord, ChordSettings, Finger, FingerOptions } from "svguitar";
import {
  CHORDS_DB,
  INSTRUMENTS,
  dbPositionToChord,
  type InstrumentId,
} from "./instruments";
import { BASS_PRESETS, GUITAR_TOP3_PRESETS } from "./staticPresets";
import {
  KEY_OPTIONS,
  SCALES,
  generateScale,
  intervalToDegree,
  noteAt,
  noteToPitchClass,
  pitchClassToName,
  type LabelMode,
  type NoteName,
  type ScaleDot,
  type ScaleName,
} from "./scales";
import { notesFromChord, notesFromScaleDots, type NoteInfo } from "./notes";

export type OutputFormat = "svg" | "png";

export interface FrameRequest {
  mode: "chord" | "scale";
  format?: OutputFormat;
  instrument?: InstrumentId;
  imageScale?: number;
  raw?: boolean;
  settings?: Partial<ChordSettings>;
  chord?: ChordRequest;
  scale?: ScaleRequest;
}

export interface ChordRequest {
  key?: string;
  suffix?: string;
  positionIndex?: number;
  fingers?: Finger[];
  barres?: Chord["barres"];
  position?: number;
  title?: string;
}

export interface ScaleRequest {
  key: NoteName;
  scale: ScaleName;
  mode?: "span" | "position";
  fromFret?: number;
  toFret?: number;
  positionId?: string;
  stringFilter?: number[];
  labelMode?: LabelMode;
  title?: string;
}

export interface ResolvedFrame {
  chord: Chord;
  settings: ChordSettings;
  instrument: InstrumentId;
  notes: NoteInfo[];
}

export class FrameRequestError extends Error {}

function isInstrumentId(value: unknown): value is InstrumentId {
  return typeof value === "string" && value in INSTRUMENTS;
}

function baseSettings(instrument: InstrumentId): ChordSettings {
  const inst = INSTRUMENTS[instrument];
  return {
    orientation: "vertical" as ChordSettings["orientation"],
    strings: inst.strings,
    frets: inst.frets,
    tuning: inst.tuning,
    color: "#0a0a0a",
    backgroundColor: "transparent",
    fingerColor: "#0a0a0a",
    fingerTextColor: "#ffffff",
    fontFamily: "Poppins, sans-serif",
    fretSize: 1.5,
    fingerSize: 1,
    titleFontSize: 48,
    strokeWidth: 2,
    style: "normal" as ChordSettings["style"],
  };
}

function resolveChord(
  instrument: InstrumentId,
  req: ChordRequest | undefined,
): Chord {
  if (!req) {
    throw new FrameRequestError("chord mode requires a `chord` object");
  }

  // Raw chord passthrough.
  if (Array.isArray(req.fingers)) {
    return {
      fingers: req.fingers,
      barres: req.barres ?? [],
      ...(req.position ? { position: req.position } : {}),
      ...(req.title ? { title: req.title } : {}),
    };
  }

  if (!req.key || !req.suffix) {
    throw new FrameRequestError(
      "chord lookup requires `key` and `suffix` (or pass raw `fingers`)",
    );
  }

  const inst = INSTRUMENTS[instrument];
  const positionIndex = req.positionIndex ?? 0;

  if (instrument === "guitar" || instrument === "ukulele") {
    const db = CHORDS_DB[instrument];
    const entries = db.chords[req.key] ?? [];
    const entry = entries.find((e) => e.suffix === req.suffix);
    if (!entry) {
      throw new FrameRequestError(
        `No "${req.key}${req.suffix}" chord for ${instrument}`,
      );
    }
    const pos = entry.positions[positionIndex];
    if (!pos) {
      throw new FrameRequestError(
        `Position ${positionIndex} out of range (have ${entry.positions.length})`,
      );
    }
    const title = `${entry.key}${entry.suffix === "major" ? "" : entry.suffix}`;
    return dbPositionToChord(pos, inst.strings, req.title ?? title);
  }

  const list = instrument === "bass" ? BASS_PRESETS : GUITAR_TOP3_PRESETS;
  const preset = list.find((p) => p.key === req.key && p.suffix === req.suffix);
  if (!preset) {
    throw new FrameRequestError(
      `No "${req.key} ${req.suffix}" preset for ${instrument}`,
    );
  }
  const title = req.title ?? `${preset.key}${preset.suffix === "major" ? "" : preset.suffix}`;
  let chord: Chord = { ...preset.chord, title };
  if (instrument === "guitar-top3") {
    chord = {
      ...chord,
      fingers: [...chord.fingers, [4, "x"], [5, "x"], [6, "x"]] as Finger[],
    };
  }
  return chord;
}

function scaleDotsToChord(
  dots: ScaleDot[],
  position: number,
  instrument: InstrumentId,
  key: NoteName,
  labelMode: LabelMode,
  title: string,
): Chord {
  const rootColor = "#dc2626";
  const fingers: Finger[] = [];

  for (const dot of dots) {
    const isOpen = dot.fret === 0;
    const relFret = isOpen ? 0 : dot.fret - position + 1;
    if (relFret < 0) continue;

    let label: string | undefined;
    if (labelMode !== "none") {
      const pc = noteAt(instrument, dot.string, dot.fret);
      if (labelMode === "note") label = pitchClassToName(pc, key);
      else {
        const semis = (pc - noteToPitchClass(key) + 12) % 12;
        label = intervalToDegree(semis);
      }
    }

    if (dot.isRoot) {
      const opts: FingerOptions = {
        color: rootColor,
        shape: "circle" as FingerOptions["shape"],
        textColor: "#ffffff",
      };
      if (label) opts.text = label;
      fingers.push([dot.string, relFret as Finger[1], opts]);
    } else if (label) {
      fingers.push([dot.string, relFret as Finger[1], label]);
    } else {
      fingers.push([dot.string, relFret as Finger[1]]);
    }
  }

  return { fingers, barres: [], position, title };
}

export function resolveFrameRequest(body: unknown): ResolvedFrame {
  if (!body || typeof body !== "object") {
    throw new FrameRequestError("Request body must be a JSON object");
  }
  const req = body as FrameRequest;

  if (req.mode !== "chord" && req.mode !== "scale") {
    throw new FrameRequestError('`mode` must be "chord" or "scale"');
  }

  const instrument: InstrumentId = isInstrumentId(req.instrument)
    ? req.instrument
    : "guitar";

  if (req.mode === "chord") {
    const chord = resolveChord(instrument, req.chord);
    const settings: ChordSettings = { ...baseSettings(instrument), ...req.settings };
    return {
      chord,
      settings,
      instrument,
      notes: notesFromChord(instrument, chord),
    };
  }

  const sreq = req.scale;
  if (!sreq) {
    throw new FrameRequestError("scale mode requires a `scale` object");
  }
  if (!KEY_OPTIONS.includes(sreq.key as NoteName)) {
    throw new FrameRequestError(`Invalid key "${sreq.key}"`);
  }
  if (!(sreq.scale in SCALES)) {
    throw new FrameRequestError(`Invalid scale "${sreq.scale}"`);
  }

  const labelMode: LabelMode = sreq.labelMode ?? "note";
  const result = generateScale({
    key: sreq.key,
    scale: sreq.scale,
    instrument,
    mode: sreq.mode ?? "position",
    fromFret: sreq.fromFret,
    toFret: sreq.toFret,
    positionId: sreq.positionId,
    stringFilter: sreq.stringFilter,
    labelMode,
  });

  const title = sreq.title ?? "";
  const chord = scaleDotsToChord(
    result.dots,
    result.position,
    instrument,
    sreq.key,
    labelMode,
    title,
  );

  const settings: ChordSettings = {
    ...baseSettings(instrument),
    frets: result.fretSpan,
    ...req.settings,
  };

  return {
    chord,
    settings,
    instrument,
    notes: notesFromScaleDots(instrument, result.dots),
  };
}
