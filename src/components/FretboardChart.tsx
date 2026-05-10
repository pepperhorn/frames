import { useEffect, useRef } from "react";
import { SVGuitarChord, type ChordSettings, type Chord } from "svguitar";

export type FontWeight = "400" | "500" | "600" | "700" | "800";
export type FontStyle = "normal" | "italic";

export interface TextShadow {
  offsetX: number;
  offsetY: number;
  blur: number;
  color: string;
}

export interface RoleStyle {
  fontWeight?: FontWeight;
  fontStyle?: FontStyle;
}

export interface TextStyle {
  dot?: RoleStyle & { shadow?: TextShadow | null };
  title?: RoleStyle;
  fretLabel?: RoleStyle;
  tuning?: RoleStyle;
}

type Role = "dot" | "title" | "fretLabel" | "tuning";

function roleFor(el: SVGTextElement): Role | null {
  const cl = el.classList;
  if (cl.contains("finger-text")) return "dot";
  if (cl.contains("title")) return "title";
  if (cl.contains("fret-position")) return "fretLabel";
  if (cl.contains("tuning")) return "tuning";
  return null;
}

interface FretboardChartProps {
  chord: Chord;
  settings?: ChordSettings;
  textStyle?: TextStyle;
  className?: string;
}

export function FretboardChart({
  chord,
  settings,
  textStyle,
  className,
}: FretboardChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
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

    const svg = el.querySelector("svg");
    if (svg) {
      const family = settings?.fontFamily ?? "Poppins, sans-serif";
      const allTexts = Array.from(svg.querySelectorAll("text")) as SVGTextElement[];

      // Capture each text's visual anchor point and vertical center BEFORE
      // swapping font. svguitar's handdrawn renderer pre-shifts x and y using
      // Patrick Hand metrics; once we change fonts that math breaks for every
      // text. Pinning via real text-anchor + dominant-baseline keeps every
      // role aligned (finger labels, title, fret position, tuning labels)
      // both horizontally and vertically.
      type AnchorInfo = {
        anchor: "start" | "middle" | "end";
        anchorX: number;
        cy: number;
      };
      const anchors = new Map<SVGTextElement, AnchorInfo>();
      allTexts.forEach((t) => {
        try {
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

      const dotShadow = textStyle?.dot?.shadow ?? null;
      const shadowCss = dotShadow
        ? `drop-shadow(${dotShadow.offsetX}px ${dotShadow.offsetY}px ${dotShadow.blur}px ${dotShadow.color})`
        : null;

      allTexts.forEach((t) => {
        // Force font-family on every text node so the handdrawn style's
        // hard-coded Patrick Hand can be overridden by the user's choice.
        t.setAttribute("font-family", family);

        const role = roleFor(t);
        const roleStyle: RoleStyle | undefined = role ? textStyle?.[role] : undefined;
        if (roleStyle?.fontWeight) t.setAttribute("font-weight", roleStyle.fontWeight);
        if (roleStyle?.fontStyle) t.setAttribute("font-style", roleStyle.fontStyle);

        // Shadow only on dot labels — applying it to title / tuning / fret
        // marker creates visual noise.
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

      // Re-anchor after font/weight changes.
      anchors.forEach(({ anchor, anchorX, cy }, t) => {
        t.setAttribute("text-anchor", anchor);
        t.setAttribute("x", String(anchorX));
        t.setAttribute("dominant-baseline", "central");
        t.setAttribute("y", String(cy));
      });

      // Auto-shrink title if it overflows the viewBox after font swap.
      const title = svg.querySelector("text.title") as SVGTextElement | null;
      const vbWidth =
        svg.viewBox?.baseVal?.width || svg.getBoundingClientRect().width || 0;
      if (title && vbWidth > 0) {
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

    return () => {
      el.innerHTML = "";
    };
  }, [chord, settings, textStyle]);

  return <div ref={containerRef} className={`fretboard-chart ${className ?? ""}`} />;
}

export { FretboardChart as ChordChart };
