import type { Chord, Finger, FingerOptions } from "svguitar";
import type { InstrumentId } from "@/lib/instruments";
import {
  intervalToDegree,
  noteAt,
  noteToPitchClass,
  pitchClassToName,
  type NoteName,
  type ScaleDot,
  type ScaleFrame,
} from "@/lib/scales";

export interface ScaleContext {
  instrument: InstrumentId;
  key: NoteName;
}

export function autoLabelFor(
  dot: ScaleDot,
  frame: Pick<ScaleFrame, "labelMode">,
  context: ScaleContext,
): string | undefined {
  if (frame.labelMode === "none") return undefined;
  const pc = noteAt(context.instrument, dot.string, dot.fret);
  if (frame.labelMode === "note") return pitchClassToName(pc, context.key);
  const rootPc = noteToPitchClass(context.key);
  const semis = (pc - rootPc + 12) % 12;
  return intervalToDegree(semis);
}

export function frameToChord(frame: ScaleFrame, context: ScaleContext): Chord {
  const fingers: Finger[] = [];
  for (const dot of frame.dots) {
    const isOpen = dot.fret === 0;
    const relFret = isOpen ? 0 : dot.fret - frame.position + 1;
    if (relFret < 0) continue;

    const labelOverride = dot.label;
    const label =
      labelOverride !== undefined ? labelOverride : autoLabelFor(dot, frame, context);
    const color =
      dot.color ??
      (dot.isHighlight
        ? frame.highlightColor
        : dot.isRoot
        ? frame.rootColor
        : frame.noteColor);
    const shape = dot.shape ?? "circle";
    const needsOptions =
      dot.color !== undefined ||
      dot.shape !== undefined ||
      dot.isRoot ||
      dot.isHighlight;

    if (needsOptions) {
      const opts: FingerOptions = {
        color,
        shape: shape as FingerOptions["shape"],
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
  return {
    fingers,
    barres: [],
    position: frame.position,
    title: frame.title,
  };
}
