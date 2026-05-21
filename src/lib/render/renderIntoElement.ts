import { SVGuitarChord, type Chord, type ChordSettings } from "svguitar";
import type { TextStyle } from "@/components/FretboardChart";
import { frameToChord } from "./scaleToChord";
import { postProcessSvg } from "./postProcess";
import type { FrameSpec } from "./types";

export interface RenderArgs {
  chord: Chord;
  settings?: ChordSettings;
  textStyle?: TextStyle;
}

/**
 * Render a chord into the given element using svguitar, then apply our
 * post-processing pipeline. Works in any environment with a DOM (browser or
 * JSDOM). Returns the resulting <svg> element, or null if the renderer failed
 * to produce one.
 */
export function renderChordInto(
  el: HTMLElement,
  { chord, settings, textStyle }: RenderArgs,
): SVGSVGElement | null {
  el.innerHTML = "";
  const chart = new SVGuitarChord(el);
  chart
    .configure({
      fontFamily: "Poppins, sans-serif",
      color: "#0a0a0a",
      backgroundColor: "transparent",
      ...settings,
    })
    .chord(chord)
    .draw();

  const svg = el.querySelector("svg") as SVGSVGElement | null;
  if (svg) postProcessSvg(svg, { settings, textStyle });
  return svg;
}

/**
 * Render any FrameSpec (chord or scale) into the given element. Resolves a
 * scale frame to its concrete Chord first.
 */
export function renderFrameInto(el: HTMLElement, spec: FrameSpec): SVGSVGElement | null {
  if (spec.kind === "chord") {
    return renderChordInto(el, {
      chord: spec.chord,
      settings: spec.settings,
      textStyle: spec.textStyle,
    });
  }
  const chord = frameToChord(spec.frame, {
    instrument: spec.instrument,
    key: spec.key,
  });
  const settings: ChordSettings = {
    ...(spec.settings ?? {}),
    frets: spec.frame.fretSpan,
  };
  return renderChordInto(el, { chord, settings, textStyle: spec.textStyle });
}
