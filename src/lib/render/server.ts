import { createSVGWindow, createHTMLWindow } from "svgdom";
import { registerWindow } from "@svgdotjs/svg.js";
import type { FrameSpec } from "./types";
import { measureText } from "./textMeasure";
import { renderFrameInBrowser } from "./browserHost";

/**
 * Server-side rendering. Two paths:
 *  - normal style: svgdom + svg.js. Cheap (~5ms), no browser needed.
 *  - handdrawn style: real headless Chromium via browserHost. Required
 *    because RoughJsRenderer + svgdom don't compose (classList missing on
 *    SVG nodes, async embedDefs that crashes the process, RoughJS itself
 *    measures real DOM elements).
 *
 * Text-width measurement under svgdom uses opentype.js (textMeasure.ts) so
 * the post-process re-anchoring and title auto-shrink work for the fonts
 * we ship (Poppins, Patrick Hand, Caveat, Shadows Into Light, Inter).
 */

let postProcessImpl:
  | ((svg: SVGSVGElement, opts: { settings?: unknown; textStyle?: unknown }) => void)
  | null = null;
let scaleToChordImpl: typeof import("./scaleToChord") | null = null;
let SVGuitarChordCtor: typeof import("svguitar").SVGuitarChord | null = null;

async function loadModules() {
  if (SVGuitarChordCtor) return;

  // svguitar inlines its own SVG.js bundle. That bundle checks `typeof
  // window` at module-init time, so we install svgdom globals BEFORE the
  // first import of svguitar. createHTMLWindow exposes both HTMLElement
  // and SVGElement on the global, which keeps third-party code happy.
  const bootstrapWindow = createHTMLWindow();
  installGetBBoxShim(bootstrapWindow);
  const bw = bootstrapWindow as unknown as Record<string, unknown>;
  const g = globalThis as unknown as Record<string, unknown>;
  g.window = bootstrapWindow;
  g.document = bw.document;
  g.HTMLElement = bw.HTMLElement;
  g.SVGElement = bw.SVGElement;
  g.Element = bw.Element;
  g.Node = bw.Node;

  const [pp, st, sv] = await Promise.all([
    import("./postProcess"),
    import("./scaleToChord"),
    import("svguitar"),
  ]);
  postProcessImpl = pp.postProcessSvg as typeof postProcessImpl;
  scaleToChordImpl = st;
  SVGuitarChordCtor = sv.SVGuitarChord;
}

function installGetBBoxShim(window: unknown) {
  const w = window as { SVGElement?: { prototype: Record<string, unknown> } };
  const proto = w.SVGElement?.prototype;
  if (!proto || proto.getBBox) return;

  const zero = (): DOMRect =>
    ({
      x: 0, y: 0, width: 0, height: 0,
      top: 0, right: 0, bottom: 0, left: 0,
      toJSON() { return this; },
    } as DOMRect);

  proto.getBBox = function (this: SVGElement): DOMRect {
    const tag = (this.tagName || "").toLowerCase();
    if (tag !== "text") return zero();

    const raw = this.textContent;
    const text = typeof raw === "string" ? raw : "";
    if (!text) return zero();

    const family = this.getAttribute("font-family");
    const weightAttr = this.getAttribute("font-weight") ?? "400";
    const weight = Number(weightAttr) || 400;
    const sizeAttr = this.getAttribute("font-size") ?? "16";
    const fontSize = parseFloat(sizeAttr) || 16;

    let metrics;
    try {
      metrics = measureText(family, weight, fontSize, text);
    } catch {
      return zero();
    }
    if (!metrics) return zero();

    const x = parseFloat(this.getAttribute("x") ?? "0") || 0;
    const y = parseFloat(this.getAttribute("y") ?? "0") || 0;
    // SVG text y is the baseline by default. Translate to top-left bbox.
    const bx = x;
    const by = y - metrics.ascender;
    return {
      x: bx,
      y: by,
      width: metrics.width,
      height: metrics.height,
      top: by,
      right: bx + metrics.width,
      bottom: by + metrics.height,
      left: bx,
      toJSON() { return this; },
    } as DOMRect;
  };
}

export interface RenderToSvgResult {
  svg: string;
  width: number;
  height: number;
}

function parseSvgDims(svgSource: string): { width: number; height: number } {
  const m = svgSource.match(/viewBox=["']([^"']+)["']/);
  if (!m) return { width: 0, height: 0 };
  const vb = m[1].split(/[\s,]+/).map(Number);
  return vb.length === 4 ? { width: vb[2], height: vb[3] } : { width: 0, height: 0 };
}

export async function renderFrameToSvg(spec: FrameSpec): Promise<RenderToSvgResult> {
  const settings =
    spec.kind === "chord"
      ? spec.settings
      : { ...(spec.settings ?? {}), frets: spec.frame.fretSpan };
  const handdrawn = settings?.style === "handdrawn";

  if (handdrawn) {
    const svg = await renderFrameInBrowser(spec);
    return { svg, ...parseSvgDims(svg) };
  }

  await loadModules();

  const window = createSVGWindow();
  installGetBBoxShim(window);
  const document = (window as unknown as { document: Document }).document;
  registerWindow(window as unknown as Window, document);

  const g = globalThis as unknown as Record<string, unknown>;
  g.window = window;
  g.document = document;
  const w = window as unknown as Record<string, unknown>;
  g.HTMLElement = w.HTMLElement;
  g.SVGElement = w.SVGElement;
  g.Element = w.Element;
  g.Node = w.Node;

  const container = document.documentElement; // <svg>

  const chord =
    spec.kind === "chord"
      ? spec.chord
      : scaleToChordImpl!.frameToChord(spec.frame, {
          instrument: spec.instrument,
          key: spec.key,
        });

  const chart = new SVGuitarChordCtor!(container as unknown as HTMLElement);
  chart
    .configure({
      fontFamily: "Poppins, sans-serif",
      color: "#0a0a0a",
      backgroundColor: "transparent",
      ...settings,
    })
    .chord(chord)
    .draw();

  const svg = container as unknown as SVGSVGElement;
  postProcessImpl!(svg, { settings, textStyle: spec.textStyle });

  if (!svg.getAttribute("xmlns")) {
    svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  }
  const out =
    (svg as unknown as { outerHTML?: string }).outerHTML ??
    (svg as unknown as { svg?: () => string }).svg?.() ??
    "";

  return { svg: out, ...parseSvgDims(out) };
}
