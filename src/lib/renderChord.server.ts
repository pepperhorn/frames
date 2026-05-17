import { createRequire } from "node:module";
import type { Chord, ChordSettings } from "svguitar";

export interface RenderedSvg {
  svg: string;
  width: number;
  height: number;
}

const require = createRequire(import.meta.url);

// svguitar's default entry is a UMD bundle with svg.js inlined (no
// registerWindow hook). The unbundled CJS build requires the external
// @svgdotjs/svg.js, whose Node build pairs with svgdom for SSR.
type SvgJs = {
  registerWindow: (w: unknown, d: unknown) => void;
  SVG: (node?: unknown) => { svg: () => string };
};
type SvgGuitar = { SVGuitarChord: new (el: unknown) => SvguitarInstance };
type SvguitarInstance = {
  configure: (s: ChordSettings) => SvguitarInstance;
  chord: (c: Chord) => SvguitarInstance;
  draw: () => void;
};

let modules: { svgjs: SvgJs; svguitar: SvgGuitar; createSVGWindow: () => any } | null =
  null;

function load() {
  if (!modules) {
    modules = {
      svgjs: require("@svgdotjs/svg.js") as SvgJs,
      svguitar: require("svguitar/dist/lib/svguitar.js") as SvgGuitar,
      createSVGWindow: (require("svgdom") as { createSVGWindow: () => any })
        .createSVGWindow,
    };
  }
  return modules;
}

// svg.js holds a single global "current window"; serialize renders so two
// concurrent requests can't register conflicting windows mid-draw.
let renderQueue: Promise<unknown> = Promise.resolve();

export function renderChordSvg(
  chord: Chord,
  settings?: ChordSettings,
): Promise<RenderedSvg> {
  const run = renderQueue.then(() => renderChordSvgUnsafe(chord, settings));
  renderQueue = run.catch(() => undefined);
  return run;
}

function renderChordSvgUnsafe(
  chord: Chord,
  settings?: ChordSettings,
): RenderedSvg {
  const { svgjs, svguitar, createSVGWindow } = load();
  const window = createSVGWindow();
  const document = window.document;
  svgjs.registerWindow(window, document);

  const root = document.documentElement;
  const chart = new svguitar.SVGuitarChord(root);
  chart
    .configure({
      fontFamily: "Poppins, sans-serif",
      color: "#0a0a0a",
      backgroundColor: "transparent",
      ...settings,
    } as ChordSettings)
    .chord(chord)
    .draw();

  const source = svgjs.SVG(root).svg();
  const vb = root
    .getAttribute("viewBox")
    ?.split(/[\s,]+/)
    .map(Number);
  const width = vb && vb.length === 4 ? vb[2] : 400;
  const height = vb && vb.length === 4 ? vb[3] : 500;

  return { svg: source, width, height };
}

export async function svgToPng(
  rendered: RenderedSvg,
  options: { scale?: number; backgroundColor?: string } = {},
): Promise<Buffer> {
  const sharp = require("sharp") as typeof import("sharp");
  const scale = options.scale && options.scale > 0 ? options.scale : 3;
  const targetWidth = Math.max(1, Math.round(rendered.width * scale));

  let pipeline = sharp(Buffer.from(rendered.svg), {
    density: 72 * scale,
  }).resize({ width: targetWidth });

  if (options.backgroundColor && options.backgroundColor !== "transparent") {
    pipeline = pipeline.flatten({ background: options.backgroundColor });
  }

  return pipeline.png().toBuffer();
}
