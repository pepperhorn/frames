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
      const texts = svg.querySelectorAll("text");
      texts.forEach((t) => {
        // Force font-family on every text node so the handdrawn style's
        // hard-coded Patrick Hand can be overridden by the user's choice.
        t.setAttribute("font-family", family);
        if (textStyle?.fontWeight) {
          t.setAttribute("font-weight", textStyle.fontWeight);
        }
        if (textStyle?.fontStyle) {
          t.setAttribute("font-style", textStyle.fontStyle);
        }
        const existingStyle = t.getAttribute("style") ?? "";
        const cleaned = existingStyle.replace(/filter\s*:\s*drop-shadow\([^)]*\);?/g, "");
        if (shadowCss) {
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
