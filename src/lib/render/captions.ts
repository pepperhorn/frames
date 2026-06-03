const SVGNS = "http://www.w3.org/2000/svg";

/** Optional centered captions composited onto an svguitar-rendered diagram:
 *  a subtitle just beneath the chord/scale title, and a footer at the bottom. */
export interface Captions {
  subtitle?: string;
  subtitleSize?: number;
  subtitleColor?: string;
  footer?: string;
  footerSize?: number;
  footerColor?: string;
}

export function hasCaptions(c: Captions | undefined): boolean {
  return Boolean(c && (c.subtitle?.trim() || c.footer?.trim()));
}

/** Visual bottom of the title text. Prefers the rendered bbox (font metrics
 *  push the glyph well past y + font-size); falls back to an estimate when
 *  getBBox is unavailable (server/JSDOM). */
function titleBottom(title: SVGTextElement | null): number {
  if (!title) return 0;
  try {
    if (typeof title.getBBox === "function") {
      const b = title.getBBox();
      if (b && b.height > 0) return b.y + b.height;
    }
  } catch {
    /* not laid out */
  }
  const y = Number(title.getAttribute("y") || 0);
  const fs = Number(title.getAttribute("font-size") || 0);
  return y + fs * 1.5;
}

/**
 * Composite a centered subtitle (below the title) and/or footer (at the bottom)
 * into an svguitar <svg>. The diagram body is shifted down to open a band for
 * the subtitle, and the viewBox grows to make room for both. The svg carries no
 * width/height attributes (only viewBox + xMidYMid meet), so growing the viewBox
 * is enough — the preview rescales and every exporter reads the viewBox.
 */
export function addCaptions(
  svg: SVGSVGElement,
  captions: Captions,
  fontFamily: string,
): void {
  const subtitle = captions.subtitle?.trim();
  const footer = captions.footer?.trim();
  if (!subtitle && !footer) return;

  const vb = svg.viewBox?.baseVal;
  if (!vb || !vb.width || !vb.height) return;
  const { x: minX, y: minY, width, height } = vb;
  const cx = minX + width / 2;
  const doc = svg.ownerDocument;

  const subSize = captions.subtitleSize ?? 22;
  const footSize = captions.footerSize ?? 16;
  const topBand = subtitle ? subSize * 1.6 : 0;
  const botBand = footer ? footSize * 2 : 0;

  // Background rect is full-bleed (width/height 100%); the title stays pinned at
  // the top. Everything else shifts down by the subtitle band.
  const title = svg.querySelector("text.title") as SVGTextElement | null;
  const bgRect = svg.querySelector(":scope > rect") as SVGRectElement | null;

  if (topBand > 0) {
    const body = doc.createElementNS(SVGNS, "g");
    body.setAttribute("class", "caption-body");
    body.setAttribute("transform", `translate(0 ${topBand})`);
    Array.from(svg.childNodes)
      .filter((n) => n !== title && n !== bgRect)
      .forEach((n) => body.appendChild(n));
    svg.appendChild(body);
  }

  svg.setAttribute("viewBox", `${minX} ${minY} ${width} ${height + topBand + botBand}`);

  const makeText = (cls: string, y: number, size: number, weight: string, color: string, text: string) => {
    const t = doc.createElementNS(SVGNS, "text");
    t.setAttribute("class", cls);
    t.setAttribute("x", String(cx));
    t.setAttribute("y", String(y));
    t.setAttribute("text-anchor", "middle");
    t.setAttribute("dominant-baseline", "alphabetic");
    t.setAttribute("font-family", fontFamily);
    t.setAttribute("font-size", String(size));
    t.setAttribute("font-weight", weight);
    t.setAttribute("fill", color);
    t.textContent = text;
    svg.appendChild(t);
  };

  if (subtitle) {
    makeText(
      "caption-subtitle",
      titleBottom(title) + subSize,
      subSize,
      "600",
      captions.subtitleColor ?? "#0a0a0a",
      subtitle,
    );
  }

  if (footer) {
    makeText(
      "caption-footer",
      minY + topBand + height + botBand * 0.6,
      footSize,
      "400",
      captions.footerColor ?? "#0a0a0a",
      footer,
    );
  }
}
