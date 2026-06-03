import type { ChordSettings } from "svguitar";
import type { RoleStyle, TextStyle } from "@/components/FretboardChart";

type Role = "dot" | "title" | "fretLabel" | "tuning";

function hasClass(el: Element, name: string): boolean {
  if (el.classList && typeof el.classList.contains === "function") {
    return el.classList.contains(name);
  }
  const attr = el.getAttribute("class") ?? "";
  return attr.split(/\s+/).includes(name);
}

function roleFor(el: SVGTextElement): Role | null {
  if (hasClass(el, "finger-text")) return "dot";
  if (hasClass(el, "title")) return "title";
  if (hasClass(el, "fret-position")) return "fretLabel";
  if (hasClass(el, "tuning")) return "tuning";
  return null;
}

export interface PostProcessOptions {
  settings?: ChordSettings;
  textStyle?: TextStyle;
}

/**
 * Apply font-family, per-role weight/style/shadow, handdrawn-mode re-anchoring,
 * and title auto-shrink to an svguitar-rendered <svg>. Safe to call in both
 * browser and JSDOM contexts — bbox-dependent passes degrade gracefully when
 * getBBox is unavailable or returns zeros.
 */
export function postProcessSvg(svg: SVGSVGElement, opts: PostProcessOptions) {
  const { settings, textStyle } = opts;
  const family = settings?.fontFamily ?? "Poppins, sans-serif";
  const isHanddrawn = settings?.style === "handdrawn";
  const allTexts = Array.from(svg.querySelectorAll("text")) as SVGTextElement[];

  type AnchorInfo = {
    anchor: "start" | "middle" | "end";
    anchorX: number;
    cy: number;
  };
  const anchors = new Map<SVGTextElement, AnchorInfo>();
  if (isHanddrawn) {
    allTexts.forEach((t) => {
      try {
        if (typeof t.getBBox !== "function") return;
        const b = t.getBBox();
        if (b.width <= 0) return;
        const align = t.getAttribute("align");
        if (align === "middle") {
          anchors.set(t, {
            anchor: "middle",
            anchorX: b.x + b.width / 2,
            cy: b.y + b.height / 2,
          });
        } else if (align === "right") {
          anchors.set(t, {
            anchor: "end",
            anchorX: b.x + b.width,
            cy: b.y + b.height / 2,
          });
        } else {
          anchors.set(t, {
            anchor: "start",
            anchorX: b.x,
            cy: b.y + b.height / 2,
          });
        }
      } catch {
        /* element not yet laid out */
      }
    });

    const fretPos = svg.querySelector("text.fret-position") as SVGTextElement | null;
    if (fretPos && anchors.has(fretPos)) {
      const dotCYs = allTexts
        .filter((t) => t.classList.contains("finger-text") && anchors.has(t))
        .map((t) => anchors.get(t)!.cy);
      if (dotCYs.length > 0) {
        const topDotCy = Math.min(...dotCYs);
        const cur = anchors.get(fretPos)!;
        anchors.set(fretPos, { ...cur, cy: topDotCy });
      }
    }
  }

  const dotShadow = textStyle?.dot?.shadow ?? null;
  const shadowCss = dotShadow
    ? `drop-shadow(${dotShadow.offsetX}px ${dotShadow.offsetY}px ${dotShadow.blur}px ${dotShadow.color})`
    : null;

  allTexts.forEach((t) => {
    t.setAttribute("font-family", family);

    const role = roleFor(t);
    const roleStyle: RoleStyle | undefined = role ? textStyle?.[role] : undefined;
    if (roleStyle?.fontWeight) t.setAttribute("font-weight", roleStyle.fontWeight);
    if (roleStyle?.fontStyle) t.setAttribute("font-style", roleStyle.fontStyle);

    const isDot = role === "dot";
    const existingStyle = t.getAttribute("style") ?? "";
    const cleaned = existingStyle.replace(/filter\s*:\s*drop-shadow\([^)]*\);?/g, "");
    if (shadowCss && isDot) {
      const sep = cleaned && !cleaned.endsWith(";") ? ";" : "";
      t.setAttribute("style", `${cleaned}${sep}filter:${shadowCss}`);
    } else if (cleaned !== existingStyle) {
      t.setAttribute("style", cleaned);
    }
  });

  anchors.forEach(({ anchor, anchorX, cy }, t) => {
    t.setAttribute("text-anchor", anchor);
    t.setAttribute("x", String(anchorX));
    t.setAttribute("dominant-baseline", "central");
    t.setAttribute("y", String(cy));
  });

  const title = svg.querySelector("text.title") as SVGTextElement | null;
  const vbWidth =
    svg.viewBox?.baseVal?.width ||
    (typeof svg.getBoundingClientRect === "function"
      ? svg.getBoundingClientRect().width
      : 0) ||
    0;
  if (title && vbWidth > 0 && typeof title.getBBox === "function") {
    const limit = vbWidth * 0.95;
    let attempts = 0;
    while (attempts < 6) {
      let bbox: DOMRect | null = null;
      try {
        bbox = title.getBBox();
      } catch {
        break;
      }
      if (!bbox || bbox.width <= limit) break;
      const current = parseFloat(title.getAttribute("font-size") ?? "48") || 48;
      const next = Math.max(8, current * (limit / bbox.width) * 0.97);
      if (next >= current - 0.5) break;
      title.setAttribute("font-size", String(next));
      attempts += 1;
    }
  }
}
