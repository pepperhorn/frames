import type { Chord, ChordSettings } from "svguitar";
import type { InstrumentId } from "@/lib/instruments";
import type { NoteName, ScaleFrame } from "@/lib/scales";
import type { TextStyle } from "@/components/FretboardChart";

export interface BaseFrameSpec {
  settings?: ChordSettings;
  textStyle?: TextStyle;
}

export interface ChordFrameSpec extends BaseFrameSpec {
  kind: "chord";
  chord: Chord;
}

export interface ScaleFrameSpec extends BaseFrameSpec {
  kind: "scale";
  frame: ScaleFrame;
  instrument: InstrumentId;
  key: NoteName;
}

export type FrameSpec = ChordFrameSpec | ScaleFrameSpec;
