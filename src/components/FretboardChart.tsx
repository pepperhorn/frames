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

export interface TextStyle {
  fontWeight?: FontWeight;
  fontStyle?: FontStyle;
  shadow?: TextShadow | null;
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
      const shadow = textStyle?.shadow;
      const shadowCss = shadow
        ? `drop-shadow(${shadow.offsetX}px ${shadow.offsetY}px ${shadow.blur}px ${shadow.color})`
        : null;
      const allTexts = Array.from(svg.querySelectorAll("text")) as SVGTextElement[];

      // Re-center finger labels via real text-anchor before changing the font.
      // The handdrawn renderer pre-shifts x by bbox.width/2 using Patrick Hand
      // metrics; that math breaks once we swap fonts, so multi-char labels like
      // "D#" drift off the dot. Reading the rendered bbox and pinning x to its
      // visual center, then setting text-anchor:middle, makes the alignment
      // robust to any post-render font swap.
      allTexts.forEach((t) => {
        if (!t.classList.contains("finger-text")) return;
        try {
          const b = t.getBBox();
          if (b.width > 0) {
            const cx = b.x + b.width / 2;
            t.setAttribute("text-anchor", "middle");
            t.setAttribute("x", String(cx));
          }
        } catch {
          /* getBBox can throw if the element is not yet laid out */
        }
      });

      allTexts.forEach((t) => {
        // Force font-family on every text node so the handdrawn style's
        // hard-coded Patrick Hand can be overridden by the user's choice.
        t.setAttribute("font-family", family);
        if (textStyle?.fontWeight) {
          t.setAttribute("font-weight", textStyle.fontWeight);
        }
        if (textStyle?.fontStyle) {
          t.setAttribute("font-style", textStyle.fontStyle);
        }

        // Shadow is only meaningful on dot labels — applying it to the title or
        // tuning text creates visual noise.
        const isFingerText = t.classList.contains("finger-text");
        const existingStyle = t.getAttribute("style") ?? "";
        const cleaned = existingStyle.replace(/filter\s*:\s*drop-shadow\([^)]*\);?/g, "");
        if (shadowCss && isFingerText) {
          const sep = cleaned && !cleaned.endsWith(";") ? ";" : "";
          t.setAttribute("style", `${cleaned}${sep}filter:${shadowCss}`);
        } else if (cleaned !== existingStyle) {
          t.setAttribute("style", cleaned);
        }
      });
    }
    return () => {
      el.innerHTML = "";
    };
  }, [chord, settings, textStyle]);

  return <div ref={containerRef} className={`fretboard-chart ${className ?? ""}`} />;
}

export { FretboardChart as ChordChart };
